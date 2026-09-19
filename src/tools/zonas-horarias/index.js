/**
 * Zonas horarias.
 *
 * Solo con la API Intl del navegador: ni librerias ni peticiones a internet,
 * asi funciona sin conexion y respeta el horario de verano de cada zona
 * (los desplazamientos se calculan para la fecha concreta, no con una tabla fija).
 */
import { h, clear, copyText } from '../../ui/dom.js';
import { icon } from '../../ui/icons.js';
import { button, iconButton, field, emptyState, notice, tabs } from '../../ui/components.js';
import { modal } from '../../ui/dialog.js';
import { toastOk, toastError } from '../../ui/toast.js';
import * as storage from '../../core/storage.js';
import * as settings from '../../core/settings.js';
import { t, locale } from '../../core/i18n.js';

const KEY = 'zonas-horarias';

/* Respaldo por si el navegador no tiene Intl.supportedValuesOf. */
const FALLBACK_ZONES = [
  'Africa/Cairo', 'Africa/Casablanca', 'Africa/Johannesburg', 'Africa/Lagos', 'Africa/Nairobi',
  'America/Argentina/Buenos_Aires', 'America/Bogota', 'America/Caracas', 'America/Chicago',
  'America/Denver', 'America/Halifax', 'America/Lima', 'America/Los_Angeles', 'America/Mexico_City',
  'America/Montevideo', 'America/New_York', 'America/Panama', 'America/Santiago', 'America/Sao_Paulo',
  'America/Toronto', 'America/Vancouver', 'Asia/Bangkok', 'Asia/Dubai', 'Asia/Hong_Kong',
  'Asia/Jakarta', 'Asia/Jerusalem', 'Asia/Kolkata', 'Asia/Manila', 'Asia/Seoul', 'Asia/Shanghai',
  'Asia/Singapore', 'Asia/Tokyo', 'Australia/Melbourne', 'Australia/Perth', 'Australia/Sydney',
  'Europe/Amsterdam', 'Europe/Athens', 'Europe/Berlin', 'Europe/Brussels', 'Europe/Bucharest',
  'Europe/Dublin', 'Europe/Helsinki', 'Europe/Istanbul', 'Europe/Lisbon', 'Europe/London',
  'Europe/Madrid', 'Europe/Moscow', 'Europe/Oslo', 'Europe/Paris', 'Europe/Prague', 'Europe/Rome',
  'Europe/Stockholm', 'Europe/Vienna', 'Europe/Warsaw', 'Europe/Zurich', 'Pacific/Auckland',
  'Pacific/Honolulu', 'UTC'
];

function allZones() {
  try {
    if (typeof Intl.supportedValuesOf === 'function') {
      const list = Intl.supportedValuesOf('timeZone');
      if (Array.isArray(list) && list.length) return list;
    }
  } catch { /* sin soporte */ }
  return FALLBACK_ZONES;
}

function myZone() {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; }
  catch { return 'UTC'; }
}

/** Nombre legible: "Buenos Aires" a partir de "America/Argentina/Buenos_Aires". */
function zoneLabel(tz) {
  const parts = tz.split('/');
  return parts[parts.length - 1].replace(/_/g, ' ');
}

function zoneRegion(tz) {
  const parts = tz.split('/');
  return parts.length > 1 ? parts.slice(0, -1).join(' · ').replace(/_/g, ' ') : '';
}

/** Desplazamiento real de la zona en esa fecha, en minutos (con horario de verano). */
function offsetMinutes(tz, date = new Date()) {
  try {
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hour12: false,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
    const p = Object.fromEntries(dtf.formatToParts(date).map(x => [x.type, x.value]));
    const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second);
    return Math.round((asUTC - date.getTime()) / 60000);
  } catch { return 0; }
}

/** Instante real a partir de una hora de pared en una zona (dos pasadas por el cambio de hora). */
function wallTimeToInstant(tz, y, month, d, hh, mm) {
  const guess = Date.UTC(y, month - 1, d, hh, mm);
  const first = guess - offsetMinutes(tz, new Date(guess)) * 60000;
  return guess - offsetMinutes(tz, new Date(first)) * 60000;
}

function formatOffsetDiff(minutes) {
  if (minutes === 0) return t('zonas.sameTime');
  const sign = minutes > 0 ? '+' : '−';
  const abs = Math.abs(minutes);
  const hours = Math.floor(abs / 60);
  const mins = abs % 60;
  const value = mins ? `${hours}:${String(mins).padStart(2, '0')}` : String(hours);
  return t(minutes > 0 ? 'zonas.ahead' : 'zonas.behind', { diff: `${sign}${value}` });
}

/** Hora local en esa zona, en minutos desde medianoche. */
function localMinutes(tz, date = new Date()) {
  try {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hour12: false, hour: '2-digit', minute: '2-digit'
    }).formatToParts(date).map(x => [x.type, x.value]));
    return (+p.hour % 24) * 60 + (+p.minute);
  } catch { return 12 * 60; }
}

const isDaytime = (tz, date) => {
  const m = localMinutes(tz, date);
  return m >= 7 * 60 && m < 20 * 60;
};

/** Respeta el ajuste de 12/24 h; "automatico" lo deja en manos del idioma. */
function hour12() {
  const pref = settings.get('timeFormat');
  if (pref === '12') return true;
  if (pref === '24') return false;
  return undefined;
}

function timeIn(tz, date) {
  try {
    return new Intl.DateTimeFormat(locale(), {
      timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: hour12()
    }).format(date);
  } catch { return '—'; }
}

function dateIn(tz, date) {
  try {
    return new Intl.DateTimeFormat(locale(), {
      timeZone: tz, weekday: 'short', day: 'numeric', month: 'short'
    }).format(date);
  } catch { return ''; }
}

export default {
  id: 'zonas-horarias',

  mount(container) {
    const mine = myZone();
    let zones = storage.get(KEY, []);
    if (!Array.isArray(zones)) zones = [];
    zones = zones.filter(z => typeof z === 'string' && z !== mine);

    const save = () => storage.set(KEY, zones);
    let ticker = 0;
    let refs = [];          // filas de la pestaña "reloj"
    let convertInstant = null;

    /* ---------- selector de zona ---------- */
    function openPicker() {
      modal({
        title: t('zonas.add'),
        render: close => {
          const list = h('div.currency-list');
          const search = h('input.input', {
            type: 'search', placeholder: t('zonas.searchPlaceholder'), 'aria-label': t('zonas.searchLabel')
          });
          const paint = () => {
            clear(list);
            const q = search.value.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
            const shown = allZones()
              .filter(tz => tz !== mine && !zones.includes(tz))
              .filter(tz => !q || tz.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(q))
              .slice(0, 300);
            if (!shown.length) {
              list.appendChild(h('p.small.muted', { text: t('zonas.noResults') }));
              return;
            }
            for (const tz of shown) {
              list.appendChild(h('button', {
                type: 'button',
                onClick: () => { zones.push(tz); save(); close(); paintClock(); paintConverter(); }
              },
                h('span', { text: zoneLabel(tz) }),
                h('span.muted.small', { text: zoneRegion(tz) })
              ));
            }
          };
          search.addEventListener('input', paint);
          paint();
          return h('div.stack', search, list);
        }
      });
    }

    /* ---------- pestaña: reloj ---------- */
    const clockPanel = h('div.stack');

    function zoneRow(tz, { isMine = false } = {}) {
      const time = h('span.zone__time.tnum');
      const date = h('span.zone__date');
      const meta = h('span.zone__meta');
      const row = h(`div.zone${isMine ? '.zone--mine' : ''}`,
        h('div.zone__main',
          h('span.zone__name', { text: isMine ? t('zonas.myZone', { name: zoneLabel(tz) }) : zoneLabel(tz) }),
          meta
        ),
        h('div', { style: { textAlign: 'right' } }, time, date),
        isMine ? null : iconButton('trash', t('zonas.remove', { name: zoneLabel(tz) }), {
          onClick: () => { zones = zones.filter(z => z !== tz); save(); paintClock(); paintConverter(); }
        })
      );

      const refresh = (now = new Date()) => {
        time.textContent = timeIn(tz, now);
        date.textContent = dateIn(tz, now);
        clear(meta);
        const day = isDaytime(tz, now);
        const sun = icon(day ? 'sun' : 'moon');
        meta.appendChild(h('span.daynight', sun, h('span', { text: t(day ? 'zonas.day' : 'zonas.night') })));
        if (!isMine) {
          const diff = offsetMinutes(tz, now) - offsetMinutes(mine, now);
          meta.appendChild(h('span', { text: formatOffsetDiff(diff) }));
        }
        meta.appendChild(h('span.faint', { text: zoneRegion(tz) }));
      };
      refresh();
      return { row, refresh };
    }

    function paintClock() {
      clear(clockPanel);
      refs = [];

      const mineRef = zoneRow(mine, { isMine: true });
      refs.push(mineRef);
      clockPanel.appendChild(mineRef.row);

      if (!zones.length) {
        clockPanel.appendChild(emptyState({
          iconName: 'globe',
          title: t('zonas.empty.title'),
          message: t('zonas.empty.message'),
          action: button(t('zonas.add'), { variant: 'primary', onClick: openPicker })
        }));
      } else {
        for (const tz of zones) {
          const ref = zoneRow(tz);
          refs.push(ref);
          clockPanel.appendChild(ref.row);
        }
        clockPanel.appendChild(h('div.row',
          button(t('zonas.add'), { variant: 'primary', icon: 'globe', onClick: openPicker }),
          button(t('zonas.copy'), {
            icon: 'download',
            onClick: async () => {
              const now = new Date();
              const text = [mine, ...zones]
                .map(tz => `${zoneLabel(tz)}: ${timeIn(tz, now)} (${dateIn(tz, now)})`).join('\n');
              (await copyText(text)) ? toastOk(t('common.copied')) : toastError(t('common.copyFailed'));
            }
          })
        ));
      }
    }

    /* ---------- pestaña: convertir ---------- */
    const convertPanel = h('div.stack');

    function paintConverter() {
      clear(convertPanel);

      const now = new Date();
      const pad = n => String(n).padStart(2, '0');
      const dateInput = h('input.input', {
        type: 'date', 'aria-label': t('zonas.convert.date'),
        value: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
      });
      const timeInput = h('input.input', {
        type: 'time', 'aria-label': t('zonas.convert.time'),
        value: `${pad(now.getHours())}:${pad(now.getMinutes())}`
      });

      const sourceSel = h('select.select', { 'aria-label': t('zonas.convert.source') });
      for (const tz of [mine, ...zones]) {
        sourceSel.appendChild(h('option', { value: tz, text: tz === mine ? t('zonas.myZone', { name: zoneLabel(tz) }) : zoneLabel(tz) }));
      }

      const results = h('div.stack');

      function recompute() {
        clear(results);
        const [y, mo, d] = dateInput.value.split('-').map(Number);
        const [hh, mm] = timeInput.value.split(':').map(Number);
        if (![y, mo, d, hh, mm].every(Number.isFinite)) {
          results.appendChild(notice(t('zonas.convert.invalid'), { kind: 'warning' }));
          convertInstant = null;
          return;
        }
        const instant = new Date(wallTimeToInstant(sourceSel.value, y, mo, d, hh, mm));
        convertInstant = instant;

        const targets = [mine, ...zones].filter(tz => tz !== sourceSel.value);
        if (!targets.length) {
          results.appendChild(notice(t('zonas.convert.addMore'), { kind: 'info' }));
          return;
        }
        for (const tz of targets) {
          const day = isDaytime(tz, instant);
          const diff = offsetMinutes(tz, instant) - offsetMinutes(sourceSel.value, instant);
          results.appendChild(h('div.zone',
            h('div.zone__main',
              h('span.zone__name', { text: tz === mine ? t('zonas.myZone', { name: zoneLabel(tz) }) : zoneLabel(tz) }),
              h('span.zone__meta',
                h('span.daynight', icon(day ? 'sun' : 'moon'), h('span', { text: t(day ? 'zonas.day' : 'zonas.night') })),
                h('span', { text: formatOffsetDiff(diff) })
              )
            ),
            h('div', { style: { textAlign: 'right' } },
              h('span.zone__time.tnum', { text: timeIn(tz, instant) }),
              h('span.zone__date', { text: dateIn(tz, instant) })
            )
          ));
        }
      }

      dateInput.addEventListener('input', recompute);
      timeInput.addEventListener('input', recompute);
      sourceSel.addEventListener('change', recompute);

      convertPanel.append(
        h('div.field', h('span.field__label', { text: t('zonas.convert.source') }), sourceSel),
        h('div.tool-cols.tool-cols--2',
          h('div.field', h('span.field__label', { text: t('zonas.convert.date') }), dateInput),
          h('div.field', h('span.field__label', { text: t('zonas.convert.time') }), timeInput)
        ),
        h('div.row',
          button(t('zonas.convert.now'), {
            icon: 'clock',
            onClick: () => {
              const d = new Date();
              dateInput.value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
              timeInput.value = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
              recompute();
            }
          }),
          button(t('zonas.copy'), {
            icon: 'download',
            onClick: async () => {
              if (!convertInstant) return;
              const text = [sourceSel.value, ...[mine, ...zones].filter(tz => tz !== sourceSel.value)]
                .map(tz => `${zoneLabel(tz)}: ${timeIn(tz, convertInstant)} (${dateIn(tz, convertInstant)})`).join('\n');
              (await copyText(text)) ? toastOk(t('common.copied')) : toastError(t('common.copyFailed'));
            }
          })
        ),
        results
      );
      recompute();
    }

    container.appendChild(h('div.page',
      h('header.page__header',
        h('h1.page__title', { text: t('tools.zonas-horarias.name') }),
        h('p.page__lead', { text: t('tools.zonas-horarias.desc') })
      ),
      tabs({
        label: t('tools.zonas-horarias.name'),
        items: [
          { id: 'reloj', label: t('zonas.tab.clock'), render: panel => { panel.appendChild(clockPanel); paintClock(); } },
          { id: 'convertir', label: t('zonas.tab.convert'), render: panel => { panel.appendChild(convertPanel); paintConverter(); } }
        ]
      }),
      notice(t('zonas.hint'), { kind: 'info' })
    ));

    ticker = setInterval(() => {
      const now = new Date();
      for (const ref of refs) ref.refresh(now);
    }, 1000);

    this._ticker = ticker;
  },

  unmount() {
    if (this._ticker) { clearInterval(this._ticker); this._ticker = 0; }
  }
};
