/**
 * Formulario: catalogo de formulas con su despeje ya resuelto.
 *
 * Cada formula trae, para cada incognita, una funcion que la calcula a
 * partir de las demas. Son funciones normales de este archivo: no se
 * construye codigo en tiempo de ejecucion (ni eval ni new Function).
 *
 * Los nombres y las descripciones NO estan aqui: viven en locales/*.json
 * bajo formulas.<id>.nombre y formulas.<id>.desc, y las variables bajo
 * formulas.var.<nombre>.
 *
 * `expr` es como se escribe la formula en pantalla, ya formateada.
 * `unidad` es la clave de la unidad en los idiomas, o null si no lleva.
 * `positiva: true` marca las variables que no pueden ser <= 0.
 */

const PI = Math.PI;
const sq = x => x * x;

/** Ayuda para las formulas del tipo a = b * c. */
const producto = (id, grupo, expr, [a, b, c], unidades, { positivas = true, ...extra } = {}) => ({
  id,
  grupo,
  expr,
  vars: [
    { n: a, unidad: unidades[0] },
    { n: b, unidad: unidades[1], positiva: positivas },
    { n: c, unidad: unidades[2], positiva: positivas }
  ],
  solve: {
    [a]: v => v[b] * v[c],
    [b]: v => v[a] / v[c],
    [c]: v => v[a] / v[b]
  },
  ...extra
});

export const FORMULAS = [
  /* ---------------- Geometria plana ---------------- */
  {
    id: 'areaCuadrado', grupo: 'plana', expr: 'A = l²',
    vars: [{ n: 'A', unidad: 'm2' }, { n: 'l', unidad: 'm', positiva: true }],
    solve: { A: v => sq(v.l), l: v => Math.sqrt(v.A) }
  },
  producto('areaRectangulo', 'plana', 'A = b · h', ['A', 'b', 'h'], ['m2', 'm', 'm']),
  {
    id: 'areaTriangulo', grupo: 'plana', expr: 'A = (b · h) / 2',
    vars: [{ n: 'A', unidad: 'm2' }, { n: 'b', unidad: 'm', positiva: true }, { n: 'h', unidad: 'm', positiva: true }],
    solve: { A: v => (v.b * v.h) / 2, b: v => (2 * v.A) / v.h, h: v => (2 * v.A) / v.b }
  },
  {
    id: 'areaCirculo', grupo: 'plana', expr: 'A = π · r²',
    vars: [{ n: 'A', unidad: 'm2' }, { n: 'r', unidad: 'm', positiva: true }],
    solve: { A: v => PI * sq(v.r), r: v => Math.sqrt(v.A / PI) }
  },
  {
    id: 'longitudCircunferencia', grupo: 'plana', expr: 'L = 2 · π · r',
    vars: [{ n: 'L', unidad: 'm' }, { n: 'r', unidad: 'm', positiva: true }],
    solve: { L: v => 2 * PI * v.r, r: v => v.L / (2 * PI) }
  },
  {
    id: 'areaTrapecio', grupo: 'plana', expr: 'A = ((B + b) · h) / 2',
    vars: [{ n: 'A', unidad: 'm2' }, { n: 'B', unidad: 'm', positiva: true },
      { n: 'b', unidad: 'm', positiva: true }, { n: 'h', unidad: 'm', positiva: true }],
    solve: {
      A: v => ((v.B + v.b) * v.h) / 2,
      B: v => (2 * v.A) / v.h - v.b,
      b: v => (2 * v.A) / v.h - v.B,
      h: v => (2 * v.A) / (v.B + v.b)
    }
  },
  {
    id: 'pitagoras', grupo: 'plana', expr: 'c² = a² + b²',
    vars: [{ n: 'c', unidad: 'm', positiva: true }, { n: 'a', unidad: 'm', positiva: true },
      { n: 'b', unidad: 'm', positiva: true }],
    solve: {
      c: v => Math.sqrt(sq(v.a) + sq(v.b)),
      a: v => Math.sqrt(sq(v.c) - sq(v.b)),
      b: v => Math.sqrt(sq(v.c) - sq(v.a))
    }
  },

  /* ---------------- Cuerpos ---------------- */
  {
    id: 'volumenCubo', grupo: 'cuerpos', expr: 'V = a³',
    vars: [{ n: 'V', unidad: 'm3' }, { n: 'a', unidad: 'm', positiva: true }],
    solve: { V: v => v.a ** 3, a: v => Math.cbrt(v.V) }
  },
  {
    id: 'volumenPrisma', grupo: 'cuerpos', expr: 'V = A_b · h',
    vars: [{ n: 'V', unidad: 'm3' }, { n: 'A_b', unidad: 'm2', positiva: true }, { n: 'h', unidad: 'm', positiva: true }],
    solve: { V: v => v.A_b * v.h, A_b: v => v.V / v.h, h: v => v.V / v.A_b }
  },
  {
    id: 'volumenCilindro', grupo: 'cuerpos', expr: 'V = π · r² · h',
    vars: [{ n: 'V', unidad: 'm3' }, { n: 'r', unidad: 'm', positiva: true }, { n: 'h', unidad: 'm', positiva: true }],
    solve: {
      V: v => PI * sq(v.r) * v.h,
      r: v => Math.sqrt(v.V / (PI * v.h)),
      h: v => v.V / (PI * sq(v.r))
    }
  },
  {
    id: 'volumenEsfera', grupo: 'cuerpos', expr: 'V = (4/3) · π · r³',
    vars: [{ n: 'V', unidad: 'm3' }, { n: 'r', unidad: 'm', positiva: true }],
    solve: { V: v => (4 / 3) * PI * v.r ** 3, r: v => Math.cbrt((3 * v.V) / (4 * PI)) }
  },
  {
    id: 'areaEsfera', grupo: 'cuerpos', expr: 'A = 4 · π · r²',
    vars: [{ n: 'A', unidad: 'm2' }, { n: 'r', unidad: 'm', positiva: true }],
    solve: { A: v => 4 * PI * sq(v.r), r: v => Math.sqrt(v.A / (4 * PI)) }
  },
  {
    id: 'volumenCono', grupo: 'cuerpos', expr: 'V = (π · r² · h) / 3',
    vars: [{ n: 'V', unidad: 'm3' }, { n: 'r', unidad: 'm', positiva: true }, { n: 'h', unidad: 'm', positiva: true }],
    solve: {
      V: v => (PI * sq(v.r) * v.h) / 3,
      r: v => Math.sqrt((3 * v.V) / (PI * v.h)),
      h: v => (3 * v.V) / (PI * sq(v.r))
    }
  },

  /* ---------------- Cinematica ---------------- */
  producto('velocidadMedia', 'cinematica', 'v = d / t', ['d', 'v', 't'], ['m', 'ms', 's'], { positivas: false }),
  {
    id: 'mruv', grupo: 'cinematica', expr: 'v = v₀ + a · t',
    vars: [{ n: 'v', unidad: 'ms' }, { n: 'v0', unidad: 'ms' }, { n: 'a', unidad: 'ms2' }, { n: 't', unidad: 's', positiva: true }],
    solve: {
      v: x => x.v0 + x.a * x.t,
      v0: x => x.v - x.a * x.t,
      a: x => (x.v - x.v0) / x.t,
      t: x => (x.v - x.v0) / x.a
    }
  },
  {
    id: 'espacioMruv', grupo: 'cinematica', expr: 'x = x₀ + v₀ · t + ½ · a · t²',
    vars: [{ n: 'x', unidad: 'm' }, { n: 'x0', unidad: 'm' }, { n: 'v0', unidad: 'ms' },
      { n: 'a', unidad: 'ms2' }, { n: 't', unidad: 's', positiva: true }],
    solve: {
      x: v => v.x0 + v.v0 * v.t + 0.5 * v.a * sq(v.t),
      x0: v => v.x - v.v0 * v.t - 0.5 * v.a * sq(v.t),
      v0: v => (v.x - v.x0 - 0.5 * v.a * sq(v.t)) / v.t,
      a: v => (2 * (v.x - v.x0 - v.v0 * v.t)) / sq(v.t)
    }
  },
  {
    id: 'caidaLibre', grupo: 'cinematica', expr: 'h = ½ · g · t²',
    vars: [{ n: 'h', unidad: 'm', positiva: true }, { n: 'g', unidad: 'ms2', positiva: true }, { n: 't', unidad: 's', positiva: true }],
    solve: {
      h: v => 0.5 * v.g * sq(v.t),
      g: v => (2 * v.h) / sq(v.t),
      t: v => Math.sqrt((2 * v.h) / v.g)
    },
    valores: { g: 9.81 }
  },

  /* ---------------- Dinamica y energia ---------------- */
  producto('segundaNewton', 'dinamica', 'F = m · a', ['F', 'm', 'a'], ['N', 'kg', 'ms2'], { positivas: false }),
  producto('peso', 'dinamica', 'P = m · g', ['P', 'm', 'g'], ['N', 'kg', 'ms2'], { positivas: false, valores: { g: 9.81 } }),
  producto('presion', 'dinamica', 'p = F / A', ['F', 'p', 'A'], ['N', 'Pa', 'm2'], { positivas: false }),
  producto('densidad', 'dinamica', 'ρ = m / V', ['m', 'rho', 'V'], ['kg', 'kgm3', 'm3'], { positivas: false }),
  {
    id: 'energiaCinetica', grupo: 'energia', expr: 'Ec = ½ · m · v²',
    vars: [{ n: 'Ec', unidad: 'J' }, { n: 'm', unidad: 'kg', positiva: true }, { n: 'v', unidad: 'ms' }],
    solve: {
      Ec: x => 0.5 * x.m * sq(x.v),
      m: x => (2 * x.Ec) / sq(x.v),
      v: x => Math.sqrt((2 * x.Ec) / x.m)
    }
  },
  {
    id: 'energiaPotencial', grupo: 'energia', expr: 'Ep = m · g · h',
    vars: [{ n: 'Ep', unidad: 'J' }, { n: 'm', unidad: 'kg', positiva: true },
      { n: 'g', unidad: 'ms2', positiva: true }, { n: 'h', unidad: 'm' }],
    solve: {
      Ep: v => v.m * v.g * v.h,
      m: v => v.Ep / (v.g * v.h),
      g: v => v.Ep / (v.m * v.h),
      h: v => v.Ep / (v.m * v.g)
    },
    valores: { g: 9.81 }
  },
  producto('trabajo', 'energia', 'W = F · d', ['W', 'F', 'd'], ['J', 'N', 'm'], { positivas: false }),
  producto('potencia', 'energia', 'P = W / t', ['W', 'P', 't'], ['J', 'W', 's'], { positivas: false }),

  /* ---------------- Electricidad ---------------- */
  producto('ohm', 'electricidad', 'V = I · R', ['V', 'I', 'R'], ['V', 'A', 'ohm'], { positivas: false }),
  producto('potenciaElectrica', 'electricidad', 'P = V · I', ['P', 'V', 'I'], ['W', 'V', 'A'], { positivas: false }),
  producto('carga', 'electricidad', 'Q = I · t', ['Q', 'I', 't'], ['C', 'A', 's'], { positivas: false }),

  /* ---------------- Quimica ---------------- */
  producto('moles', 'quimica', 'n = m / M', ['m', 'n', 'M'], ['g', 'mol', 'gmol'], { positivas: false }),
  producto('molaridad', 'quimica', 'M = n / V', ['n', 'Mc', 'V'], ['mol', 'molL', 'L'], { positivas: false }),
  {
    id: 'gasesIdeales', grupo: 'quimica', expr: 'p · V = n · R · T',
    vars: [{ n: 'p', unidad: 'atm', positiva: true }, { n: 'V', unidad: 'L', positiva: true },
      { n: 'n', unidad: 'mol', positiva: true }, { n: 'R', unidad: 'RGas', positiva: true },
      { n: 'T', unidad: 'K', positiva: true }],
    solve: {
      p: v => (v.n * v.R * v.T) / v.V,
      V: v => (v.n * v.R * v.T) / v.p,
      n: v => (v.p * v.V) / (v.R * v.T),
      R: v => (v.p * v.V) / (v.n * v.T),
      T: v => (v.p * v.V) / (v.n * v.R)
    },
    valores: { R: 0.082 }
  },

  /* ---------------- Finanzas y proporciones ---------------- */
  {
    id: 'interesSimple', grupo: 'proporciones', expr: 'I = C · r · t',
    vars: [{ n: 'I', unidad: null }, { n: 'C', unidad: null, positiva: true },
      { n: 'r', unidad: 'porcentaje', positiva: true }, { n: 't', unidad: 'anos', positiva: true }],
    solve: {
      I: v => (v.C * (v.r / 100) * v.t),
      C: v => v.I / ((v.r / 100) * v.t),
      r: v => (v.I / (v.C * v.t)) * 100,
      t: v => v.I / (v.C * (v.r / 100))
    }
  },
  {
    id: 'interesCompuesto', grupo: 'proporciones', expr: 'C_f = C · (1 + r)^t',
    vars: [{ n: 'C_f', unidad: null, positiva: true }, { n: 'C', unidad: null, positiva: true },
      { n: 'r', unidad: 'porcentaje', positiva: true }, { n: 't', unidad: 'anos', positiva: true }],
    solve: {
      C_f: v => v.C * (1 + v.r / 100) ** v.t,
      C: v => v.C_f / (1 + v.r / 100) ** v.t,
      r: v => ((v.C_f / v.C) ** (1 / v.t) - 1) * 100,
      t: v => Math.log(v.C_f / v.C) / Math.log(1 + v.r / 100)
    }
  },
  {
    id: 'escala', grupo: 'proporciones', expr: 'real = plano · escala',
    vars: [{ n: 'real', unidad: 'm' }, { n: 'plano', unidad: 'cm', positiva: true }, { n: 'escala', unidad: null, positiva: true }],
    solve: {
      real: v => (v.plano * v.escala) / 100,
      plano: v => (v.real * 100) / v.escala,
      escala: v => (v.real * 100) / v.plano
    }
  },
  {
    id: 'imc', grupo: 'proporciones', expr: 'IMC = m / h²',
    vars: [{ n: 'IMC', unidad: 'kgm2' }, { n: 'm', unidad: 'kg', positiva: true }, { n: 'h', unidad: 'm', positiva: true }],
    solve: {
      IMC: v => v.m / sq(v.h),
      m: v => v.IMC * sq(v.h),
      h: v => Math.sqrt(v.m / v.IMC)
    }
  }
];

export const GRUPOS = [...new Set(FORMULAS.map(f => f.grupo))];

export const byId = id => FORMULAS.find(f => f.id === id) || null;

/** Variables que se pueden despejar en una formula. */
export const despejables = formula => Object.keys(formula.solve);

/**
 * Resuelve `incognita` con los valores dados.
 * Devuelve { valor } o { error: 'faltan' | 'noDespejable' | 'imposible' }.
 */
export function resolver(formula, incognita, valores) {
  const fn = formula.solve[incognita];
  if (!fn) return { error: 'noDespejable' };

  const necesarias = formula.vars.filter(v => v.n !== incognita);
  for (const v of necesarias) {
    const valor = valores[v.n];
    if (valor === undefined || valor === null || !Number.isFinite(valor)) return { error: 'faltan' };
    if (v.positiva && valor <= 0) return { error: 'positiva', variable: v.n };
  }

  const valor = fn(valores);
  if (!Number.isFinite(valor)) return { error: 'imposible' };

  const definicion = formula.vars.find(v => v.n === incognita);
  if (definicion?.positiva && valor <= 0) return { error: 'imposible' };
  return { valor };
}
