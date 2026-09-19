/**
 * Calculadora de porcentajes: varios cálculos habituales en un solo sitio.
 * Todo se recalcula al escribir, sin botones.
 */
import { h, clear, copyText } from '../../ui/dom.js';
import { select, field, notice, iconButton } from '../../ui/components.js';
import { toastOk, toastError } from '../../ui/toast.js';
import * as storage from '../../core/storage.js';
import { t, formatNumber } from '../../core/i18n.js';

const KEY = 'porcentajes';

/** Acepta coma o punto como separador decimal. */
function num(value) {
  const raw = String(value).replace(/\s/g, '').replace(',', '.');
  if (raw === '') return NaN;
  const n = Number(raw);
  return Number.isFinite(n) ? n : NaN;
}

const fmt = n => Number.isFinite(n)
  ? formatNumber(Number(n.toFixed(6)), { maximumFractionDigits: 4 })
  : '—';

/* Cada modo declara sus campos y como se calcula el resultado. */
const MODES = {
  deQue: {
    fields: [['pct', 'porcentajes.f.percent'], ['total', 'porcentajes.f.of']],
    compute: ({ pct, total }) => ({
      main: fmt(total * pct / 100),
      detail: 'porcentajes.r.deQue',
      params: { pct: fmt(pct), total: fmt(total), result: fmt(total * pct / 100) }
    })
  },
  queporcentaje: {
    fields: [['part', 'porcentajes.f.part'], ['total', 'porcentajes.f.total']],
    compute: ({ part, total }) => {
      const r = total === 0 ? NaN : part / total * 100;
      return { main: `${fmt(r)} %`, detail: 'porcentajes.r.queporcentaje', params: { part: fmt(part), total: fmt(total), result: fmt(r) } };
    }
  },
  aumentar: {
    fields: [['base', 'porcentajes.f.amount'], ['pct', 'porcentajes.f.increase']],
    compute: ({ base, pct }) => ({
      main: fmt(base * (1 + pct / 100)),
      detail: 'porcentajes.r.aumentar',
      params: { base: fmt(base), pct: fmt(pct), diff: fmt(base * pct / 100), result: fmt(base * (1 + pct / 100)) }
    })
  },
  descontar: {
    fields: [['base', 'porcentajes.f.price'], ['pct', 'porcentajes.f.discount']],
    compute: ({ base, pct }) => ({
      main: fmt(base * (1 - pct / 100)),
      detail: 'porcentajes.r.descontar',
      params: { base: fmt(base), pct: fmt(pct), diff: fmt(base * pct / 100), result: fmt(base * (1 - pct / 100)) }
    })
  },
  variacion: {
    fields: [['from', 'porcentajes.f.from'], ['to', 'porcentajes.f.to']],
    compute: ({ from, to }) => {
      const r = from === 0 ? NaN : (to - from) / Math.abs(from) * 100;
      const key = !Number.isFinite(r) ? 'porcentajes.r.variacionCero'
        : r > 0 ? 'porcentajes.r.variacionSube'
          : r < 0 ? 'porcentajes.r.variacionBaja' : 'porcentajes.r.variacionIgual';
      return {
        main: `${r > 0 ? '+' : ''}${fmt(r)} %`,
        detail: key,
        params: { from: fmt(from), to: fmt(to), pct: fmt(Math.abs(r)), diff: fmt(Math.abs(to - from)) }
      };
    }
  },
  impuesto: {
    fields: [['base', 'porcentajes.f.netPrice'], ['pct', 'porcentajes.f.taxRate']],
    compute: ({ base, pct }) => ({
      main: fmt(base * (1 + pct / 100)),
      detail: 'porcentajes.r.impuesto',
      params: { base: fmt(base), pct: fmt(pct), tax: fmt(base * pct / 100), result: fmt(base * (1 + pct / 100)) }
    })
  },
  sinImpuesto: {
    fields: [['gross', 'porcentajes.f.grossPrice'], ['pct', 'porcentajes.f.taxRate']],
    compute: ({ gross, pct }) => {
      const base = gross / (1 + pct / 100);
      return {
        main: fmt(base),
        detail: 'porcentajes.r.sinImpuesto',
        params: { gross: fmt(gross), pct: fmt(pct), tax: fmt(gross - base), result: fmt(base) }
      };
    }
  }
};

const MODE_IDS = Object.keys(MODES);

export default {
  id: 'porcentajes',

  mount(container) {
    const saved = storage.get(KEY, null) || {};
    let modeId = MODE_IDS.includes(saved.mode) ? saved.mode : 'deQue';

    const form = h('div.stack');
    const resultValue = h('p.conv__result-value.tnum', { text: '—' });
    const resultDetail = h('p.small.muted');
    const inputs = new Map();

    const copyBtn = iconButton('download', t('common.copy'), {
      onClick: async () => {
        (await copyText(resultValue.textContent))
          ? toastOk(t('common.copied')) : toastError(t('common.copyFailed'));
      }
    });

    function compute() {
      const mode = MODES[modeId];
      const values = {};
      let complete = true;
      for (const [name] of mode.fields) {
        const raw = inputs.get(name).input.value;
        const n = num(raw);
        if (Number.isNaN(n)) { complete = false; inputs.get(name).setError(raw.trim() ? t('porcentajes.invalid') : ''); }
        else inputs.get(name).setError('');
        values[name] = n;
      }
      if (!complete) { resultValue.textContent = '—'; resultDetail.textContent = ''; return; }

      const { main, detail, params } = mode.compute(values);
      resultValue.textContent = main;
      resultDetail.textContent = t(detail, params);
    }

    function buildForm() {
      clear(form);
      inputs.clear();
      for (const [name, labelKey] of MODES[modeId].fields) {
        const f = field({
          label: t(labelKey),
          type: 'text', inputmode: 'decimal',
          value: '',
          onInput: compute
        });
        inputs.set(name, f);
        form.appendChild(f);
      }
      compute();
      inputs.values().next().value?.input.focus({ preventScroll: true });
    }

    const modeSelect = select({
      label: t('porcentajes.modeLabel'),
      value: modeId,
      options: MODE_IDS.map(id => ({ value: id, label: t(`porcentajes.mode.${id}`) })),
      onChange: e => {
        modeId = e.target.value;
        storage.set(KEY, { mode: modeId });
        buildForm();
      }
    });

    container.appendChild(h('div.page',
      h('header.page__header',
        h('h1.page__title', { text: t('tools.porcentajes.name') }),
        h('p.page__lead', { text: t('tools.porcentajes.desc') })
      ),
      h('div.stack',
        modeSelect,
        form,
        h('div.conv__result', h('div.row', h('div.grow', resultValue, resultDetail), copyBtn)),
        notice(t('porcentajes.hint'), { kind: 'info' })
      )
    ));

    buildForm();
  },

  unmount() {}
};
