/**
 * Fracciones exactas con BigInt.
 *
 * Durante los pasos de un cálculo se trabaja con fracciones, no con decimales:
 * así 1/3 + 1/6 da 1/2 exacto en vez de 0.4999999999999999. Los decimales
 * aparecen solo al final, al enseñar el resultado.
 *
 * Módulo puro: no toca el DOM. Se prueba con node --test.
 */

const abs = n => (n < 0n ? -n : n);

function gcdBig(a, b) {
  let x = abs(a);
  let y = abs(b);
  while (y) { [x, y] = [y, x % y]; }
  return x;
}

export class Fraction {
  /** Siempre normalizada: denominador positivo y fracción irreducible. */
  constructor(numerator, denominator = 1n) {
    let n = BigInt(numerator);
    let d = BigInt(denominator);
    if (d === 0n) throw new RangeError('denominador cero');
    if (d < 0n) { n = -n; d = -d; }
    const g = gcdBig(n, d) || 1n;
    this.n = n / g;
    this.d = d / g;
    Object.freeze(this);
  }

  static from(value) {
    if (value instanceof Fraction) return value;
    if (typeof value === 'bigint') return new Fraction(value);
    if (typeof value === 'number') return Fraction.fromNumber(value);
    if (typeof value === 'string') return Fraction.parse(value);
    throw new TypeError('no se puede convertir a fracción');
  }

  /** Un decimal finito se convierte exactamente: 0.25 -> 1/4. */
  static fromNumber(value) {
    if (!Number.isFinite(value)) throw new RangeError('número no finito');
    if (Number.isInteger(value)) return new Fraction(BigInt(value));
    const texto = value.toExponential(15);
    const [mantisa, exponente] = texto.split('e');
    const exp = Number(exponente);
    const [entero, decimales = ''] = mantisa.replace('-', '').split('.');
    const signo = value < 0 ? -1n : 1n;
    let n = BigInt(entero + decimales);
    let d = 10n ** BigInt(decimales.length);
    if (exp > 0) n *= 10n ** BigInt(exp);
    else if (exp < 0) d *= 10n ** BigInt(-exp);
    return new Fraction(signo * n, d);
  }

  /** Admite "3", "-2/5", "1.25" y coma decimal. */
  static parse(text) {
    const limpio = String(text).trim().replace(',', '.');
    if (/^-?\d+$/.test(limpio)) return new Fraction(BigInt(limpio));
    const partes = limpio.split('/');
    if (partes.length === 2) {
      return Fraction.from(partes[0].trim()).div(Fraction.from(partes[1].trim()));
    }
    if (/^-?\d*\.\d+$/.test(limpio)) return Fraction.fromNumber(Number(limpio));
    throw new SyntaxError(`no es un número: ${text}`);
  }

  add(other) { const o = Fraction.from(other); return new Fraction(this.n * o.d + o.n * this.d, this.d * o.d); }
  sub(other) { const o = Fraction.from(other); return new Fraction(this.n * o.d - o.n * this.d, this.d * o.d); }
  mul(other) { const o = Fraction.from(other); return new Fraction(this.n * o.n, this.d * o.d); }
  div(other) {
    const o = Fraction.from(other);
    if (o.n === 0n) throw new RangeError('división entre cero');
    return new Fraction(this.n * o.d, this.d * o.n);
  }
  neg() { return new Fraction(-this.n, this.d); }
  abs() { return new Fraction(abs(this.n), this.d); }

  /** Potencia de exponente entero. */
  pow(exponent) {
    const e = BigInt(exponent);
    if (e === 0n) return new Fraction(1n);
    if (e < 0n) return new Fraction(this.d ** -e, this.n ** -e);
    return new Fraction(this.n ** e, this.d ** e);
  }

  isZero() { return this.n === 0n; }
  isInteger() { return this.d === 1n; }
  sign() { return this.n === 0n ? 0 : (this.n < 0n ? -1 : 1); }
  equals(other) { const o = Fraction.from(other); return this.n === o.n && this.d === o.d; }
  compare(other) { const o = Fraction.from(other); const diff = this.n * o.d - o.n * this.d; return diff === 0n ? 0 : (diff < 0n ? -1 : 1); }

  valueOf() { return Number(this.n) / Number(this.d); }
  toNumber() { return this.valueOf(); }

  /** "3", "-2/5"… Para enseñar los pasos. */
  toString() { return this.d === 1n ? String(this.n) : `${this.n}/${this.d}`; }

  /** Número mixto: 7/3 -> { entero: 2, n: 1, d: 3 }. */
  toMixed() {
    const entero = this.n / this.d;
    const resto = abs(this.n % this.d);
    return { entero, n: resto, d: this.d };
  }
}

export const frac = (n, d) => new Fraction(n, d);
export const ZERO = new Fraction(0n);
export const ONE = new Fraction(1n);

/** Máximo común divisor de enteros (acepta números o BigInt). */
export function gcd(a, b) { return gcdBig(BigInt(a), BigInt(b)); }

/** Mínimo común múltiplo. */
export function lcm(a, b) {
  const x = BigInt(a);
  const y = BigInt(b);
  if (x === 0n || y === 0n) return 0n;
  return abs(x * y) / gcdBig(x, y);
}

/** Pasos del algoritmo de Euclides: [{ a, b, cociente, resto }]. */
export function euclidSteps(a, b) {
  let x = abs(BigInt(a));
  let y = abs(BigInt(b));
  const pasos = [];
  while (y !== 0n) {
    const cociente = x / y;
    const resto = x % y;
    pasos.push({ a: x, b: y, cociente, resto });
    [x, y] = [y, resto];
  }
  return { pasos, gcd: x };
}

/** Descomposición en factores primos: [{ primo, veces }]. */
export function primeFactors(value) {
  let n = abs(BigInt(value));
  if (n <= 1n) return [];
  const salida = [];
  const anotar = (primo, veces) => { if (veces) salida.push({ primo, veces }); };

  let veces = 0n;
  while (n % 2n === 0n) { n /= 2n; veces++; }
  anotar(2n, veces);

  for (let p = 3n; p * p <= n; p += 2n) {
    veces = 0n;
    while (n % p === 0n) { n /= p; veces++; }
    anotar(p, veces);
  }
  if (n > 1n) anotar(n, 1n);
  return salida;
}

/** Todos los divisores, ordenados. */
export function divisors(value) {
  const n = abs(BigInt(value));
  if (n === 0n) return [];
  const salida = [];
  for (let i = 1n; i * i <= n; i++) {
    if (n % i === 0n) {
      salida.push(i);
      if (i !== n / i) salida.push(n / i);
    }
  }
  return salida.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/**
 * Simplifica una raíz cuadrada: √72 -> 6√2.
 * Devuelve { fuera, dentro } con fuera·√dentro = √n.
 */
export function simplifySqrt(value) {
  let n = abs(BigInt(value));
  if (n === 0n) return { fuera: 0n, dentro: 1n };
  let fuera = 1n;
  for (const { primo, veces } of primeFactors(n)) {
    const pares = veces / 2n;
    fuera *= primo ** pares;
    n /= primo ** (pares * 2n);
  }
  return { fuera, dentro: n };
}
