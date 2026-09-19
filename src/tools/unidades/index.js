/**
 * Conversor de unidades.
 *
 * Cada categoria define una unidad base y el factor de cada unidad respecto a
 * ella. La temperatura no es proporcional (tiene desplazamiento), asi que usa
 * funciones de ida y vuelta en lugar de un factor.
 */
import { h, clear, copyText } from '../../ui/dom.js';
import { button, iconButton, select, field, notice } from '../../ui/components.js';
import { toastOk, toastError } from '../../ui/toast.js';
import * as storage from '../../core/storage.js';
import * as settings from '../../core/settings.js';
import { t, formatNumber } from '../../core/i18n.js';

const KEY = 'unidades';

/* u: [codigo, simbolo, factor a la unidad base] */
const CATEGORIES = {
  longitud: {
    base: 'm',
    metric: ['km', 'm'], imperial: ['mi', 'km'],
    units: [
      ['mm', 'mm', 0.001], ['cm', 'cm', 0.01], ['m', 'm', 1], ['km', 'km', 1000],
      ['in', 'in', 0.0254], ['ft', 'ft', 0.3048], ['yd', 'yd', 0.9144],
      ['mi', 'mi', 1609.344], ['nmi', 'nmi', 1852]
    ]
  },
  masa: {
    base: 'kg',
    metric: ['kg', 'g'], imperial: ['lb', 'kg'],
    units: [
      ['mg', 'mg', 1e-6], ['g', 'g', 0.001], ['kg', 'kg', 1], ['t', 't', 1000],
      ['oz', 'oz', 0.028349523125], ['lb', 'lb', 0.45359237], ['st', 'st', 6.35029318]
    ]
  },
  temperatura: {
    base: 'c',
    metric: ['c', 'f'], imperial: ['f', 'c'],
    units: [['c', '°C', 1], ['f', '°F', 1], ['k', 'K', 1]],
    toBase: { c: v => v, f: v => (v - 32) * 5 / 9, k: v => v - 273.15 },
    fromBase: { c: v => v, f: v => v * 9 / 5 + 32, k: v => v + 273.15 }
  },
  volumen: {
    base: 'l',
    metric: ['l', 'ml'], imperial: ['galus', 'l'],
    units: [
      ['ml', 'ml', 0.001], ['cl', 'cl', 0.01], ['l', 'l', 1], ['m3', 'm³', 1000],
      ['tsp', 'tsp', 0.00492892159375], ['tbsp', 'tbsp', 0.01478676478125],
      ['floz', 'fl oz', 0.0295735295625], ['cup', 'cup', 0.2365882365],
      ['pt', 'pt', 0.473176473], ['qt', 'qt', 0.946352946],
      ['galus', 'gal (US)', 3.785411784], ['galuk', 'gal (UK)', 4.54609]
    ]
  },
  superficie: {
    base: 'm2',
    metric: ['m2', 'ha'], imperial: ['ft2', 'm2'],
    units: [
      ['cm2', 'cm²', 0.0001], ['m2', 'm²', 1], ['ha', 'ha', 10000], ['km2', 'km²', 1e6],
      ['in2', 'in²', 0.00064516], ['ft2', 'ft²', 0.09290304], ['yd2', 'yd²', 0.83612736],
      ['acre', 'acre', 4046.8564224], ['mi2', 'mi²', 2589988.110336]
    ]
  },
  velocidad: {
    base: 'ms',
    metric: ['kmh', 'ms'], imperial: ['mph', 'kn'],
    units: [
      ['ms', 'm/s', 1], ['kmh', 'km/h', 1 / 3.6], ['mph', 'mph', 0.44704],
      ['fts', 'ft/s', 0.3048], ['kn', 'kn', 0.514444444444]
    ]
  },
  tiempo: {
    base: 's',
    metric: ['h', 'min'], imperial: ['h', 'min'],
    units: [
      ['ms', 'ms', 0.001], ['s', 's', 1], ['min', 'min', 60], ['h', 'h', 3600],
      ['d', 'd', 86400], ['wk', 'wk', 604800], ['mo', 'mo', 2629800], ['yr', 'yr', 31557600]
    ]
  },
  datos: {
    base: 'b',
    metric: ['mb', 'gb'], imperial: ['mb', 'gb'],
    units: [
      ['bit', 'bit', 0.125], ['b', 'B', 1],
      ['kb', 'kB', 1e3], ['mb', 'MB', 1e6], ['gb', 'GB', 1e9], ['tb', 'TB', 1e12],
      ['kib', 'KiB', 1024], ['mib', 'MiB', 1048576], ['gib', 'GiB', 1073741824], ['tib', 'TiB', 1099511627776]
    ]
  },
  presion: {
    base: 'pa',
    metric: ['bar', 'pa'], imperial: ['psi', 'bar'],
    units: [
      ['pa', 'Pa', 1], ['hpa', 'hPa', 100], ['kpa', 'kPa', 1000], ['bar', 'bar', 100000],
      ['atm', 'atm', 101325], ['psi', 'psi', 6894.757293168], ['mmhg', 'mmHg', 133.322387415]
    ]
  },
  energia: {
    base: 'j',
    metric: ['kj', 'kcal'], imperial: ['kcal', 'btu'],
    units: [
      ['j', 'J', 1], ['kj', 'kJ', 1000], ['cal', 'cal', 4.184], ['kcal', 'kcal', 4184],
      ['wh', 'Wh', 3600], ['kwh', 'kWh', 3.6e6], ['btu', 'BTU', 1055.05585262]
    ]
  }
};

const CATEGORY_IDS = Object.keys(CATEGORIES);

function convert(categoryId, value, from, to) {
  const cat = CATEGORIES[categoryId];
  if (cat.toBase) return cat.fromBase[to](cat.toBase[from](value));
  const factor = code => cat.units.find(u => u[0] === code)?.[2] ?? 1;
  return value * factor(from) / factor(to);
}

/** Notacion adecuada al tamaño: nada de "0,00" para 0,000001. */
function pretty(n) {
  if (!Number.isFinite(n)) return '—';
  const abs = Math.abs(n);
  if (abs !== 0 && (abs < 1e-4 || abs >= 1e12)) {
    return n.toExponential(4).replace('.', ',');
  }
  const decimals = abs >= 100 ? 2 : abs >= 1 ? 4 : 6;
  return formatNumber(Number(n.toFixed(decimals)), { maximumFractionDigits: decimals });
}

function unitLabel(categoryId, code) {
  const symbol = CATEGORIES[categoryId].units.find(u => u[0] === code)?.[1] || code;
  const name = t(`unidades.u.${categoryId}.${code}`);
  return name && name !== `unidades.u.${categoryId}.${code}` ? `${symbol} · ${name}` : symbol;
}

export default {
  id: 'unidades',

  mount(container) {
    const saved = storage.get(KEY, null) || {};
    const imperial = settings.get('units') === 'imperial';

    let categoryId = CATEGORY_IDS.includes(saved.category) ? saved.category : 'longitud';
    let cat = CATEGORIES[categoryId];
    let from = saved.from && cat.units.some(u => u[0] === saved.from) ? saved.from : (imperial ? cat.imperial[0] : cat.metric[0]);
    let to = saved.to && cat.units.some(u => u[0] === saved.to) ? saved.to : (imperial ? cat.imperial[1] : cat.metric[1]);
    let value = Number.isFinite(saved.value) ? saved.value : 1;

    const persist = () => storage.set(KEY, { category: categoryId, from, to, value });

    const valueField = field({
      label: t('unidades.value'),
      type: 'text', inputmode: 'decimal',
      value: String(value).replace('.', ','),
      onInput: e => {
        const raw = e.target.value.replace(',', '.').trim();
        const n = Number(raw);
        if (raw === '' || !Number.isFinite(n)) { valueField.setError(t('unidades.invalid')); result.textContent = '—'; clear(table); return; }
        valueField.setError('');
        value = n;
        persist();
        update();
      }
    });

    const fromSel = h('select.select', { 'aria-label': t('unidades.from') });
    const toSel = h('select.select', { 'aria-label': t('unidades.to') });

    function fillUnitSelects() {
      for (const [sel, current] of [[fromSel, from], [toSel, to]]) {
        clear(sel);
        for (const [code] of cat.units) {
          sel.appendChild(h('option', { value: code, selected: code === current, text: unitLabel(categoryId, code) }));
        }
      }
    }

    fromSel.addEventListener('change', () => { from = fromSel.value; persist(); update(); });
    toSel.addEventListener('change', () => { to = toSel.value; persist(); update(); });

    const result = h('p.conv__result-value.tnum');
    const resultUnit = h('p.small.muted');
    const table = h('div.conv__table');

    const copyBtn = iconButton('download', t('common.copy'), {
      onClick: async () => {
        const ok = await copyText(result.textContent.replace(/\s/g, ' '));
        ok ? toastOk(t('common.copied')) : toastError(t('common.copyFailed'));
      }
    });

    function update() {
      const out = convert(categoryId, value, from, to);
      result.textContent = `${pretty(out)} ${cat.units.find(u => u[0] === to)[1]}`;
      resultUnit.textContent = t('unidades.summary', {
        value: pretty(value),
        from: cat.units.find(u => u[0] === from)[1],
        to: cat.units.find(u => u[0] === to)[1]
      });

      clear(table);
      for (const [code, symbol] of cat.units) {
        if (code === to) continue;
        table.appendChild(h('div.conv__table-row',
          h('span.muted', { text: `${symbol} · ${t(`unidades.u.${categoryId}.${code}`)}` }),
          h('span.tnum', { text: pretty(convert(categoryId, value, from, code)) })
        ));
      }
    }

    function setCategory(id) {
      categoryId = id;
      cat = CATEGORIES[id];
      from = imperial ? cat.imperial[0] : cat.metric[0];
      to = imperial ? cat.imperial[1] : cat.metric[1];
      fillUnitSelects();
      persist();
      update();
    }

    const categorySel = select({
      label: t('unidades.category'),
      value: categoryId,
      options: CATEGORY_IDS.map(id => ({ value: id, label: t(`unidades.cat.${id}`) })),
      onChange: e => setCategory(e.target.value)
    });

    const swapBtn = button(t('unidades.swap'), {
      icon: 'refresh',
      onClick: () => {
        [from, to] = [to, from];
        fromSel.value = from;
        toSel.value = to;
        persist();
        update();
      }
    });

    fillUnitSelects();

    container.appendChild(h('div.page',
      h('header.page__header',
        h('h1.page__title', { text: t('tools.unidades.name') }),
        h('p.page__lead', { text: t('tools.unidades.desc') })
      ),
      h('div.stack',
        categorySel,
        h('div.conv',
          valueField,
          h('div.tool-cols.tool-cols--2',
            h('div.field', h('span.field__label', { text: t('unidades.from') }), fromSel),
            h('div.field', h('span.field__label', { text: t('unidades.to') }), toSel)
          ),
          h('div.conv__swap', swapBtn),
          h('div.conv__result',
            h('div.row', h('div.grow', result, resultUnit), copyBtn)
          )
        ),
        h('details',
          h('summary', { text: t('unidades.allUnits') }),
          table
        ),
        notice(t('unidades.hint'), { kind: 'info' })
      )
    ));

    update();
  },

  unmount() {}
};
