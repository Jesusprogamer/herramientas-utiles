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
export const LANGUAGES = ['auto', 'es', 'en', 'pt'];
export const SOUND_STYLES = ['suave', 'retro', 'cristal'];
export const TRANSITIONS = ['ninguna', 'suave', 'completa'];
export const ALARM_SOUNDS = ['campana', 'beep', 'digital', 'arpegio', 'timbre', 'retro', 'gota', 'despertador'];
export const ALARM_REPEATS = ['una', 'tres', 'hasta'];

export const DEFAULTS = Object.freeze({
  // Apariencia
  theme: 'dark',            // oscuro por defecto, sin mirar el tema del sistema
  accent: 'azul',
  textSize: 'normal',
  reduceMotion: false,
  transitions: 'suave',
  // Idioma
  language: 'es',
  // Region y formato
  timeFormat: 'auto',
  dateFormat: 'auto',
  currency: 'ARS',
  units: 'metrico',
  // Herramientas
  // Sonido y animaciones
  sound: Object.freeze({
    enabled: true,
    volume: 30,
    style: 'suave',
    tap: true,
    toggle: true,
    success: true,
    error: true,
    navigate: true,
    dialog: true,
    hover: false,      // solo con raton, y desactivado de serie
    vibrate: false     // solo donde el navegador lo permita
  }),
  timer: Object.freeze({
    focusMinutes: 25,
    shortBreakMinutes: 5,
    longBreakMinutes: 15,
    roundsBeforeLongBreak: 4,
    sound: true,
    vibrate: true,
    notify: true,         // se pide el permiso la primera vez que pulsas "Empezar"
    alarmFocus: 'campana',    // al terminar el trabajo
    alarmBreak: 'gota',       // al terminar el descanso
    alarmVolume: 80,
    repeat: 'hasta'           // una | tres | hasta que la pares
  })
});

const ALLOWED = {
  theme: THEMES, accent: ACCENTS, textSize: TEXT_SIZES,
  language: LANGUAGES, timeFormat: TIME_FORMATS,
  dateFormat: DATE_FORMATS, units: UNIT_SYSTEMS,
  transitions: TRANSITIONS
};

let state = { ...DEFAULTS, sound: { ...DEFAULTS.sound }, timer: { ...DEFAULTS.timer } };

function sanitize(input) {
  const out = { ...DEFAULTS, sound: { ...DEFAULTS.sound }, timer: { ...DEFAULTS.timer } };
  if (!input || typeof input !== 'object') return out;

  for (const [key, list] of Object.entries(ALLOWED)) {
    if (list.includes(input[key])) out[key] = input[key];
  }
  if (typeof input.reduceMotion === 'boolean') out.reduceMotion = input.reduceMotion;
  if (typeof input.currency === 'string' && /^[A-Za-z]{3}$/.test(input.currency)) {
    out.currency = input.currency.toUpperCase();
  }
  if (input.sound && typeof input.sound === 'object') {
    const snd = input.sound;
    const flag = (v, def) => (typeof v === 'boolean' ? v : def);
    out.sound = {
      enabled: flag(snd.enabled, DEFAULTS.sound.enabled),
      volume: (typeof snd.volume === 'number' && snd.volume >= 0 && snd.volume <= 100)
        ? Math.round(snd.volume) : DEFAULTS.sound.volume,
      style: SOUND_STYLES.includes(snd.style) ? snd.style : DEFAULTS.sound.style,
      tap: flag(snd.tap, DEFAULTS.sound.tap),
      toggle: flag(snd.toggle, DEFAULTS.sound.toggle),
      success: flag(snd.success, DEFAULTS.sound.success),
      error: flag(snd.error, DEFAULTS.sound.error),
      navigate: flag(snd.navigate, DEFAULTS.sound.navigate),
      dialog: flag(snd.dialog, DEFAULTS.sound.dialog),
      hover: flag(snd.hover, DEFAULTS.sound.hover),
      vibrate: flag(snd.vibrate, DEFAULTS.sound.vibrate)
    };
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
      notify: typeof t.notify === 'boolean' ? t.notify : DEFAULTS.timer.notify,
      alarmFocus: ALARM_SOUNDS.includes(t.alarmFocus) ? t.alarmFocus : DEFAULTS.timer.alarmFocus,
      alarmBreak: ALARM_SOUNDS.includes(t.alarmBreak) ? t.alarmBreak : DEFAULTS.timer.alarmBreak,
      alarmVolume: (typeof t.alarmVolume === 'number' && t.alarmVolume >= 0 && t.alarmVolume <= 100)
        ? Math.round(t.alarmVolume) : DEFAULTS.timer.alarmVolume,
      repeat: ALARM_REPEATS.includes(t.repeat) ? t.repeat : DEFAULTS.timer.repeat
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
  if (patch.sound) merged.sound = { ...state.sound, ...patch.sound };
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
  state = { ...DEFAULTS, sound: { ...DEFAULTS.sound }, timer: { ...DEFAULTS.timer } };
  storage.set(KEY, state);
  emit('settings:change', { settings: state, changed: Object.keys(DEFAULTS) });
  return state;
}

/** Para validar la importacion de una copia de seguridad. */
export function isValidShape(input) {
  return !!input && typeof input === 'object' && !Array.isArray(input);
}
