/**
 * Los ocho sonidos de alarma, sintetizados. Ninguno usa archivos de audio.
 * Cada función programa la síntesis y devuelve su duración en segundos, para
 * que audio.playCustom() sepa cuánto dura la voz.
 */
export const ALARMS = ['campana', 'beep', 'digital', 'arpegio', 'timbre', 'retro', 'gota', 'despertador'];

const env = (ctx, dest, { when, dur, peak = 0.3, attack = 0.005 }) => {
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.exponentialRampToValueAtTime(peak, when + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  gain.connect(dest);
  return gain;
};

const tone = (ctx, dest, { when, freq, dur, type = 'sine', peak = 0.3, attack = 0.005, to }) => {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, when);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, when + dur);
  osc.connect(env(ctx, dest, { when, dur, peak, attack }));
  osc.start(when);
  osc.stop(when + dur + 0.02);
};

const noise = (ctx, dest, { when, dur, freq, q = 1, peak = 0.25, type = 'bandpass' }) => {
  const frames = Math.max(1, Math.ceil(ctx.sampleRate * dur));
  const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = freq;
  filter.Q.value = q;
  src.connect(filter).connect(env(ctx, dest, { when, dur, peak, attack: 0.002 }));
  src.start(when);
  src.stop(when + dur + 0.02);
};

/* ---------------- Los ocho ---------------- */

/** Campana: parciales inarmónicos con cola larga. */
function campana(ctx, dest, when) {
  const dur = 2.2;
  for (const [mult, level] of [[1, 1], [2.76, 0.5], [5.4, 0.28], [8.9, 0.14]]) {
    tone(ctx, dest, { when, freq: 523.25 * mult, dur: dur * (1 - level * 0.25), peak: 0.22 * level });
  }
  return dur;
}

/** Beep clásico: tres pitidos iguales y secos. */
function beep(ctx, dest, when) {
  for (let i = 0; i < 3; i++) {
    tone(ctx, dest, { when: when + i * 0.28, freq: 880, dur: 0.16, type: 'sine', peak: 0.32 });
  }
  return 0.28 * 3;
}

/** Digital: dos tonos alternos, como un reloj de pulsera. */
function digital(ctx, dest, when) {
  for (let i = 0; i < 6; i++) {
    tone(ctx, dest, { when: when + i * 0.13, freq: i % 2 ? 1760 : 2093, dur: 0.08, type: 'square', peak: 0.16 });
  }
  return 0.13 * 6;
}

/** Arpegio suave: acorde mayor ascendente y sostenido. */
function arpegio(ctx, dest, when) {
  const notas = [523.25, 659.25, 783.99, 1046.5];
  notas.forEach((freq, i) => {
    tone(ctx, dest, { when: when + i * 0.13, freq, dur: 0.9 - i * 0.1, type: 'sine', peak: 0.26, attack: 0.02 });
  });
  return 1.4;
}

/** Timbre: dos notas repetidas, como un timbre de casa. */
function timbre(ctx, dest, when) {
  for (let r = 0; r < 2; r++) {
    tone(ctx, dest, { when: when + r * 0.75, freq: 659.25, dur: 0.35, type: 'triangle', peak: 0.3, attack: 0.01 });
    tone(ctx, dest, { when: when + r * 0.75 + 0.35, freq: 523.25, dur: 0.38, type: 'triangle', peak: 0.3, attack: 0.01 });
  }
  return 1.5;
}

/** Retro 8-bit: escala rápida en onda cuadrada. */
function retro(ctx, dest, when) {
  const pasos = [523, 659, 784, 1047, 784, 1047, 1319];
  pasos.forEach((freq, i) => {
    tone(ctx, dest, { when: when + i * 0.09, freq, dur: 0.075, type: 'square', peak: 0.14 });
  });
  return 0.09 * pasos.length;
}

/** Gota de agua: tono que cae, con un toque de resonancia. */
function gota(ctx, dest, when) {
  for (let i = 0; i < 3; i++) {
    const at = when + i * 0.45;
    tone(ctx, dest, { when: at, freq: 1400, to: 420, dur: 0.22, type: 'sine', peak: 0.3, attack: 0.002 });
    noise(ctx, dest, { when: at, dur: 0.05, freq: 2600, q: 6, peak: 0.06 });
  }
  return 1.35;
}

/** Despertador: zumbido con trémolo, insistente. */
function despertador(ctx, dest, when) {
  const dur = 1.6;
  for (let i = 0; i < 16; i++) {
    const at = when + i * 0.1;
    tone(ctx, dest, { when: at, freq: 1046.5, dur: 0.055, type: 'square', peak: 0.2 });
    tone(ctx, dest, { when: at, freq: 1567.98, dur: 0.055, type: 'square', peak: 0.1 });
  }
  return dur;
}

const BY_NAME = { campana, beep, digital, arpegio, timbre, retro, gota, despertador };

/** Devuelve la función de síntesis de esa alarma. */
export function alarmSound(name) {
  return BY_NAME[name] || BY_NAME.campana;
}
