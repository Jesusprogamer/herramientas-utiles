/**
 * Generador de contraseñas.
 *
 * Los caracteres salen de crypto.getRandomValues sin sesgo de modulo
 * (ver src/core/random.js). Nada se envia a ningun sitio ni se guarda:
 * solo se recuerdan las opciones elegidas.
 */
import { h, clear, copyText } from '../../ui/dom.js';
import { button, iconButton, toggle, slider, settingRow, notice, emptyState } from '../../ui/components.js';
import { toastOk, toastError, toast } from '../../ui/toast.js';
import { belowUnbiased, shuffle } from '../../core/random.js';
import * as storage from '../../core/storage.js';
import { t, formatNumber } from '../../core/i18n.js';

const KEY = 'contrasenas';

const SETS = {
  minusculas: 'abcdefghijklmnopqrstuvwxyz',
  mayusculas: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  numeros: '0123456789',
  simbolos: '!@#$%&*+-=?_~^()[]{}<>/.,:;'
};
const AMBIGUOUS = new Set([...'Il1|O0o`\'"~,;.:']);

const DEFAULTS = {
  length: 16, minusculas: true, mayusculas: true, numeros: true,
  simbolos: true, sinAmbiguos: true, cantidad: 1
};

function alphabetFor(opts) {
  let pools = [];
  for (const key of Object.keys(SETS)) {
    if (!opts[key]) continue;
    const chars = [...SETS[key]].filter(c => !opts.sinAmbiguos || !AMBIGUOUS.has(c));
    if (chars.length) pools.push(chars);
  }
  return pools;
}

/** Genera una contraseña con al menos un caracter de cada grupo elegido. */
function generate(opts) {
  const pools = alphabetFor(opts);
  if (!pools.length) return '';
  const all = pools.flat();
  const length = Math.max(opts.length, pools.length);

  const chars = pools.map(pool => pool[belowUnbiased(pool.length)]);
  while (chars.length < length) chars.push(all[belowUnbiased(all.length)]);
  return shuffle(chars).join('');
}

/** Entropia en bits: log2(alfabeto) * longitud. */
function entropyBits(opts) {
  const size = alphabetFor(opts).flat().length;
  if (!size) return 0;
  return Math.log2(size) * opts.length;
}

function strengthLevel(bits) {
  if (bits < 40) return 1;
  if (bits < 60) return 2;
  if (bits < 80) return 3;
  return 4;
}

export default {
  id: 'contrasenas',

  mount(container) {
    const saved = storage.get(KEY, null) || {};
    const opts = { ...DEFAULTS };
    for (const key of Object.keys(DEFAULTS)) {
      if (typeof saved[key] === typeof DEFAULTS[key]) opts[key] = saved[key];
    }
    opts.length = Math.min(64, Math.max(4, opts.length));
    opts.cantidad = Math.min(10, Math.max(1, opts.cantidad));

    const persist = () => storage.set(KEY, opts);

    const output = h('div.stack');
    const strengthBar = h('div.strength__fill');
    const strengthLabel = h('p.small.muted', { 'aria-live': 'polite' });
    const strengthWrap = h('div.strength',
      h('div.strength__bar', strengthBar),
      strengthLabel
    );

    const warning = h('div', { hidden: true });

    function updateStrength() {
      const bits = entropyBits(opts);
      const level = strengthLevel(bits);
      strengthWrap.className = `strength strength--${level}`;
      strengthBar.style.width = `${Math.min(100, (bits / 100) * 100)}%`;
      strengthLabel.textContent = t('contrasenas.strength', {
        level: t(`contrasenas.level.${level}`),
        bits: formatNumber(Math.round(bits))
      });
    }

    function renderPasswords() {
      clear(output);
      const pools = alphabetFor(opts);
      warning.hidden = pools.length > 0;
      if (!pools.length) {
        clear(warning);
        warning.appendChild(notice(t('contrasenas.noSets'), { kind: 'warning' }));
        output.appendChild(emptyState({ iconName: 'key', title: t('contrasenas.noSets') }));
        updateStrength();
        return;
      }

      for (let i = 0; i < opts.cantidad; i++) {
        const value = generate(opts);
        const text = h('p.resultbox__value.mono', { text: value });
        output.appendChild(h('div.resultbox',
          text,
          iconButton('download', t('contrasenas.copyOne'), {
            onClick: async () => {
              (await copyText(text.textContent))
                ? toastOk(t('common.copied'))
                : toastError(t('common.copyFailed'));
            }
          })
        ));
      }
      updateStrength();
    }

    const lengthSlider = slider({
      label: t('contrasenas.length'),
      min: 4, max: 64, value: opts.length,
      format: v => t('contrasenas.chars', { n: v }),
      onInput: v => { opts.length = v; persist(); renderPasswords(); }
    });

    const countSlider = slider({
      label: t('contrasenas.count'),
      min: 1, max: 10, value: opts.cantidad,
      format: v => String(v),
      onInput: v => { opts.cantidad = v; persist(); renderPasswords(); }
    });

    const setRow = (key, labelKey, descKey) => settingRow({
      label: t(labelKey),
      desc: t(descKey),
      control: toggle({
        label: t(labelKey),
        checked: opts[key],
        onChange: value => { opts[key] = value; persist(); renderPasswords(); }
      })
    });

    const regenerate = button(t('contrasenas.generate'), {
      variant: 'primary', icon: 'refresh', onClick: renderPasswords
    });

    const copyAll = button(t('contrasenas.copyAll'), {
      icon: 'download',
      onClick: async () => {
        const all = [...output.querySelectorAll('.resultbox__value')].map(el => el.textContent).join('\n');
        if (!all) { toast(t('contrasenas.noSets')); return; }
        (await copyText(all)) ? toastOk(t('common.copied')) : toastError(t('common.copyFailed'));
      }
    });

    container.appendChild(h('div.page',
      h('header.page__header',
        h('h1.page__title', { text: t('tools.contrasenas.name') }),
        h('p.page__lead', { text: t('tools.contrasenas.desc') })
      ),
      h('div.stack',
        output,
        strengthWrap,
        warning,
        h('div.row', regenerate, copyAll),
        h('section.card', h('div.card__body.stack',
          lengthSlider,
          countSlider,
          setRow('minusculas', 'contrasenas.lower.label', 'contrasenas.lower.desc'),
          setRow('mayusculas', 'contrasenas.upper.label', 'contrasenas.upper.desc'),
          setRow('numeros', 'contrasenas.digits.label', 'contrasenas.digits.desc'),
          setRow('simbolos', 'contrasenas.symbols.label', 'contrasenas.symbols.desc'),
          setRow('sinAmbiguos', 'contrasenas.noAmbiguous.label', 'contrasenas.noAmbiguous.desc')
        )),
        notice(t('contrasenas.privacy'), { kind: 'info', iconName: 'shield' })
      )
    ));

    renderPasswords();
  },

  unmount() {}
};
