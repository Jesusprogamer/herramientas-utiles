/**
 * Elegir al azar: moneda, dados, ruleta y numeros aleatorios.
 * Todo el azar sale de crypto.getRandomValues sin sesgo (src/core/random.js).
 */
import { h, clear, copyText } from '../../ui/dom.js';
import { button, iconButton, tabs, field, select, toggle, settingRow, notice, emptyState } from '../../ui/components.js';
import { toastOk, toastError, toast } from '../../ui/toast.js';
import { belowUnbiased, intBetween, uniqueInts, shuffle } from '../../core/random.js';
import * as storage from '../../core/storage.js';
import { t, tn, formatNumber } from '../../core/i18n.js';
import * as audio from '../../core/audio.js';
import { buildCoin, FINISH_NAMES } from './coin.js';
import { dieFace } from './dice.js';
import { coinChime, diceRoll } from './sounds.js';

const KEYS = { coin: 'azar-moneda', wheel: 'azar-ruleta', numbers: 'azar-numeros' };

/* ================= MONEDA ================= */

function renderCoin(panel) {
  const saved = storage.get(KEYS.coin, null) || {};
  let heads = Number.isInteger(saved.heads) ? saved.heads : 0;
  let tails = Number.isInteger(saved.tails) ? saved.tails : 0;
  let finish = FINISH_NAMES.includes(saved.finish) ? saved.finish : 'oro';
  let turns = 0;          // vueltas acumuladas, para que siempre gire hacia delante
  let busy = false;

  const holder = h('div');
  let coin = null;

  const result = h('p.coin-result', { role: 'status', 'aria-live': 'polite' });
  const score = h('p.muted', { style: { textAlign: 'center' } });

  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
    || document.documentElement.dataset.reduceMotion === 'on';

  function buildFace() {
    clear(holder);
    coin = buildCoin(finish);
    coin.root.setAttribute('role', 'img');
    coin.root.setAttribute('aria-label', t('azar.moneda.coinLabel'));
    holder.appendChild(coin.root);
    coin.inner.style.transform = `rotateY(${turns * 360}deg)`;
  }

  function updateScore() {
    score.textContent = t('azar.moneda.score', {
      heads: formatNumber(heads), tails: formatNumber(tails), total: formatNumber(heads + tails)
    });
  }

  function flip() {
    if (busy) return;
    busy = true;
    // El resultado se decide ANTES de la animacion, con el generador
    // criptografico: la animacion solo lo representa.
    const isHeads = belowUnbiased(2) === 0;
    audio.playCustom(coinChime);

    const land = isHeads ? 0 : 180;
    const finish_ = () => {
      result.textContent = t(`azar.moneda.${isHeads ? 'heads' : 'tails'}`);
      if (isHeads) heads++; else tails++;
      storage.set(KEYS.coin, { heads, tails, finish });
      updateScore();
      busy = false;
    };

    if (reduced()) {
      // Sin giro: solo un fundido.
      coin.inner.classList.add('coin3d--instant');
      coin.inner.style.transform = `rotateY(${land}deg)`;
      coin.root.classList.remove('coin3d--fade');
      void coin.root.offsetWidth;
      coin.root.classList.add('coin3d--fade');
      setTimeout(finish_, 260);
      return;
    }

    coin.inner.classList.remove('coin3d--instant');
    turns += 4 + belowUnbiased(3);
    coin.inner.style.transform = `rotateY(${turns * 360 + land}deg)`;
    setTimeout(finish_, 1600);
  }

  const finishRow = h('div.coin-finishes');
  const finishButtons = FINISH_NAMES.map(name => {
    const b = button(t(`azar.moneda.finish.${name}`), {
      class: 'btn--sm',
      'aria-pressed': String(name === finish),
      onClick: () => {
        finish = name;
        storage.set(KEYS.coin, { heads, tails, finish });
        finishButtons.forEach(x => x.setAttribute('aria-pressed', String(x.dataset.finish === name)));
        buildFace();
      }
    });
    b.dataset.finish = name;
    finishRow.appendChild(b);
    return b;
  });

  buildFace();
  updateScore();

  panel.append(h('div.stack',
    holder,
    result,
    h('div.row', { style: { justifyContent: 'center' } },
      button(t('azar.moneda.flip'), { variant: 'primary', icon: 'dice', onClick: flip }),
      button(t('azar.moneda.reset'), {
        icon: 'refresh',
        onClick: () => { heads = 0; tails = 0; storage.set(KEYS.coin, { heads, tails, finish }); updateScore(); }
      })
    ),
    score,
    h('div.stack',
      h('span.field__label', { style: { textAlign: 'center' }, text: t('azar.moneda.finish.label') }),
      finishRow
    )
  ));
}

/* ================= DADOS ================= */

const DICE_TYPES = [4, 6, 8, 10, 12, 20];

function renderDice(panel) {
  let count = 2;
  let faces = 6;
  let custom = 100;

  const row = h('div.dice-row');
  const total = h('p.muted', { 'aria-live': 'polite' });

  function roll() {
    const sides = faces === 0 ? custom : faces;
    clear(row);
    let sum = 0;
    const values = [];
    audio.playCustom((ctx, dest, when) => diceRoll(ctx, dest, when, Math.min(6, count)));

    for (let i = 0; i < count; i++) {
      const value = intBetween(1, sides);
      values.push(value);
      sum += value;
      // El d6 sale con puntos; el resto, con la forma del dado y su numero.
      const die = h('div.die.die--svg.die--rolling', {
        role: 'img',
        'aria-label': t('azar.dados.dieLabel', { sides: sides === 0 ? custom : sides, value })
      }, dieFace(sides, value));
      row.appendChild(die);
      setTimeout(() => die.classList.remove('die--rolling'), 500);
    }
    total.textContent = t('azar.dados.total', {
      values: values.map(v => formatNumber(v)).join(' + '),
      sum: formatNumber(sum)
    });
  }

  const countSel = select({
    label: t('azar.dados.count'),
    value: String(count),
    options: [1, 2, 3, 4, 5, 6].map(n => ({ value: String(n), label: String(n) })),
    onChange: e => { count = Number(e.target.value); roll(); }
  });

  const customField = field({
    label: t('azar.dados.customFaces'),
    type: 'number', min: '2', max: '1000', value: String(custom),
    onInput: e => {
      const n = Number(e.target.value);
      if (!Number.isInteger(n) || n < 2 || n > 1000) { customField.setError(t('azar.dados.customInvalid')); return; }
      customField.setError('');
      custom = n;
      if (faces === 0) roll();
    }
  });
  customField.hidden = true;

  const facesSel = select({
    label: t('azar.dados.faces'),
    value: String(faces),
    options: [...DICE_TYPES.map(n => ({ value: String(n), label: `d${n}` })),
      { value: '0', label: t('azar.dados.custom') }],
    onChange: e => {
      faces = Number(e.target.value);
      customField.hidden = faces !== 0;
      roll();
    }
  });

  panel.append(h('div.stack',
    h('div.tool-cols.tool-cols--2', countSel, facesSel),
    customField,
    button(t('azar.dados.roll'), { variant: 'primary', icon: 'dice', onClick: roll }),
    row,
    total
  ));
  roll();
}

/* ================= RULETA ================= */

const WHEEL_COLORS = ['#5c9dff', '#9f80ff', '#46cd77', '#ff9640', '#f878b2', '#38c7dc', '#e3b341', '#ff7b72'];

function renderWheel(panel) {
  const saved = storage.get(KEYS.wheel, null);
  const initial = Array.isArray(saved) && saved.length ? saved.join('\n') : t('azar.ruleta.example');

  const textarea = h('textarea.textarea', {
    rows: '5', 'aria-label': t('azar.ruleta.optionsLabel'),
    placeholder: t('azar.ruleta.placeholder')
  });
  textarea.value = initial;

  const canvas = h('canvas', { width: '340', height: '340', role: 'img' });
  // Vacio hasta que haya resultado: un guion suelto parecia un trazo perdido.
  const winner = h('p.conv__result-value', { 'aria-live': 'polite' });
  const wrap = h('div.wheel-wrap', h('div.wheel__pointer'), canvas);

  let angle = 0;
  let spinning = false;

  const options = () => textarea.value.split('\n').map(s => s.trim()).filter(Boolean).slice(0, 24);

  function draw() {
    const list = options();
    const ctx = canvas.getContext('2d');
    const size = canvas.width;
    const r = size / 2;
    ctx.clearRect(0, 0, size, size);

    if (!list.length) {
      canvas.setAttribute('aria-label', t('azar.ruleta.emptyLabel'));
      ctx.fillStyle = '#888';
      ctx.font = '16px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(t('azar.ruleta.empty'), r, r);
      return;
    }
    canvas.setAttribute('aria-label', t('azar.ruleta.wheelLabel', { n: list.length }));

    const slice = (Math.PI * 2) / list.length;
    ctx.save();
    ctx.translate(r, r);
    ctx.rotate(angle);
    list.forEach((label, i) => {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, r - 4, i * slice, (i + 1) * slice);
      ctx.closePath();
      ctx.fillStyle = WHEEL_COLORS[i % WHEEL_COLORS.length];
      ctx.fill();

      ctx.save();
      const mid = i * slice + slice / 2;
      ctx.rotate(mid);
      ctx.fillStyle = '#0b1020';
      ctx.font = '600 14px system-ui, sans-serif';
      ctx.textBaseline = 'middle';
      const text = label.length > 16 ? `${label.slice(0, 15)}…` : label;

      // En la mitad izquierda de la rueda el texto saldria boca abajo:
      // se gira media vuelta y se alinea al otro lado.
      const absolute = (((angle + mid) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      const upsideDown = absolute > Math.PI / 2 && absolute < Math.PI * 1.5;
      if (upsideDown) {
        ctx.rotate(Math.PI);
        ctx.textAlign = 'left';
        ctx.fillText(text, -(r - 16), 0);
      } else {
        ctx.textAlign = 'right';
        ctx.fillText(text, r - 16, 0);
      }
      ctx.restore();
    });
    ctx.restore();
  }

  function spin() {
    const list = options();
    if (!list.length) { toast(t('azar.ruleta.empty'), { kind: 'error' }); return; }
    if (spinning) return;
    spinning = true;
    storage.set(KEYS.wheel, list);

    // Se elige primero el ganador y luego se anima hasta el; el resultado no
    // depende del tiempo de animacion.
    const index = belowUnbiased(list.length);
    const slice = (Math.PI * 2) / list.length;
    // El puntero esta arriba (-90 grados). Centro del sector elegido bajo el puntero:
    const target = (-Math.PI / 2) - (index * slice + slice / 2);
    const turns = 5 + belowUnbiased(3);
    const start = angle;
    const end = target - turns * Math.PI * 2;
    const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 10 : 3600;
    const t0 = performance.now();

    const easeOut = x => 1 - Math.pow(1 - x, 4);
    function frame(now) {
      const p = Math.min(1, (now - t0) / duration);
      angle = start + (end - start) * easeOut(p);
      draw();
      if (p < 1) requestAnimationFrame(frame);
      else {
        angle = ((target % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        draw();
        winner.textContent = list[index];
        spinning = false;
      }
    }
    requestAnimationFrame(frame);
  }

  textarea.addEventListener('input', () => { draw(); });

  panel.append(h('div.stack',
    wrap,
    winner,
    button(t('azar.ruleta.spin'), { variant: 'primary', icon: 'refresh', onClick: spin }),
    h('div.field',
      h('label.field__label', { text: t('azar.ruleta.optionsLabel') }),
      textarea,
      h('p.field__hint', { text: t('azar.ruleta.hint') })
    )
  ));
  draw();
}

/* ================= NÚMERO ALEATORIO ================= */

function renderNumbers(panel) {
  const saved = storage.get(KEYS.numbers, null) || {};
  let history = Array.isArray(saved.history) ? saved.history.slice(0, 10) : [];

  const minField = field({ label: t('azar.numeros.min'), type: 'number', value: String(saved.min ?? 1), onInput: validate });
  const maxField = field({ label: t('azar.numeros.max'), type: 'number', value: String(saved.max ?? 100), onInput: validate });
  const countField = field({ label: t('azar.numeros.count'), type: 'number', min: '1', max: '100', value: String(saved.count ?? 1), onInput: validate });

  let noRepeat = Boolean(saved.noRepeat);
  let sorted = Boolean(saved.sorted);

  const results = h('div.numbers', { 'aria-live': 'polite' });
  const historyBox = h('div.stack');
  const generateBtn = button(t('azar.numeros.generate'), { variant: 'primary', icon: 'dice', onClick: generate });

  function read() {
    return {
      min: Number(minField.input.value),
      max: Number(maxField.input.value),
      count: Number(countField.input.value)
    };
  }

  function validate() {
    const { min, max, count } = read();
    let okAll = true;
    const fail = (f, msg) => { f.setError(msg); okAll = false; };

    for (const [f, v] of [[minField, min], [maxField, max], [countField, count]]) {
      if (!Number.isFinite(v)) { fail(f, t('azar.numeros.needNumber')); } else f.setError('');
    }
    if (okAll) {
      if (!Number.isInteger(min) || !Number.isInteger(max)) fail(minField, t('azar.numeros.needInteger'));
      else if (min >= max) fail(minField, t('azar.numeros.minLessThanMax'));
      if (!Number.isInteger(count) || count < 1 || count > 100) fail(countField, t('azar.numeros.countRange'));
      else if (noRepeat && okAll && count > (max - min + 1)) fail(countField, t('azar.numeros.tooManyUnique', { size: formatNumber(max - min + 1) }));
    }
    generateBtn.disabled = !okAll;
    return okAll;
  }

  function persist() {
    const { min, max, count } = read();
    storage.set(KEYS.numbers, { min, max, count, noRepeat, sorted, history });
  }

  function paintResults(values) {
    clear(results);
    const shown = sorted ? [...values].sort((a, b) => a - b) : values;
    for (const n of shown) results.appendChild(h('span.number-chip', { text: formatNumber(n) }));
  }

  function paintHistory() {
    clear(historyBox);
    if (!history.length) return;
    historyBox.appendChild(h('p.small.muted', { text: t('azar.numeros.history') }));
    for (const entry of history) {
      historyBox.appendChild(h('p.small.faint.tnum', { text: entry.join(', ') }));
    }
  }

  function generate() {
    if (!validate()) return;
    const { min, max, count } = read();
    let values;
    try {
      values = noRepeat ? uniqueInts(min, max, count)
        : Array.from({ length: count }, () => intBetween(min, max));
    } catch (err) {
      toastError(err.message);
      return;
    }
    paintResults(values);
    history = [values, ...history].slice(0, 10);
    paintHistory();
    persist();
  }

  const copyBtn = button(t('common.copy'), {
    icon: 'download',
    onClick: async () => {
      const text = [...results.children].map(c => c.textContent).join(', ');
      if (!text) return;
      (await copyText(text)) ? toastOk(t('common.copied')) : toastError(t('common.copyFailed'));
    }
  });

  panel.append(h('div.stack',
    h('div.tool-cols.tool-cols--2', minField, maxField),
    countField,
    settingRow({
      label: t('azar.numeros.noRepeat.label'), desc: t('azar.numeros.noRepeat.desc'),
      control: toggle({
        label: t('azar.numeros.noRepeat.label'), checked: noRepeat,
        onChange: v => { noRepeat = v; validate(); persist(); }
      })
    }),
    settingRow({
      label: t('azar.numeros.sorted.label'), desc: t('azar.numeros.sorted.desc'),
      control: toggle({
        label: t('azar.numeros.sorted.label'), checked: sorted,
        onChange: v => {
          sorted = v; persist();
          const current = [...results.children].map(c => Number(String(c.textContent).replace(/[^\d-]/g, '')));
          if (current.length) paintResults(current);
        }
      })
    }),
    h('div.row', generateBtn, copyBtn),
    results,
    historyBox
  ));

  validate();
  paintHistory();
}

/* ================================================================ */

export default {
  id: 'azar',

  mount(container) {
    container.appendChild(h('div.page',
      h('header.page__header',
        h('h1.page__title', { text: t('tools.azar.name') }),
        h('p.page__lead', { text: t('tools.azar.desc') })
      ),
      tabs({
        label: t('tools.azar.name'),
        items: [
          { id: 'moneda', label: t('azar.tab.moneda'), render: renderCoin },
          { id: 'dados', label: t('azar.tab.dados'), render: renderDice },
          { id: 'ruleta', label: t('azar.tab.ruleta'), render: renderWheel },
          { id: 'numeros', label: t('azar.tab.numeros'), render: renderNumbers }
        ]
      }),
      notice(t('azar.hint'), { kind: 'info', iconName: 'shield' })
    ));
  },

  unmount() {}
};
