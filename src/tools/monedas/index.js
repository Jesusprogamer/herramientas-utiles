/**
 * Conversor de monedas.
 *
 * Se pide UNA sola tabla de tasas con base USD y a partir de ella se convierte
 * cualquier par: tasa(A→B) = rates[B] / rates[A]. Asi basta una peticion.
 *
 * Se prueban varias fuentes publicas y sin clave, en orden, hasta que una
 * responda. La ultima tabla buena se guarda en el dispositivo: sin conexion se
 * usa esa y se avisa de que puede estar desactualizada.
 *
 * El service worker nunca cachea estas peticiones (son de otro origen).
 */
import { h, clear, copyText } from '../../ui/dom.js';
import { icon } from '../../ui/icons.js';
import { button, iconButton, field, notice, emptyState } from '../../ui/components.js';
import { modal } from '../../ui/dialog.js';
import { toastOk, toastError, toast } from '../../ui/toast.js';
import * as storage from '../../core/storage.js';
import * as settings from '../../core/settings.js';
import { t, formatNumber, formatDateTime, locale } from '../../core/i18n.js';

const CACHE_KEY = 'monedas-tasas';
const PREFS_KEY = 'monedas';
const BASE = 'USD';
const FEATURED = ['ARS', 'EUR', 'USD'];

/* Fuentes de tasas, en orden de preferencia. Ninguna necesita clave. */
const PROVIDERS = [
  {
    name: 'open.er-api.com',
    url: base => `https://open.er-api.com/v6/latest/${base}`,
    parse: data => {
      if (data?.result !== 'success' || !data.rates) return null;
      return {
        rates: data.rates,
        updatedAt: data.time_last_update_unix
          ? new Date(data.time_last_update_unix * 1000).toISOString()
          : new Date().toISOString()
      };
    }
  },
  {
    name: 'currency-api (jsDelivr)',
    url: base => `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${base.toLowerCase()}.json`,
    parse: (data, base) => {
      const table = data?.[base.toLowerCase()];
      if (!table) return null;
      const rates = {};
      for (const [code, value] of Object.entries(table)) {
        if (typeof value === 'number') rates[code.toUpperCase()] = value;
      }
      return { rates, updatedAt: data.date ? `${data.date}T00:00:00Z` : new Date().toISOString() };
    }
  },
  {
    name: 'currency-api (pages.dev)',
    url: base => `https://latest.currency-api.pages.dev/v1/currencies/${base.toLowerCase()}.json`,
    parse: (data, base) => PROVIDERS[1].parse(data, base)
  }
];

async function fetchRates() {
  const problems = [];
  for (const provider of PROVIDERS) {
    try {
      const res = await fetch(provider.url(BASE), { cache: 'no-store' });
      if (!res.ok) { problems.push(`${provider.name}: HTTP ${res.status}`); continue; }
      const parsed = provider.parse(await res.json(), BASE);
      if (!parsed || !parsed.rates?.[BASE]) { problems.push(`${provider.name}: respuesta inesperada`); continue; }
      return { ...parsed, base: BASE, source: provider.name, fetchedAt: new Date().toISOString() };
    } catch (err) {
      problems.push(`${provider.name}: ${err.message}`);
    }
  }
  console.warn('[monedas] ninguna fuente respondio', problems);
  return null;
}

function currencyName(code) {
  try {
    const names = new Intl.DisplayNames([locale()], { type: 'currency' });
    const name = names.of(code);
    return name && name !== code ? name : '';
  } catch { return ''; }
}

const num = value => {
  const raw = String(value).replace(/\s/g, '').replace(',', '.');
  return raw === '' ? NaN : Number(raw);
};

export default {
  id: 'monedas',

  mount(container) {
    const prefs = storage.get(PREFS_KEY, null) || {};
    let table = storage.get(CACHE_KEY, null);
    let from = typeof prefs.from === 'string' ? prefs.from : settings.get('currency');
    let to = typeof prefs.to === 'string' ? prefs.to : (from === 'EUR' ? 'USD' : 'EUR');
    let amount = Number.isFinite(prefs.amount) ? prefs.amount : 1;
    let manualRate = null;

    const savePrefs = () => storage.set(PREFS_KEY, { from, to, amount });

    const resultValue = h('p.conv__result-value.tnum', { text: '—' });
    const resultDetail = h('p.small.muted');
    const statusRow = h('div.row');
    const warnings = h('div.stack');

    const fromBtn = h('button.btn.btn--block', { type: 'button' });
    const toBtn = h('button.btn.btn--block', { type: 'button' });

    const amountField = field({
      label: t('monedas.amount'),
      type: 'text', inputmode: 'decimal',
      value: String(amount).replace('.', ','),
      onInput: e => {
        const n = num(e.target.value);
        if (Number.isNaN(n)) { amountField.setError(t('monedas.invalidAmount')); update(); return; }
        amountField.setError('');
        amount = n;
        savePrefs();
        update();
      }
    });

    const manualField = field({
      label: t('monedas.manual.label'),
      hint: t('monedas.manual.hint'),
      type: 'text', inputmode: 'decimal', value: '',
      onInput: e => {
        const raw = e.target.value.trim();
        if (!raw) { manualRate = null; manualField.setError(''); update(); return; }
        const n = num(raw);
        if (!Number.isFinite(n) || n <= 0) { manualRate = null; manualField.setError(t('monedas.manual.invalid')); update(); return; }
        manualField.setError('');
        manualRate = n;
        update();
      }
    });

    function codes() {
      return table?.rates ? Object.keys(table.rates).sort() : [...FEATURED];
    }

    function rateFor(a, b) {
      if (manualRate) return manualRate;
      if (!table?.rates) return null;
      const ra = table.rates[a];
      const rb = table.rates[b];
      if (!Number.isFinite(ra) || !Number.isFinite(rb) || ra === 0) return null;
      return rb / ra;
    }

    function labelFor(code) {
      const name = currencyName(code);
      return name ? `${code} · ${name}` : code;
    }

    function openPicker(which) {
      modal({
        title: t(which === 'from' ? 'monedas.pick.from' : 'monedas.pick.to'),
        render: close => {
          const list = h('div.currency-list');
          const search = h('input.input', {
            type: 'search',
            placeholder: t('monedas.pick.search'),
            'aria-label': t('monedas.pick.search')
          });

          const paint = () => {
            clear(list);
            const q = search.value.trim().toLowerCase();
            const all = codes();
            const featured = FEATURED.filter(c => all.includes(c));
            const rest = all.filter(c => !featured.includes(c));
            const match = c => !q || c.toLowerCase().includes(q) || currencyName(c).toLowerCase().includes(q);
            const shown = [...featured, ...rest].filter(match);

            if (!shown.length) {
              list.appendChild(h('p.small.muted', { text: t('monedas.pick.none') }));
              return;
            }
            for (const code of shown) {
              const current = (which === 'from' ? from : to) === code;
              list.appendChild(h('button', {
                type: 'button',
                'aria-current': current ? 'true' : null,
                onClick: () => {
                  if (which === 'from') from = code; else to = code;
                  savePrefs();
                  refreshButtons();
                  update();
                  close();
                }
              },
                h('span.code', { text: code }),
                h('span.muted', { text: currencyName(code) || '' })
              ));
            }
          };

          search.addEventListener('input', paint);
          paint();
          return h('div.stack', search, list);
        }
      });
    }

    fromBtn.addEventListener('click', () => openPicker('from'));
    toBtn.addEventListener('click', () => openPicker('to'));

    function refreshButtons() {
      clear(fromBtn); fromBtn.appendChild(document.createTextNode(labelFor(from)));
      fromBtn.setAttribute('aria-label', t('monedas.pick.fromCurrent', { code: labelFor(from) }));
      clear(toBtn); toBtn.appendChild(document.createTextNode(labelFor(to)));
      toBtn.setAttribute('aria-label', t('monedas.pick.toCurrent', { code: labelFor(to) }));
    }

    const featuredRow = (which) => {
      const row = h('div.row');
      for (const code of FEATURED) {
        row.appendChild(button(code, {
          class: 'btn--sm',
          onClick: () => {
            if (which === 'from') from = code; else to = code;
            savePrefs(); refreshButtons(); update();
          }
        }));
      }
      return row;
    };

    const swapBtn = button(t('monedas.swap'), {
      icon: 'refresh',
      onClick: () => { [from, to] = [to, from]; savePrefs(); refreshButtons(); update(); }
    });

    const copyBtn = iconButton('download', t('common.copy'), {
      onClick: async () => {
        (await copyText(resultValue.textContent))
          ? toastOk(t('common.copied')) : toastError(t('common.copyFailed'));
      }
    });

    const refreshBtn = button(t('monedas.refresh'), { icon: 'refresh', onClick: () => load({ force: true }) });

    function update() {
      const rate = rateFor(from, to);
      if (!Number.isFinite(amount) || rate === null) {
        resultValue.textContent = '—';
        resultDetail.textContent = table ? '' : t('monedas.noRates');
        return;
      }
      const out = amount * rate;
      resultValue.textContent = `${formatNumber(out, { maximumFractionDigits: out < 1 ? 6 : 2 })} ${to}`;
      resultDetail.textContent = t('monedas.rateLine', {
        from, to, rate: formatNumber(rate, { maximumFractionDigits: rate < 1 ? 6 : 4 })
      }) + (manualRate ? ` · ${t('monedas.manual.inUse')}` : '');
    }

    function paintStatus({ loading = false, failed = false } = {}) {
      clear(statusRow);
      clear(warnings);

      if (loading) {
        statusRow.appendChild(h('span.small.muted', { text: t('monedas.loading') }));
        return;
      }

      if (table?.updatedAt) {
        statusRow.appendChild(h('span.small.muted', {
          text: t('monedas.updated', { when: formatDateTime(table.updatedAt), source: table.source || '' })
        }));
      }
      statusRow.appendChild(h('span.grow'));
      statusRow.appendChild(refreshBtn);

      const stale = table?.fetchedAt && (Date.now() - new Date(table.fetchedAt).getTime()) > 36 * 3600 * 1000;

      if (!table) {
        warnings.appendChild(notice(t('monedas.error.noData'), { kind: 'danger' }));
      } else if (failed || !navigator.onLine) {
        warnings.appendChild(notice(t('monedas.error.offline'), { kind: 'warning' }));
      } else if (stale) {
        warnings.appendChild(notice(t('monedas.error.stale'), { kind: 'warning' }));
      }
      warnings.appendChild(notice(t('monedas.disclaimer'), { kind: 'info' }));
    }

    async function load({ force = false } = {}) {
      const fresh = table?.fetchedAt && (Date.now() - new Date(table.fetchedAt).getTime()) < 3600 * 1000;
      if (!force && fresh) { paintStatus(); update(); return; }

      paintStatus({ loading: true });
      const result = await fetchRates();
      if (result) {
        table = result;
        storage.set(CACHE_KEY, table);
        paintStatus();
        if (force) toastOk(t('monedas.refreshed'));
      } else {
        paintStatus({ failed: true });
        if (force) toastError(t('monedas.error.fetch'));
      }
      refreshButtons();
      update();
    }

    refreshButtons();

    container.appendChild(h('div.page',
      h('header.page__header',
        h('h1.page__title', { text: t('tools.monedas.name') }),
        h('p.page__lead', { text: t('tools.monedas.desc') })
      ),
      h('div.stack',
        amountField,
        h('div.tool-cols.tool-cols--2',
          h('div.stack',
            h('span.field__label', { text: t('monedas.from') }),
            fromBtn, featuredRow('from')
          ),
          h('div.stack',
            h('span.field__label', { text: t('monedas.to') }),
            toBtn, featuredRow('to')
          )
        ),
        h('div.conv__swap', swapBtn),
        h('div.conv__result', h('div.row', h('div.grow', resultValue, resultDetail), copyBtn)),
        statusRow,
        h('details', h('summary', { text: t('monedas.manual.summary') }), h('div.stack', manualField)),
        warnings
      )
    ));

    paintStatus();
    update();
    load();
  },

  unmount() {}
};
