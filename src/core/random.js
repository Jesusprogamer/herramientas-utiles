/**
 * Aleatoriedad criptografica sin sesgo.
 *
 * `crypto.getRandomValues` da bits uniformes, pero hacer `% n` introduce
 * sesgo cuando n no divide exactamente el rango. Aqui se usa muestreo por
 * rechazo: se descartan los valores que caen en la cola sobrante.
 */

function randomUint32() {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0];
}

/** Entero uniforme en [0, max). max debe ser un entero positivo. */
export function belowUnbiased(max) {
  if (!Number.isInteger(max) || max <= 0) throw new RangeError('max debe ser un entero > 0');
  if (max === 1) return 0;
  const RANGE = 0x100000000;          // 2^32
  const limit = RANGE - (RANGE % max); // mayor multiplo de max que cabe
  let value;
  do { value = randomUint32(); } while (value >= limit);
  return value % max;
}

/** Entero uniforme en [min, max], ambos incluidos. Admite negativos. */
export function intBetween(min, max) {
  const lo = Math.ceil(min);
  const hi = Math.floor(max);
  if (hi < lo) throw new RangeError('el minimo no puede ser mayor que el maximo');
  return lo + belowUnbiased(hi - lo + 1);
}

/** Elige un elemento al azar. */
export function pick(list) {
  if (!Array.isArray(list) || !list.length) return undefined;
  return list[belowUnbiased(list.length)];
}

/** Mezcla Fisher-Yates. Devuelve una copia; no toca el original. */
export function shuffle(list) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = belowUnbiased(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** n enteros distintos en [min, max] sin repetir. */
export function uniqueInts(min, max, count) {
  const lo = Math.ceil(min);
  const hi = Math.floor(max);
  const size = hi - lo + 1;
  if (count > size) throw new RangeError('no hay suficientes numeros distintos en el rango');

  // Rango pequeno: mezclar todo el rango es lo mas simple y exacto.
  if (size <= 10000) {
    return shuffle(Array.from({ length: size }, (_, i) => lo + i)).slice(0, count);
  }
  // Rango grande: sorteo con conjunto de vistos.
  const seen = new Set();
  const out = [];
  while (out.length < count) {
    const n = intBetween(lo, hi);
    if (!seen.has(n)) { seen.add(n); out.push(n); }
  }
  return out;
}

/** Caracteres al azar de un alfabeto, sin sesgo. */
export function randomChars(alphabet, length) {
  const chars = [...alphabet];
  let out = '';
  for (let i = 0; i < length; i++) out += chars[belowUnbiased(chars.length)];
  return out;
}
