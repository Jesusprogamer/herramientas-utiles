/**
 * Contador de palabras, caracteres y demas.
 * Todo se calcula en el dispositivo mientras escribes.
 */
import { h, clear, copyText } from '../../ui/dom.js';
import { button, notice } from '../../ui/components.js';
import { confirm } from '../../ui/dialog.js';
import { toastOk, toastError } from '../../ui/toast.js';
import * as storage from '../../core/storage.js';
import { t, formatNumber } from '../../core/i18n.js';

const KEY = 'contador-texto';
const WORDS_PER_MINUTE_READ = 220;
const WORDS_PER_MINUTE_SPEAK = 130;

/** Cuenta palabras con Intl.Segmenter cuando existe; si no, por separadores. */
function countWords(text) {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  try {
    if (typeof Intl.Segmenter === 'function') {
      const seg = new Intl.Segmenter(undefined, { granularity: 'word' });
      let n = 0;
      for (const piece of seg.segment(trimmed)) if (piece.isWordLike) n++;
      return n;
    }
  } catch { /* sin soporte: seguimos con el metodo simple */ }
  return trimmed.split(/\s+/).filter(Boolean).length;
}

function analyse(text) {
  const words = countWords(text);
  const trimmed = text.trim();
  return {
    caracteres: [...text].length,
    sinEspacios: [...text.replace(/\s/g, '')].length,
    palabras: words,
    frases: trimmed ? (trimmed.match(/[^.!?…]+[.!?…]+|[^.!?…]+$/g) || []).filter(s => s.trim()).length : 0,
    parrafos: trimmed ? trimmed.split(/\n\s*\n/).filter(p => p.trim()).length : 0,
    lineas: text ? text.split('\n').length : 0,
    lectura: words / WORDS_PER_MINUTE_READ,
    habla: words / WORDS_PER_MINUTE_SPEAK
  };
}

function topWords(text, limit = 5) {
  const counts = new Map();
  const cleaned = text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  for (const word of cleaned.split(/[^\p{L}\p{N}']+/u)) {
    if (word.length < 4) continue;
    counts.set(word, (counts.get(word) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
}

function formatMinutes(minutes) {
  if (minutes < 1 / 60) return t('contador.time.zero');
  if (minutes < 1) return t('contador.time.seconds', { n: Math.max(1, Math.round(minutes * 60)) });
  return t('contador.time.minutes', { n: formatNumber(minutes, { maximumFractionDigits: 1 }) });
}

/* Guardado diferido con volcado inmediato al salir: si escribes y cambias de
   pantalla enseguida, no se pierde lo ultimo escrito. */
let flush = null;

export default {
  id: 'contador-texto',

  mount(container) {
    const textarea = h('textarea.textarea', {
      rows: '12',
      placeholder: t('contador.placeholder'),
      'aria-label': t('contador.label'),
      spellcheck: 'false'
    });
    textarea.value = storage.get(KEY, '') || '';

    const grid = h('div.stats-grid');
    const times = h('p.muted.small', { 'aria-live': 'polite' });
    const frequent = h('div.row');

    const STATS = [
      ['palabras', 'contador.stat.words'],
      ['caracteres', 'contador.stat.chars'],
      ['sinEspacios', 'contador.stat.charsNoSpaces'],
      ['frases', 'contador.stat.sentences'],
      ['parrafos', 'contador.stat.paragraphs'],
      ['lineas', 'contador.stat.lines']
    ];

    function update() {
      const data = analyse(textarea.value);
      clear(grid);
      for (const [key, labelKey] of STATS) {
        grid.appendChild(h('div.stat',
          h('span.stat__value', { text: formatNumber(data[key]) }),
          h('span.stat__label', { text: t(labelKey) })
        ));
      }
      times.textContent = t('contador.times', {
        read: formatMinutes(data.lectura),
        speak: formatMinutes(data.habla)
      });

      clear(frequent);
      const top = topWords(textarea.value);
      if (top.length) {
        frequent.appendChild(h('span.small.muted', { text: t('contador.frequent') }));
        for (const [word, n] of top) {
          frequent.appendChild(h('span.chip', { text: `${word} · ${formatNumber(n)}` }));
        }
      }
    }

    let saveTimer = 0;
    flush = () => { clearTimeout(saveTimer); storage.set(KEY, textarea.value); };
    textarea.addEventListener('input', () => {
      update();
      clearTimeout(saveTimer);
      saveTimer = setTimeout(flush, 500);
    });
    window.addEventListener('pagehide', flush);

    const copyBtn = button(t('common.copy'), {
      icon: 'download',
      onClick: async () => {
        (await copyText(textarea.value)) ? toastOk(t('common.copied')) : toastError(t('common.copyFailed'));
      }
    });

    const clearBtn = button(t('contador.clear'), {
      icon: 'trash',
      onClick: async () => {
        if (!textarea.value) return;
        const ok = await confirm({
          title: t('contador.clearConfirmTitle'),
          message: t('contador.clearConfirmMessage'),
          confirmLabel: t('contador.clear'), danger: true
        });
        if (!ok) return;
        textarea.value = '';
        storage.set(KEY, '');
        update();
        textarea.focus();
      }
    });

    container.appendChild(h('div.page',
      h('header.page__header',
        h('h1.page__title', { text: t('tools.contador-texto.name') }),
        h('p.page__lead', { text: t('tools.contador-texto.desc') })
      ),
      h('div.stack',
        grid,
        times,
        frequent,
        textarea,
        h('div.row', copyBtn, clearBtn),
        notice(t('contador.hint'), { kind: 'info' })
      )
    ));

    update();
  },

  unmount() {
    if (flush) {
      window.removeEventListener('pagehide', flush);
      flush();
      flush = null;
    }
  }
};
