/**
 * Sonidos propios de "Elegir al azar": moneda y dados.
 * Se sintetizan igual que el resto, sin archivos de audio.
 */

/** Tintineo metálico de moneda: dos parciales inarmónicos que se apagan. */
export function coinChime(ctx, destination, when) {
  const partials = [[1318, 0.9], [1976, 0.45], [2637, 0.25], [3520, 0.12]];
  const duration = 0.9;
  for (const [freq, level] of partials) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, when);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.995, when + duration);
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(0.22 * level, when + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    osc.connect(gain).connect(destination);
    osc.start(when);
    osc.stop(when + duration);
  }
  return duration;
}

/** Golpes secos de dados sobre la mesa: ruido filtrado, varios impactos. */
export function diceRoll(ctx, destination, when, count = 3) {
  const total = 0.12 + count * 0.05;
  const frames = Math.ceil(ctx.sampleRate * total);
  const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;

  for (let i = 0; i < count; i++) {
    const at = when + i * 0.055;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 900 + i * 220;
    filter.Q.value = 1.6;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.3, at + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.07);
    src.connect(filter).connect(gain).connect(destination);
    src.start(at);
    src.stop(at + 0.09);
  }
  return total;
}
