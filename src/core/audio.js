/**
 * Sonidos de la interfaz, generados por código con la Web Audio API.
 * No hay ni un solo archivo de audio: todo son osciladores y envolventes.
 *
 * Reglas de la casa:
 *  · Un único AudioContext, creado tras el primer gesto de la persona
 *    (los navegadores no dejan sonar antes).
 *  · Nunca suena si la pestaña está oculta.
 *  · Hay un límite de voces simultáneas: si se disparan muchos avisos a la
 *    vez, los que sobran se descartan en lugar de saturar.
 *  · El sonido nunca es la única señal de nada: siempre acompaña a algo
 *    visible.
 */
import * as settings from './settings.js';

export const STYLES = ['suave', 'retro', 'cristal'];
export const CUES = ['tap', 'toggle', 'success', 'error', 'navigate', 'dialog', 'hover'];

const MAX_VOICES = 6;
const HOVER_THROTTLE_MS = 60;
const SCROLL_QUIET_MS = 180;

/* ------------------------------------------------------------------
   Diseño de cada sonido
   notes: [{ f, t, d, type?, g? }] -> frecuencia, inicio, duración
   Las frecuencias son notas reales para que los acordes no desafinen.
   ------------------------------------------------------------------ */
const A4 = 440;
const note = n => A4 * Math.pow(2, n / 12);   // n = semitonos desde La4

const VOICES = {
  suave: {
    type: 'sine', gain: 0.5, attack: 0.008, release: 0.12,
    cues: {
      tap:      [{ f: note(4), t: 0, d: 0.07 }],
      toggleOn: [{ f: note(4), t: 0, d: 0.06 }, { f: note(11), t: 0.05, d: 0.09 }],
      toggleOff:[{ f: note(11), t: 0, d: 0.06 }, { f: note(4), t: 0.05, d: 0.09 }],
      success:  [{ f: note(0), t: 0, d: 0.09 }, { f: note(4), t: 0.07, d: 0.09 }, { f: note(7), t: 0.14, d: 0.18 }],
      error:    [{ f: note(-5), t: 0, d: 0.12 }, { f: note(-10), t: 0.09, d: 0.2 }],
      navigate: [{ f: note(2), t: 0, d: 0.05, g: 0.5 }, { f: note(9), t: 0.03, d: 0.08, g: 0.35 }],
      dialog:   [{ f: note(7), t: 0, d: 0.1 }],
      hover:    [{ f: note(12), t: 0, d: 0.03, g: 0.25 }]
    }
  },
  retro: {
    type: 'square', gain: 0.24, attack: 0.001, release: 0.03,
    cues: {
      tap:      [{ f: note(12), t: 0, d: 0.04 }],
      toggleOn: [{ f: note(7), t: 0, d: 0.035 }, { f: note(19), t: 0.04, d: 0.05 }],
      toggleOff:[{ f: note(19), t: 0, d: 0.035 }, { f: note(7), t: 0.04, d: 0.05 }],
      success:  [{ f: note(12), t: 0, d: 0.05 }, { f: note(16), t: 0.05, d: 0.05 }, { f: note(24), t: 0.1, d: 0.12 }],
      error:    [{ f: note(-1), t: 0, d: 0.08 }, { f: note(-13), t: 0.08, d: 0.14 }],
      navigate: [{ f: note(14), t: 0, d: 0.04 }, { f: note(21), t: 0.035, d: 0.05 }],
      dialog:   [{ f: note(16), t: 0, d: 0.05 }],
      hover:    [{ f: note(26), t: 0, d: 0.02, g: 0.2 }]
    }
  },
  cristal: {
    type: 'triangle', gain: 0.42, attack: 0.002, release: 0.3,
    cues: {
      tap:      [{ f: note(19), t: 0, d: 0.05 }, { f: note(31), t: 0, d: 0.05, g: 0.3 }],
      toggleOn: [{ f: note(16), t: 0, d: 0.07 }, { f: note(28), t: 0.03, d: 0.16, g: 0.4 }],
      toggleOff:[{ f: note(28), t: 0, d: 0.07 }, { f: note(16), t: 0.03, d: 0.16, g: 0.4 }],
      success:  [{ f: note(16), t: 0, d: 0.12 }, { f: note(23), t: 0.06, d: 0.14 }, { f: note(28), t: 0.12, d: 0.3 }],
      error:    [{ f: note(3), t: 0, d: 0.16 }, { f: note(-4), t: 0.1, d: 0.26 }],
      navigate: [{ f: note(21), t: 0, d: 0.05, g: 0.45 }, { f: note(26), t: 0.04, d: 0.12, g: 0.3 }],
      dialog:   [{ f: note(24), t: 0, d: 0.14, g: 0.5 }],
      hover:    [{ f: note(33), t: 0, d: 0.025, g: 0.18 }]
    }
  }
};

/** Nombre interno del sonido: el interruptor distingue encendido y apagado. */
function cueName(cue, value) {
  if (cue !== 'toggle') return cue;
  return value === false ? 'toggleOff' : 'toggleOn';
}

/* ---------------- Contexto y estado ---------------- */

let ctx = null;
let masterGain = null;
let voices = 0;
let unlocked = false;
let lastHoverAt = 0;
let lastHoverTarget = null;
let lastScrollAt = 0;
let wired = false;

const prefs = () => settings.get('sound');

export function isUnlocked() { return unlocked && ctx?.state === 'running'; }

/** Crea el contexto. Solo debe llamarse desde un gesto de la persona. */
export function unlock() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    unlocked = true;
    return ctx;
  }
  try {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    masterGain = ctx.createGain();
    masterGain.gain.value = (prefs().volume ?? 30) / 100;
    masterGain.connect(ctx.destination);
    unlocked = true;
  } catch (err) {
    console.warn('[sonido] no se pudo crear el contexto de audio', err);
    ctx = null;
  }
  return ctx;
}

export function setVolume(value) {
  if (!masterGain || !ctx) return;
  const target = Math.min(1, Math.max(0, value / 100));
  try {
    masterGain.gain.cancelScheduledValues(ctx.currentTime);
    masterGain.gain.setTargetAtTime(target, ctx.currentTime, 0.02);
  } catch { masterGain.gain.value = target; }
}

/* ---------------- Síntesis ---------------- */

/**
 * Programa un sonido en el contexto que se le pase.
 * Separado a propósito: así puede renderizarse en un OfflineAudioContext
 * para medirlo en las pruebas, sin depender de que haya altavoces.
 */
export function scheduleCue(audioCtx, destination, cue, style, { when = 0, value } = {}) {
  const preset = VOICES[style] || VOICES.suave;
  const notes = preset.cues[cueName(cue, value)];
  if (!notes) return 0;

  let end = 0;
  for (const n of notes) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = n.type || preset.type;
    osc.frequency.setValueAtTime(n.f, when + n.t);

    const peak = preset.gain * (n.g ?? 1);
    const start = when + n.t;
    const stop = start + n.d + preset.release;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(peak, start + preset.attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, stop);

    osc.connect(gain).connect(destination);
    osc.start(start);
    osc.stop(stop);
    end = Math.max(end, stop);
  }
  return end - when;
}

/** Reproduce un sonido de la interfaz, si procede. */
export function play(cue, { value, force = false } = {}) {
  const p = prefs();
  if (!force) {
    if (!p.enabled) return false;
    if (cue !== 'hover' && p[cue] === false) return false;
    if (cue === 'hover' && !p.hover) return false;
  }
  if (document.visibilityState !== 'visible') return false;   // pestaña oculta: silencio
  if (!ctx && !unlock()) return false;
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  if (voices >= MAX_VOICES) return false;                     // límite de voces

  voices++;
  const duration = scheduleCue(ctx, masterGain, cue, p.style, { when: ctx.currentTime + 0.001, value });
  setTimeout(() => { voices = Math.max(0, voices - 1); }, Math.max(60, duration * 1000));
  return true;
}

/**
 * Reproduce un sonido propio de una herramienta (moneda, dados, alarma…).
 * `schedule(ctx, destino, cuando)` debe programar la síntesis y devolver su
 * duración en segundos. Respeta el volumen, el límite de voces y el silencio
 * con la pestaña oculta, igual que los avisos de la interfaz.
 */
export function playCustom(schedule, { force = false, volume = 1 } = {}) {
  if (!force && !prefs().enabled) return false;
  if (document.visibilityState !== 'visible') return false;
  if (!ctx && !unlock()) return false;
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  if (voices >= MAX_VOICES) return false;

  voices++;
  let node = masterGain;
  if (volume !== 1) {
    node = ctx.createGain();
    node.gain.value = Math.max(0, Math.min(1, volume));
    node.connect(masterGain);
  }
  const duration = schedule(ctx, node, ctx.currentTime + 0.001) || 0.2;
  setTimeout(() => { voices = Math.max(0, voices - 1); }, Math.max(60, duration * 1000));
  return true;
}

/** Igual que renderCue pero con una síntesis propia. Para medirla en pruebas. */
export async function renderWith(schedule, { sampleRate = 44100, seconds = 3 } = {}) {
  const Ctor = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  if (!Ctor) throw new Error('Este navegador no tiene OfflineAudioContext');
  const offline = new Ctor(1, Math.ceil(sampleRate * seconds), sampleRate);
  schedule(offline, offline.destination, 0);
  return offline.startRendering();
}

/** Prueba un estilo desde Ajustes, aunque los sonidos estén apagados. */
export function preview(style) {
  if (!ctx && !unlock()) return false;
  const p = prefs();
  const before = p.style;
  // Se usa scheduleCue directamente para no depender del estilo guardado.
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  scheduleCue(ctx, masterGain, 'success', style, { when: ctx.currentTime + 0.001 });
  return before !== undefined;
}

/** Renderiza un sonido sin reproducirlo. Se usa para comprobarlo en pruebas. */
export async function renderCue(cue, style, { sampleRate = 44100, seconds = 1, value } = {}) {
  const Ctor = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  if (!Ctor) throw new Error('Este navegador no tiene OfflineAudioContext');
  const offline = new Ctor(1, Math.ceil(sampleRate * seconds), sampleRate);
  scheduleCue(offline, offline.destination, cue, style, { when: 0, value });
  return offline.startRendering();
}

/* ---------------- Vibración ---------------- */

export function vibrate(pattern = 12) {
  if (!prefs().vibrate) return false;
  if (typeof navigator.vibrate !== 'function') return false;
  try { return navigator.vibrate(pattern); } catch { return false; }
}

/* ---------------- Conexión con la interfaz ---------------- */

const INTERACTIVE = 'button, a[href], input, select, textarea, summary, [role="tab"], [role="radio"], [role="switch"]';

export function supportsHoverSounds() {
  return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
}

/** Engancha los sonidos a los gestos. Se llama una sola vez al arrancar. */
export function init() {
  if (wired) return;
  wired = true;

  // El primer gesto crea el contexto; a partir de ahí ya puede sonar.
  const firstGesture = () => { unlock(); };
  window.addEventListener('pointerdown', firstGesture, { once: true, capture: true });
  window.addEventListener('keydown', firstGesture, { once: true, capture: true });

  document.addEventListener('pointerdown', event => {
    const target = event.target.closest?.(INTERACTIVE);
    if (!target || target.disabled) return;
    play('tap');
    vibrate();
  }, { capture: true });

  document.addEventListener('change', event => {
    const el = event.target;
    if (el instanceof HTMLInputElement && el.type === 'checkbox') play('toggle', { value: el.checked });
  }, { capture: true });

  // El sonido al pasar el ratón solo en punteros de verdad, espaciado, y
  // nunca mientras se desplaza la página.
  window.addEventListener('scroll', () => { lastScrollAt = performance.now(); }, { passive: true, capture: true });

  document.addEventListener('pointerover', event => {
    if (!prefs().hover || !supportsHoverSounds()) return;
    if (event.pointerType && event.pointerType !== 'mouse') return;
    const target = event.target.closest?.(INTERACTIVE);
    if (!target || target === lastHoverTarget) return;      // solo al entrar en otro elemento
    const now = performance.now();
    if (now - lastScrollAt < SCROLL_QUIET_MS) return;        // acaba de desplazarse
    if (now - lastHoverAt < HOVER_THROTTLE_MS) return;       // como mucho uno cada 60 ms
    lastHoverAt = now;
    lastHoverTarget = target;
    play('hover');
  }, { capture: true });

  document.addEventListener('pointerout', event => {
    if (event.target === lastHoverTarget) lastHoverTarget = null;
  }, { capture: true });
}
