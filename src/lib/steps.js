/**
 * Motores de cálculo paso a paso.
 *
 * Cada función devuelve { ok, resultado, pasos } donde cada paso es
 * { clave, params }: la frase NO está aquí, está en los archivos de idioma.
 * Así las explicaciones se traducen como todo lo demás.
 *
 * Todo con fracciones exactas; los decimales solo al final.
 * Módulo puro, sin DOM.
 */
import { Fraction, frac, gcd, lcm, euclidSteps, primeFactors, divisors, simplifySqrt } from './fraction.js';

const F = v => Fraction.from(v);
const paso = (clave, params = {}) => ({ clave, params });
const texto = value => (value instanceof Fraction ? value.toString() : String(value));

/* ---------------- Ecuación de primer grado: ax + b = c ---------------- */

export function linearEquation(a, b, c) {
  const A = F(a); const B = F(b); const C = F(c);
  const pasos = [paso('lineal.inicio', { a: texto(A), b: texto(B), c: texto(C) })];

  if (A.isZero()) {
    if (B.equals(C)) return { ok: true, tipo: 'infinitas', pasos: [...pasos, paso('lineal.infinitas')] };
    return { ok: true, tipo: 'ninguna', pasos: [...pasos, paso('lineal.ninguna')] };
  }

  const derecha = C.sub(B);
  pasos.push(paso('lineal.despeja', { b: texto(B), resto: texto(derecha), a: texto(A) }));
  const x = derecha.div(A);
  pasos.push(paso('lineal.divide', { resto: texto(derecha), a: texto(A), x: texto(x) }));
  return { ok: true, tipo: 'una', x, decimal: x.toNumber(), pasos };
}

/* ---------------- Ecuación de segundo grado: ax² + bx + c = 0 ---------------- */

export function quadraticEquation(a, b, c) {
  const A = F(a); const B = F(b); const C = F(c);
  if (A.isZero()) {
    const lineal = linearEquation(B, C, 0);
    return { ...lineal, tipo: lineal.tipo === 'una' ? 'lineal' : lineal.tipo };
  }

  const pasos = [paso('cuadratica.inicio', { a: texto(A), b: texto(B), c: texto(C) })];
  const disc = B.mul(B).sub(A.mul(C).mul(4));
  pasos.push(paso('cuadratica.discriminante', { b: texto(B), a: texto(A), c: texto(C), d: texto(disc) }));

  const dosA = A.mul(2);

  if (disc.isZero()) {
    const x = B.neg().div(dosA);
    pasos.push(paso('cuadratica.doble', { x: texto(x) }));
    return { ok: true, tipo: 'doble', x1: x, x2: x, disc, pasos };
  }

  if (disc.sign() > 0) {
    // ¿La raíz es exacta? Si lo es, la solución sale en fracción.
    const { fuera, dentro } = disc.isInteger() ? simplifySqrt(disc.n) : { fuera: 0n, dentro: 0n };
    if (disc.isInteger() && dentro === 1n) {
      const raiz = new Fraction(fuera);
      const x1 = B.neg().add(raiz).div(dosA);
      const x2 = B.neg().sub(raiz).div(dosA);
      pasos.push(paso('cuadratica.raizExacta', { d: texto(disc), raiz: texto(raiz) }));
      pasos.push(paso('cuadratica.dos', { x1: texto(x1), x2: texto(x2) }));
      return { ok: true, tipo: 'dos', x1, x2, disc, exacta: true, pasos };
    }
    const raiz = Math.sqrt(disc.toNumber());
    const x1 = (-B.toNumber() + raiz) / dosA.toNumber();
    const x2 = (-B.toNumber() - raiz) / dosA.toNumber();
    if (disc.isInteger() && fuera > 1n) {
      pasos.push(paso('cuadratica.raizSimplificada', { d: texto(disc), fuera: String(fuera), dentro: String(dentro) }));
    }
    pasos.push(paso('cuadratica.dosDecimal', { x1: redondea(x1), x2: redondea(x2) }));
    return { ok: true, tipo: 'dos', x1, x2, disc, exacta: false, pasos };
  }

  // Discriminante negativo: soluciones complejas.
  const real = B.neg().div(dosA);
  const imag = Math.sqrt(-disc.toNumber()) / dosA.toNumber();
  pasos.push(paso('cuadratica.negativo', { d: texto(disc) }));
  pasos.push(paso('cuadratica.complejas', { re: texto(real), im: redondea(Math.abs(imag)) }));
  return { ok: true, tipo: 'complejas', real, imag: Math.abs(imag), disc, pasos };
}

const redondea = (value, decimales = 6) =>
  String(Math.round(value * 10 ** decimales) / 10 ** decimales);

/* ---------------- Sistema 2x2 ---------------- */

/** a1x + b1y = c1 ; a2x + b2y = c2 */
export function system2x2(a1, b1, c1, a2, b2, c2, metodo = 'reduccion') {
  const A1 = F(a1); const B1 = F(b1); const C1 = F(c1);
  const A2 = F(a2); const B2 = F(b2); const C2 = F(c2);

  const pasos = [paso('sistema.inicio', {
    a1: texto(A1), b1: texto(B1), c1: texto(C1), a2: texto(A2), b2: texto(B2), c2: texto(C2)
  })];

  const det = A1.mul(B2).sub(B1.mul(A2));
  if (det.isZero()) {
    const proporcional = A1.mul(C2).sub(C1.mul(A2)).isZero() && B1.mul(C2).sub(C1.mul(B2)).isZero();
    pasos.push(paso(proporcional ? 'sistema.infinitas' : 'sistema.ninguna'));
    return { ok: true, tipo: proporcional ? 'infinitas' : 'ninguna', pasos };
  }

  const detX = C1.mul(B2).sub(B1.mul(C2));
  const detY = A1.mul(C2).sub(C1.mul(A2));
  const x = detX.div(det);
  const y = detY.div(det);

  if (metodo === 'cramer') {
    pasos.push(paso('sistema.cramerDet', { det: texto(det) }));
    pasos.push(paso('sistema.cramerX', { detX: texto(detX), det: texto(det), x: texto(x) }));
    pasos.push(paso('sistema.cramerY', { detY: texto(detY), det: texto(det), y: texto(y) }));
  } else if (metodo === 'sustitucion') {
    if (!A1.isZero()) {
      pasos.push(paso('sistema.despejaX', { b1: texto(B1.neg()), c1: texto(C1), a1: texto(A1) }));
    }
    pasos.push(paso('sistema.sustituye'));
    pasos.push(paso('sistema.resultadoY', { y: texto(y) }));
    pasos.push(paso('sistema.resultadoX', { x: texto(x) }));
  } else {
    pasos.push(paso('sistema.multiplica', { m1: texto(A2), m2: texto(A1) }));
    pasos.push(paso('sistema.resta'));
    pasos.push(paso('sistema.resultadoY', { y: texto(y) }));
    pasos.push(paso('sistema.resultadoX', { x: texto(x) }));
  }

  return { ok: true, tipo: 'una', x, y, decimalX: x.toNumber(), decimalY: y.toNumber(), pasos };
}

/* ---------------- Fracciones ---------------- */

export function fractionOp(a, b, operacion) {
  const A = F(a); const B = F(b);
  const pasos = [paso('fracciones.inicio', { a: texto(A), op: simbolo(operacion), b: texto(B) })];
  let resultado;

  if (operacion === 'suma' || operacion === 'resta') {
    const comun = lcm(A.d, B.d);
    pasos.push(paso('fracciones.comun', { m: String(comun) }));
    const na = A.n * (comun / A.d);
    const nb = B.n * (comun / B.d);
    pasos.push(paso('fracciones.igualadas', {
      a: `${na}/${comun}`, op: simbolo(operacion), b: `${nb}/${comun}`
    }));
    resultado = operacion === 'suma' ? A.add(B) : A.sub(B);
    pasos.push(paso('fracciones.operados', {
      n: String(operacion === 'suma' ? na + nb : na - nb), d: String(comun)
    }));
  } else if (operacion === 'multiplicacion') {
    pasos.push(paso('fracciones.multiplica', {
      n: `${A.n}×${B.n}`, d: `${A.d}×${B.d}`
    }));
    resultado = A.mul(B);
  } else {
    if (B.isZero()) return { ok: false, error: 'fracciones.entreCero', pasos };
    pasos.push(paso('fracciones.invierte', { b: texto(B), inv: texto(new Fraction(B.d, B.n)) }));
    resultado = A.div(B);
  }

  pasos.push(paso('fracciones.simplificada', { r: texto(resultado), decimal: redondea(resultado.toNumber()) }));
  return { ok: true, resultado, decimal: resultado.toNumber(), pasos };
}

const simbolo = op => ({ suma: '+', resta: '−', multiplicacion: '×', division: '÷' }[op] || op);

/** Simplifica una fracción y la pasa a decimal. */
export function simplifyFraction(n, d) {
  const original = `${n}/${d}`;
  if (Number(d) === 0) return { ok: false, error: 'fracciones.entreCero', pasos: [] };
  const f = new Fraction(BigInt(n), BigInt(d));
  const divisor = gcd(BigInt(n), BigInt(d));
  const pasos = [paso('fracciones.simplificaInicio', { f: original })];
  if (divisor > 1n) pasos.push(paso('fracciones.divideAmbos', { g: String(divisor) }));
  else pasos.push(paso('fracciones.yaSimple'));
  pasos.push(paso('fracciones.simplificada', { r: texto(f), decimal: redondea(f.toNumber()) }));
  const mixto = f.toMixed();
  return { ok: true, resultado: f, decimal: f.toNumber(), mixto, pasos };
}

/* ---------------- MCD y mcm ---------------- */

export function gcdLcm(a, b) {
  const A = BigInt(Math.trunc(Number(a)));
  const B = BigInt(Math.trunc(Number(b)));
  if (A === 0n && B === 0n) return { ok: false, error: 'mcd.ceros', pasos: [] };

  const { pasos: euclides, gcd: g } = euclidSteps(A, B);
  const pasos = [paso('mcd.inicio', { a: String(A), b: String(B) })];
  for (const e of euclides) {
    pasos.push(paso('mcd.division', {
      a: String(e.a), b: String(e.b), q: String(e.cociente), r: String(e.resto)
    }));
  }
  pasos.push(paso('mcd.resultado', { g: String(g) }));
  const m = lcm(A, B);
  pasos.push(paso('mcd.mcm', { a: String(A < 0n ? -A : A), b: String(B < 0n ? -B : B), g: String(g), m: String(m) }));
  return { ok: true, mcd: g, mcm: m, pasos };
}

/* ---------------- Factorización ---------------- */

export function factorize(value) {
  const n = BigInt(Math.trunc(Number(value)));
  if (n === 0n) return { ok: false, error: 'factor.cero', pasos: [] };
  const abs = n < 0n ? -n : n;
  if (abs === 1n) {
    return { ok: true, factores: [], divisores: [1n], esPrimo: false, pasos: [paso('factor.uno')] };
  }

  const factores = primeFactors(abs);
  const pasos = [paso('factor.inicio', { n: String(abs) })];
  let resto = abs;
  for (const { primo, veces } of factores) {
    for (let i = 0n; i < veces; i++) {
      const antes = resto;
      resto /= primo;
      pasos.push(paso('factor.divide', { n: String(antes), p: String(primo), r: String(resto) }));
    }
  }
  const expresion = factores.map(f => (f.veces === 1n ? String(f.primo) : `${f.primo}^${f.veces}`)).join(' × ');
  pasos.push(paso('factor.resultado', { n: String(abs), f: expresion }));

  const esPrimo = factores.length === 1 && factores[0].veces === 1n;
  if (esPrimo) pasos.push(paso('factor.esPrimo', { n: String(abs) }));

  return { ok: true, factores, expresion, divisores: divisors(abs), esPrimo, pasos };
}

/* ---------------- Regla de tres ---------------- */

export function ruleOfThree(a, b, c, inversa = false) {
  const A = F(a); const B = F(b); const C = F(c);
  if (A.isZero()) return { ok: false, error: 'regla.primeroCero', pasos: [] };

  const pasos = [paso(inversa ? 'regla.inicioInversa' : 'regla.inicioDirecta', {
    a: texto(A), b: texto(B), c: texto(C)
  })];

  let x;
  if (inversa) {
    if (C.isZero()) return { ok: false, error: 'regla.terceroCero', pasos };
    x = A.mul(B).div(C);
    pasos.push(paso('regla.formulaInversa', { a: texto(A), b: texto(B), c: texto(C), x: texto(x) }));
  } else {
    x = B.mul(C).div(A);
    pasos.push(paso('regla.formulaDirecta', { b: texto(B), c: texto(C), a: texto(A), x: texto(x) }));
  }
  pasos.push(paso('regla.resultado', { x: texto(x), decimal: redondea(x.toNumber()) }));
  return { ok: true, x, decimal: x.toNumber(), pasos };
}

/* ---------------- Porcentajes ---------------- */

export function percentage(tipo, a, b) {
  const A = F(a); const B = F(b);
  const cien = frac(100n);
  let resultado; const pasos = [];

  switch (tipo) {
    case 'deQue':
      pasos.push(paso('pct.deQueInicio', { p: texto(A), n: texto(B) }));
      resultado = A.div(cien).mul(B);
      pasos.push(paso('pct.deQuePaso', { p: texto(A), n: texto(B), r: texto(resultado) }));
      break;
    case 'queporcentaje':
      if (B.isZero()) return { ok: false, error: 'pct.totalCero', pasos };
      pasos.push(paso('pct.queInicio', { a: texto(A), b: texto(B) }));
      resultado = A.div(B).mul(cien);
      pasos.push(paso('pct.quePaso', { a: texto(A), b: texto(B), r: texto(resultado) }));
      break;
    case 'aumentar':
      pasos.push(paso('pct.aumentaInicio', { n: texto(A), p: texto(B) }));
      resultado = A.mul(cien.add(B)).div(cien);
      pasos.push(paso('pct.aumentaPaso', { n: texto(A), p: texto(B), r: texto(resultado) }));
      break;
    case 'descontar':
      pasos.push(paso('pct.descuentaInicio', { n: texto(A), p: texto(B) }));
      resultado = A.mul(cien.sub(B)).div(cien);
      pasos.push(paso('pct.descuentaPaso', { n: texto(A), p: texto(B), r: texto(resultado) }));
      break;
    default:
      return { ok: false, error: 'pct.tipo', pasos };
  }

  pasos.push(paso('pct.resultado', { r: redondea(resultado.toNumber()) }));
  return { ok: true, resultado, decimal: resultado.toNumber(), pasos };
}

/* ---------------- Potencias y raíces ---------------- */

export function powerRoot(base, exponente) {
  const B = F(base);
  const pasos = [paso('pot.inicio', { b: texto(B), e: String(exponente) })];
  const e = Number(exponente);
  if (!Number.isInteger(e)) {
    const valor = Math.pow(B.toNumber(), e);
    pasos.push(paso('pot.decimal', { r: redondea(valor) }));
    return { ok: true, decimal: valor, pasos };
  }
  const resultado = B.pow(BigInt(e));
  if (e >= 0) {
    pasos.push(paso('pot.multiplica', { b: texto(B), e: String(e) }));
  } else {
    pasos.push(paso('pot.negativo', { b: texto(B), e: String(-e) }));
  }
  pasos.push(paso('pot.resultado', { r: texto(resultado), decimal: redondea(resultado.toNumber()) }));
  return { ok: true, resultado, decimal: resultado.toNumber(), pasos };
}

export function sqrtSteps(value) {
  const n = Number(value);
  if (n < 0) return { ok: false, error: 'pot.raizNegativa', pasos: [] };
  const pasos = [paso('pot.raizInicio', { n: String(n) })];
  if (Number.isInteger(n)) {
    const { fuera, dentro } = simplifySqrt(BigInt(n));
    if (dentro === 1n) {
      pasos.push(paso('pot.raizExacta', { n: String(n), r: String(fuera) }));
      return { ok: true, exacta: true, resultado: Number(fuera), pasos };
    }
    if (fuera > 1n) {
      pasos.push(paso('pot.raizSimplifica', { n: String(n), fuera: String(fuera), dentro: String(dentro) }));
    }
  }
  const valor = Math.sqrt(n);
  pasos.push(paso('pot.raizDecimal', { r: redondea(valor) }));
  return { ok: true, exacta: false, resultado: valor, pasos };
}

/* ---------------- Estadística ---------------- */

/** Acepta comas, espacios y saltos de línea como separadores. */
export function parseData(text) {
  return String(text)
    .split(/[\s,;]+/)
    .map(s => s.trim().replace(',', '.'))
    .filter(Boolean)
    .map(Number)
    .filter(Number.isFinite);
}

export function statistics(values, { muestral = false } = {}) {
  const datos = [...values].filter(Number.isFinite);
  if (!datos.length) return { ok: false, error: 'est.sinDatos', pasos: [] };

  const n = datos.length;
  const orden = [...datos].sort((a, b) => a - b);
  const suma = datos.reduce((acc, v) => acc + v, 0);
  const media = suma / n;

  const mediana = n % 2
    ? orden[(n - 1) / 2]
    : (orden[n / 2 - 1] + orden[n / 2]) / 2;

  const cuenta = new Map();
  for (const v of datos) cuenta.set(v, (cuenta.get(v) || 0) + 1);
  const maxFrec = Math.max(...cuenta.values());
  const moda = maxFrec > 1 ? [...cuenta.entries()].filter(([, c]) => c === maxFrec).map(([v]) => v).sort((a, b) => a - b) : [];

  const divisor = muestral ? n - 1 : n;
  const sumaCuadrados = datos.reduce((acc, v) => acc + (v - media) ** 2, 0);
  const varianza = divisor > 0 ? sumaCuadrados / divisor : 0;
  const desviacion = Math.sqrt(varianza);

  const percentil = p => {
    const pos = (n - 1) * p;
    const bajo = Math.floor(pos);
    const alto = Math.ceil(pos);
    return bajo === alto ? orden[bajo] : orden[bajo] + (pos - bajo) * (orden[alto] - orden[bajo]);
  };

  const pasos = [
    paso('est.datos', { n: String(n), lista: orden.join(', ') }),
    paso('est.media', { suma: redondea(suma), n: String(n), media: redondea(media) }),
    paso('est.mediana', { mediana: redondea(mediana) }),
    paso('est.varianza', {
      tipo: muestral ? 'n−1' : 'n', divisor: String(divisor),
      suma: redondea(sumaCuadrados), varianza: redondea(varianza)
    }),
    paso('est.desviacion', { varianza: redondea(varianza), desviacion: redondea(desviacion) })
  ];

  return {
    ok: true,
    n, suma, media, mediana, moda,
    min: orden[0], max: orden[n - 1], rango: orden[n - 1] - orden[0],
    varianza, desviacion,
    q1: percentil(0.25), q2: mediana, q3: percentil(0.75),
    pasos
  };
}
