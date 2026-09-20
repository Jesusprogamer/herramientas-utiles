/**
 * Aritmetica del temporizador y del cronometro.
 *
 * Modulo puro: ni DOM ni estado propio. El reloj llega siempre por
 * parametro (`ahora`), asi que las pruebas pueden inyectar uno falso.
 */

/** Milisegundos transcurridos de un cronometro. */
export function transcurrido({ running, startedAt, acumulado }, ahora = Date.now()) {
  const base = Number.isFinite(acumulado) && acumulado > 0 ? acumulado : 0;
  if (!running || !Number.isFinite(startedAt)) return base;
  return base + Math.max(0, ahora - startedAt);
}

/** Milisegundos que quedan de una cuenta atras, nunca negativos. */
export function restante({ running, endsAt, remainingMs }, ahora = Date.now()) {
  if (running && Number.isFinite(endsAt)) return Math.max(0, endsAt - ahora);
  return Math.max(0, Number.isFinite(remainingMs) ? remainingMs : 0);
}

/**
 * Vueltas con su parcial, de la mas reciente a la mas antigua.
 * `vueltas` son marcas acumuladas; el parcial es lo que ha durado cada una.
 */
export function vueltasConParcial(vueltas) {
  if (!Array.isArray(vueltas)) return [];
  return vueltas
    .map((total, i) => ({ n: i + 1, total, parcial: total - (vueltas[i - 1] || 0) }))
    .reverse();
}

const dos = n => String(n).padStart(2, '0');

/** h:mm:ss o mm:ss, redondeando hacia arriba (asi «1 s» no se ve como 0). */
export function formatClock(ms) {
  const total = Math.ceil(Math.max(0, ms) / 1000);
  const horas = Math.floor(total / 3600);
  const minutos = Math.floor((total % 3600) / 60);
  const segundos = total % 60;
  return horas > 0 ? `${horas}:${dos(minutos)}:${dos(segundos)}` : `${dos(minutos)}:${dos(segundos)}`;
}

/** mm:ss,cc — las centesimas son lo que se espera de un cronometro. */
export function formatCrono(ms) {
  const total = Math.max(0, Math.floor(ms));
  const centesimas = Math.floor((total % 1000) / 10);
  const segundos = Math.floor(total / 1000) % 60;
  const minutos = Math.floor(total / 60000) % 60;
  const horas = Math.floor(total / 3600000);
  const base = horas > 0
    ? `${horas}:${dos(minutos)}:${dos(segundos)}`
    : `${dos(minutos)}:${dos(segundos)}`;
  return `${base},${dos(centesimas)}`;
}
