/**
 * Preguntas del modo test del formulario.
 *
 * Modulo puro: recibe el catalogo de formulas y las funciones que traducen
 * (nombres, variables, unidades y frases), y devuelve preguntas. No mira el
 * DOM ni el almacenamiento, y el azar entra por parametro para poder
 * probarlo con un generador fijo.
 *
 * Los ejercicios de calcular no construyen codigo: usan los despejes ya
 * escritos a mano en src/data/formulas.js.
 */
import { resolver, despejables } from '../../data/formulas.js';

export const TIPOS = ['expresion', 'nombre', 'variable', 'unidad', 'calcular'];

/** Rango de los valores que se inventan para los ejercicios. */
const MIN = 2;
const MAX = 12;
/** Un resultado fuera de esto no se pregunta: no se aprende nada con el. */
const TOPE = 1e6;
const SUELO = 1e-3;
/** Intentos antes de rendirse con una formula concreta. */
const INTENTOS = 12;

const entero = (azar, min, max) => min + Math.floor(azar() * (max - min + 1));

/** Elige un elemento de la lista. */
const uno = (azar, lista) => lista[Math.floor(azar() * lista.length)] ?? null;

/** Filtra por grupo y favoritas. */
export function filtrar(formulas, { grupos, favoritas } = {}) {
  return formulas.filter(f => {
    if (grupos?.length && !grupos.includes(f.grupo)) return false;
    if (favoritas?.length && !favoritas.includes(f.id)) return false;
    return true;
  });
}

/** Variables con unidad: las unicas que se pueden preguntar por unidad. */
export const conUnidad = formula => formula.vars.filter(v => v.unidad);

/**
 * Inventa un ejercicio: valores para todas las variables menos una, y el
 * resultado de despejarla. Devuelve null si no sale nada razonable.
 *
 * Las variables con valor fijo en la formula (la gravedad, por ejemplo) no
 * se inventan: se usan tal cual, que es lo que se espera en un examen.
 */
export function ejercicio(formula, azar, { incognita = null } = {}) {
  const opciones = despejables(formula);
  if (!opciones.length) return null;

  for (let i = 0; i < INTENTOS; i++) {
    const x = incognita || uno(azar, opciones);
    const valores = {};
    for (const v of formula.vars) {
      if (v.n === x) continue;
      valores[v.n] = formula.valores?.[v.n] ?? entero(azar, MIN, MAX);
    }
    const r = resolver(formula, x, valores);
    if (r.error) continue;
    const abs = Math.abs(r.valor);
    if (abs > TOPE || (abs !== 0 && abs < SUELO)) continue;
    return { incognita: x, valores, valor: r.valor };
  }
  return null;
}

/**
 * Genera una pregunta. `textos` trae las funciones que traducen:
 *   nombre(formula), variable(n), unidad(u), numero(x), frase(clave, params)
 */
export function pregunta(formula, tipo, { textos, azar = Math.random, formato = 'escribir' } = {}) {
  const { nombre, variable, unidad, numero, frase } = textos;
  const base = { id: `${formula.id}:${tipo}`, tipo, tema: formula.id, grupo: formula.grupo, formato };

  switch (tipo) {
    /* La expresion siempre va con opciones: escribirla a mano se corrige
       fatal y no es lo que se quiere practicar. */
    case 'expresion':
      return {
        ...base,
        formato: 'opciones',
        enunciado: nombre(formula),
        pide: frase('quiz.pide.expresion', { que: nombre(formula) }),
        respuesta: formula.expr,
        clase: 'texto'
      };

    case 'nombre':
      return {
        ...base,
        enunciado: formula.expr,
        pide: frase('quiz.pide.nombreFormula', { que: formula.expr }),
        respuesta: nombre(formula),
        clase: 'texto'
      };

    /* Que significa una letra dentro de la formula. Algunas variables
       comparten letra («a» es cateto y aceleracion): valen las dos. */
    case 'variable': {
      const v = uno(azar, formula.vars);
      if (!v) return null;
      const texto = variable(v.n);
      return {
        ...base,
        id: `${formula.id}:variable:${v.n}`,
        enunciado: `${v.n} · ${formula.expr}`,
        pide: frase('quiz.pide.variable', { letra: v.n, formula: formula.expr }),
        respuesta: texto,
        aceptadas: [texto, ...texto.split('/').map(s => s.trim())].filter(Boolean),
        clase: 'texto'
      };
    }

    case 'unidad': {
      const v = uno(azar, conUnidad(formula));
      if (!v) return null;
      // Se pregunta por la letra, no por el nombre: hay letras que valen
      // para dos cosas («a» es cateto y aceleracion) y dentro de una
      // formula concreta no hay duda de cual es.
      return {
        ...base,
        id: `${formula.id}:unidad:${v.n}`,
        enunciado: `${v.n} · ${formula.expr}`,
        pide: frase('quiz.pide.unidadDe', { letra: v.n, formula: formula.expr }),
        respuesta: unidad(v.unidad),
        clase: 'unidad'
      };
    }

    case 'calcular': {
      const e = ejercicio(formula, azar);
      if (!e) return null;
      const datos = formula.vars
        .filter(v => v.n !== e.incognita)
        .map(v => `${v.n} = ${numero(e.valores[v.n])}${v.unidad ? ` ${unidad(v.unidad)}` : ''}`)
        .join(', ');
      // La unidad esperada va en la pregunta: sin ella no se sabe si el
      // resultado se quiere en metros o en centimetros.
      const incognita = formula.vars.find(v => v.n === e.incognita);
      const pedida = incognita?.unidad
        ? `${e.incognita} (${unidad(incognita.unidad)})`
        : e.incognita;
      return {
        ...base,
        id: `${formula.id}:calcular:${e.incognita}`,
        enunciado: `${nombre(formula)} · ${datos}`,
        pide: frase('quiz.pide.calcular', { que: pedida, formula: formula.expr, datos }),
        respuesta: e.valor,
        clase: 'numero'
      };
    }

    default:
      return null;
  }
}

/**
 * Genera la tanda entera: por cada formula que pase el filtro, una pregunta
 * de cada tipo activo. Las que no salen (sin unidades, sin despeje posible)
 * se quedan fuera sin ruido.
 */
export function generar(formulas, { tipos = TIPOS, filtros = {}, ...resto } = {}) {
  const activos = tipos.filter(x => TIPOS.includes(x));
  const salida = [];
  for (const formula of filtrar(formulas, filtros)) {
    for (const tipo of activos) {
      const p = pregunta(formula, tipo, resto);
      if (p) salida.push(p);
    }
  }
  return salida;
}
