/**
 * Conversion entre bases numericas (2 a 36).
 *
 * La parte entera se hace con BigInt, asi que no hay perdida de precision
 * por grande que sea el numero. La parte fraccionaria se calcula digito a
 * digito con un limite, y se avisa cuando se ha tenido que cortar.
 */
export const DIGITOS = '0123456789abcdefghijklmnopqrstuvwxyz';
export const BASE_MIN = 2;
export const BASE_MAX = 36;
/** Digitos de la parte decimal que se calculan como mucho. */
export const MAX_DECIMALES = 24;

export function nombreDigito(valor) {
  return DIGITOS[valor];
}

/** Valor de un caracter, o -1 si no es un digito valido. */
export function valorDigito(caracter) {
  const i = DIGITOS.indexOf(caracter.toLowerCase());
  return i;
}

export function esBaseValida(base) {
  return Number.isInteger(base) && base >= BASE_MIN && base <= BASE_MAX;
}

/**
 * Separa un texto en { signo, entera, fraccion } y comprueba que todos sus
 * digitos existan en la base. Acepta coma o punto, espacios y _ de separacion.
 * Lanza Error con un motivo legible si algo no encaja.
 */
export function analizar(texto, base) {
  if (!esBaseValida(base)) throw new Error('base');
  const limpio = String(texto).trim().replace(/[\s_]/g, '').replace(',', '.');
  if (!limpio) throw new Error('vacio');

  let signo = 1n;
  let resto = limpio;
  if (resto[0] === '+' || resto[0] === '-') {
    if (resto[0] === '-') signo = -1n;
    resto = resto.slice(1);
  }
  if (!resto) throw new Error('vacio');

  const partes = resto.split('.');
  if (partes.length > 2) throw new Error('separadores');
  const [entera, fraccion = ''] = partes;
  if (!entera && !fraccion) throw new Error('vacio');

  for (const c of entera + fraccion) {
    const v = valorDigito(c);
    if (v < 0 || v >= base) throw new Error(`digito:${c}`);
  }
  return { signo, entera: entera || '0', fraccion };
}

/** Parte entera -> BigInt. */
export function enteraABigInt(digitos, base) {
  const b = BigInt(base);
  let n = 0n;
  for (const c of digitos) n = n * b + BigInt(valorDigito(c));
  return n;
}

/** BigInt -> texto en la base pedida (sin signo). */
export function bigIntATexto(n, base) {
  if (n === 0n) return '0';
  const b = BigInt(base);
  let resto = n < 0n ? -n : n;
  let salida = '';
  while (resto > 0n) {
    salida = nombreDigito(Number(resto % b)) + salida;
    resto /= b;
  }
  return salida;
}

/**
 * Parte fraccionaria: se mantiene como numerador/denominador exactos
 * (BigInt) para no arrastrar el error de los decimales de coma flotante.
 */
export function fraccionExacta(digitos, base) {
  const b = BigInt(base);
  let numerador = 0n;
  let denominador = 1n;
  for (const c of digitos) {
    numerador = numerador * b + BigInt(valorDigito(c));
    denominador *= b;
  }
  return { numerador, denominador };
}

/**
 * Convierte una fraccion exacta a `destino`, devolviendo los digitos y si
 * se ha tenido que cortar.
 */
export function fraccionATexto({ numerador, denominador }, destino, maximo = MAX_DECIMALES) {
  if (numerador === 0n) return { digitos: '', cortado: false };
  const b = BigInt(destino);
  let n = numerador;
  let salida = '';
  for (let i = 0; i < maximo && n > 0n; i++) {
    n *= b;
    const d = n / denominador;
    salida += nombreDigito(Number(d));
    n -= d * denominador;
  }
  return { digitos: salida, cortado: n > 0n };
}

/**
 * Convierte `texto` de `origen` a `destino`.
 * Devuelve { texto, cortado, entero, fraccion } o lanza Error.
 */
export function convertir(texto, origen, destino, { maximo = MAX_DECIMALES } = {}) {
  if (!esBaseValida(destino)) throw new Error('base');
  const { signo, entera, fraccion } = analizar(texto, origen);
  const entero = enteraABigInt(entera, origen);
  const exacta = fraccionExacta(fraccion, origen);
  const { digitos, cortado } = fraccionATexto(exacta, destino, maximo);

  const cuerpo = bigIntATexto(entero, destino) + (digitos ? `.${digitos}` : '');
  const negativo = signo === -1n && (entero !== 0n || exacta.numerador !== 0n);
  return {
    texto: (negativo ? '-' : '') + cuerpo,
    cortado,
    entero: signo * entero,
    fraccion: exacta
  };
}

/**
 * Pasos de la division sucesiva para la parte entera:
 * [{ clave: 'bases.division', params: { n, base, cociente, resto, digito } }]
 */
export function pasosEntera(n, destino) {
  const b = BigInt(destino);
  const pasos = [];
  let resto = n < 0n ? -n : n;
  if (resto === 0n) {
    return [{ clave: 'bases.cero', params: {} }];
  }
  while (resto > 0n) {
    const cociente = resto / b;
    const r = resto % b;
    pasos.push({
      clave: 'bases.division',
      params: {
        n: resto.toString(), base: destino,
        cociente: cociente.toString(), resto: r.toString(),
        digito: nombreDigito(Number(r))
      }
    });
    resto = cociente;
  }
  pasos.push({
    clave: 'bases.leerAlReves',
    params: { digitos: pasos.map(p => p.params.digito).reverse().join(' ') }
  });
  return pasos;
}

/**
 * Pasos de la multiplicacion sucesiva para la parte fraccionaria.
 */
export function pasosFraccion({ numerador, denominador }, destino, maximo = 8) {
  if (numerador === 0n) return [];
  const b = BigInt(destino);
  const pasos = [];
  let n = numerador;
  for (let i = 0; i < maximo && n > 0n; i++) {
    const antes = n;
    n *= b;
    const d = n / denominador;
    n -= d * denominador;
    pasos.push({
      clave: 'bases.multiplicacion',
      params: {
        valor: `${antes}/${denominador}`, base: destino,
        digito: nombreDigito(Number(d)),
        resto: `${n}/${denominador}`
      }
    });
  }
  return pasos;
}

/** Agrupa de derecha a izquierda: 11110000 -> "1111 0000". */
export function agrupar(digitos, tamano = 4) {
  const partes = [];
  for (let fin = digitos.length; fin > 0; fin -= tamano) {
    partes.unshift(digitos.slice(Math.max(0, fin - tamano), fin));
  }
  return partes.join(' ');
}

/**
 * Complemento a dos de `n` con `bits` bits, o null si no cabe.
 * Sirve para enseñar como se guardan los negativos.
 */
export function complementoDos(n, bits) {
  const modulo = 1n << BigInt(bits);
  const min = -(modulo / 2n);
  const max = modulo / 2n - 1n;
  if (n < min || n > max) return null;
  const valor = n < 0n ? modulo + n : n;
  return valor.toString(2).padStart(bits, '0');
}
