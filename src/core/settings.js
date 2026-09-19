/**
 * Ajustes de la aplicacion.
 * Cambio -> se guarda al instante y se avisa a quien este suscrito.
 */
import * as storage from './storage.js';
import { emit } from './events.js';

const KEY = 'settings';

export const ACCENTS = ['azul', 'violeta', 'verde', 'naranja', 'rosa', 'cian'];
export const THEMES = ['dark', 'light', 'system'];
export const TEXT_SIZES = ['pequeno', 'normal', 'grande'];
export const TIME_FORMATS = ['auto', '12', '24'];
export const DATE_FORMATS = ['auto', 'dmy', 'mdy', 'ymd'];
export const UNIT_SYSTEMS = ['metrico', 'imperial'];
export const LANGUAGES = ['auto', 'es', 'en'];

export const DEFAULTS = Object.freeze({
  // Apariencia
  theme: 'dark',            // oscuro por defecto, sin mirar el tema del sistema
  accent: 'azul',
  textSize: 'normal',
  reduceMotion: false,
  // Idioma
  language: 'es',
  // Region y formato
  timeFormat: 'auto',
  dateFormat: 'auto',
  currency: 'ARS',
  units: 'metrico',
  // Herramientas
  timer: Object.freeze({
    focusMinutes: 25,
    shortBreakMinutes: 5,
    longBreakMinutes: 15,
    roundsBeforeLongBreak: 4,
    sound: true,
    vibrate: true,
    notify: false
  })
});

const ALLOWED = {
  theme: THEMES, accent: ACCENTS, textSize: TEXT_SIZES,
  language: LANGUAGES, timeFormat: TIME_FORMATS,
  dateFormat: DATE_FORMATS, units: UNIT_SYSTEMS
};

let state = { ...DEFAULTS, timer: { ...DEFAULTS.timer } };

function sanitize(input) {
  const out = { ...DEFAULTS, timer: { ...DEFAULTS.timer } };
  if (!input || typeof input !== 'object') return out;

  for (const [key, list] of Object.entries(ALLOWED)) {
    if (list.includes(input[key])) out[key] = input[key];
  }
  if (typeof input.reduceMotion === 'boolean') out.reduceMotion = input.reduceMotion;
  if (typeof input.currency === 'string' && /^[A-Za-z]{3}$/.test(input.currency)) {
    out.currency = input.currency.toUpperCase();
  }
  if (input.timer && typeof input.timer === 'object') {
    const t = input.timer;
    const num = (v, min, max, def) =>
      (typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max) ? Math.round(v) : def;
    out.timer = {
      focusMinutes: num(t.focusMinutes, 1, 180, DEFAULTS.timer.focusMinutes),
      shortBreakMinutes: num(t.shortBreakMinutes, 1, 60, DEFAULTS.timer.shortBreakMinutes),
      longBreakMinutes: num(t.longBreakMinutes, 1, 120, DEFAULTS.timer.longBreakMinutes),
      roundsBeforeLongBreak: num(t.roundsBeforeLongBreak, 2, 12, DEFAULTS.timer.roundsBeforeLongBreak),
      sound: typeof t.sound === 'boolean' ? t.sound : DEFAULTS.timer.sound,
      vibrate: typeof t.vibrate === 'boolean' ? t.vibrate : DEFAULTS.timer.vibrate,
      notify: typeof t.notify === 'boolean' ? t.notify : DEFAULTS.timer.notify
    };
  }
  return out;
}

export function load() {
  state = sanitize(storage.get(KEY, null));
  return state;
}

export function all() {
  return state;
}

export function get(key) {
  return state[key];
}

/** Cambia uno o varios ajustes, los guarda y avisa. */
export function update(patch) {
  const merged = { ...state, ...patch };
  if (patch.timer) merged.timer = { ...state.timer, ...patch.timer };
  const next = sanitize(merged);

  const changed = Object.keys(next).filter(
    k => JSON.stringify(next[k]) !== JSON.stringify(state[k])
  );
  state = next;
  storage.set(KEY, state);
  if (changed.length) emit('settings:change', { settings: state, changed });
  return state;
}

export function reset() {
  state = { ...DEFAULTS, timer: { ...DEFAULTS.timer } };
  storage.set(KEY, state);
  emit('settings:change', { settings: state, changed: Object.keys(DEFAULTS) });
  return state;
}

/** Para validar la importacion de una copia de seguridad. */
export function isValidShape(input) {
  return !!input && typeof input === 'object' && !Array.isArray(input);
}
