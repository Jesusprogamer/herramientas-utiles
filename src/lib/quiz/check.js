/**
 * Comprobador de respuestas.
 *
 * Es la pieza mas delicada del modo test: decide si algo cuenta como
 * acierto. Modulo puro, sin DOM, y con pruebas exhaustivas, porque un
 * fallo aqui se nota en cada pregunta.
 */

/** Quita tildes y pasa a minusculas. */
export const plano = texto =>
  String(texto ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** Distancia de edicion, cortando en cuanto se pasa del tope. */
export function distancia(a, b, tope = 2) {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > tope) return tope + 1;
  let previa = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const fila = [i];
    let minima = i;
    for (let j = 1; j <= b.length; j++) {
      const coste = a[i - 1] === b[j - 1] ? 0 : 1;
      fila[j] = Math.min(previa[j] + 1, fila[j - 1] + 1, previa[j - 1] + coste);
      minima = Math.min(minima, fila[j]);
    }
    if (minima > tope) return tope + 1;
    previa = fila;
  }
  return previa[b.length];
}

/**
 * Texto: nombres y simbolos.
 * `aceptadas` son todas las formas validas (por ejemplo el nombre en varios
 * idiomas). `erratas` permite una letra de diferencia, solo en palabras de
 * cinco letras o mas: en «Na» una letra mal es otro elemento.
 */
export function comprobarTexto(respuesta, aceptadas, opciones = {}) {
  const { tildes = false, erratas = true, mayusculas = false, minimoErrata = 5 } = opciones;
  const lista = (Array.isArray(aceptadas) ? aceptadas : [aceptadas]).filter(Boolean).map(String);
  const dada = String(respuesta ?? '').trim();
  if (!dada) return false;

  for (const buena of lista) {
    if (mayusculas) {
      // Exigir mayusculas correctas: «na» no vale por «Na».
      if (dada === buena.trim()) return true;
      continue;
    }
    const a = tildes ? dada.toLowerCase().trim() : plano(dada);
    const b = tildes ? buena.toLowerCase().trim() : plano(buena);
    if (a === b) return true;
    if (erratas && b.length >= minimoErrata && distancia(a, b, 1) <= 1) return true;
  }
  return false;
}

/** Acepta coma o punto decimal; devuelve null si no es un numero. */
export function aNumero(texto) {
  const limpio = String(texto ?? '').trim().replace(/\s/g, '').replace(',', '.');
  if (limpio === '' || !/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(limpio)) return null;
  const n = Number(limpio);
  return Number.isFinite(n) ? n : null;
}

/**
 * Numeros, con la tolerancia elegida:
 *   { modo: 'entero' }            se redondea a entero
 *   { modo: 'decimales', n: 1 }   se compara con n decimales
 *   { modo: 'absoluta', valor }   ± ese valor
 *   { modo: 'porcentaje', valor } ± ese porcentaje
 */
export function comprobarNumero(respuesta, correcta, tolerancia = { modo: 'decimales', n: 2 }) {
  const dada = aNumero(respuesta);
  if (dada === null || !Number.isFinite(correcta)) return false;

  switch (tolerancia.modo) {
    case 'entero':
      return Math.round(dada) === Math.round(correcta);
    case 'absoluta':
      return Math.abs(dada - correcta) <= Math.abs(tolerancia.valor ?? 0);
    case 'porcentaje': {
      const margen = Math.abs(correcta * (tolerancia.valor ?? 0) / 100);
      return Math.abs(dada - correcta) <= margen;
    }
    case 'decimales':
    default: {
      const n = Number.isInteger(tolerancia.n) ? tolerancia.n : 2;
      const f = 10 ** n;
      return Math.round(dada * f) === Math.round(correcta * f);
    }
  }
}

/**
 * Unidades: `m/s`, `m·s⁻¹` y `m s^-1` son la misma cosa.
 * Se normaliza a una forma canonica y se comparan.
 */
export function normalizarUnidad(texto) {
  let u = String(texto ?? '').trim().toLowerCase();
  if (!u) return '';

  // Superindices a ^n
  const sup = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '⁻': '-' };
  u = u.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻]/g, c => (sup[c] === '-' ? '^-' : `^${sup[c]}`));
  u = u.replace(/\^\^/g, '^').replace(/\^-\^/g, '^-');

  // Separadores de multiplicacion: punto medio, asterisco o espacio
  u = u.replace(/[·*×]/g, ' ').replace(/\s+/g, ' ').trim();

  // Division: lo de despues pasa a exponente negativo
  const partes = u.split('/');
  const trozos = [];
  const desmontar = (bloque, signo) => {
    for (const pieza of bloque.split(' ').filter(Boolean)) {
      const m = pieza.match(/^([a-zµωΩ°]+)(?:\^(-?\d+))?$/i);
      if (!m) { trozos.push({ base: pieza, exp: signo }); continue; }
      trozos.push({ base: m[1], exp: (m[2] ? Number(m[2]) : 1) * signo });
    }
  };
  desmontar(partes[0] || '', 1);
  for (const resto of partes.slice(1)) desmontar(resto, -1);

  // Se juntan los exponentes de la misma base y se ordena alfabeticamente,
  // para que el orden en que se escriba no importe.
  const mapa = new Map();
  for (const { base, exp } of trozos) mapa.set(base, (mapa.get(base) || 0) + exp);
  return [...mapa]
    .filter(([, exp]) => exp !== 0)
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([base, exp]) => (exp === 1 ? base : `${base}^${exp}`))
    .join(' ');
}

export function comprobarUnidad(respuesta, correcta) {
  const a = normalizarUnidad(respuesta);
  return a !== '' && a === normalizarUnidad(correcta);
}

/**
 * Configuracion electronica.
 * Se admite la completa, la abreviada con gas noble, o ambas, y el formato
 * da igual: con o sin superindices, con ^ o sin el, y con los espacios que
 * sean. `1s2 2s2` y `1s²2s²` son lo mismo.
 */
export function normalizarConfig(texto) {
  const sup = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9' };
  const limpio = String(texto ?? '')
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, c => sup[c])
    .replace(/\^/g, '')
    .toLowerCase();

  // Se sacan las piezas una a una en vez de partir por espacios: asi
  // «1s²2s²» (sin separar) vale igual que «1s2 2s2».
  const nucleo = limpio.match(/\[[a-z]+\]/)?.[0] || '';
  // El (?![spdfg]) evita que en «1s22s2» el contador se coma el 2 del
  // siguiente subnivel: si tras los digitos viene una letra de subnivel,
  // esos digitos eran el numero de capa, no el de electrones.
  const subniveles = [...limpio.matchAll(/(\d{1,2})\s*([spdfg])\s*(\d{1,2})?(?![spdfg])/g)]
    .map(m => `${m[1]}${m[2]}${m[3] || '1'}`)
    .sort();

  if (!subniveles.length && !nucleo) return '';
  // El nucleo delante y los subniveles ordenados: el orden en que se
  // escriban (4s2 3d1 o 3d1 4s2) no cambia el resultado.
  return [nucleo, ...subniveles].filter(Boolean).join(' ');
}

export function comprobarConfig(respuesta, { completa, abreviada }, forma = 'ambas') {
  const dada = normalizarConfig(respuesta);
  if (!dada) return false;
  const validas = [];
  if (forma === 'completa' || forma === 'ambas') validas.push(completa);
  if (forma === 'abreviada' || forma === 'ambas') validas.push(abreviada);
  return validas.filter(Boolean).some(v => normalizarConfig(v) === dada);
}

/** Lee valencias escritas como «2, 3», «+2 +3» o «-1». */
export function leerValencias(texto) {
  return String(texto ?? '')
    .split(/[,;\s]+/)
    .map(x => x.trim())
    .filter(Boolean)
    .map(x => Number(x.replace(/^\+/, '')))
    .filter(Number.isFinite);
}

/**
 * Valencias (estados de oxidacion).
 *   modo 'una'    basta con dar una de las aceptadas
 *   modo 'todas'  hay que dar el conjunto completo, sin sobrar ni faltar
 * `penalizar` hace que una valencia no aceptada invalide la respuesta
 * aunque las demas esten bien.
 */
export function comprobarValencias(respuesta, aceptadas, { modo = 'una', penalizar = false } = {}) {
  const dadas = [...new Set(leerValencias(respuesta))];
  const buenas = [...new Set((aceptadas || []).filter(Number.isFinite))];
  if (!dadas.length || !buenas.length) return false;

  const sobran = dadas.filter(v => !buenas.includes(v));
  if (penalizar && sobran.length) return false;

  if (modo === 'todas') {
    return sobran.length === 0
      && buenas.every(v => dadas.includes(v))
      && dadas.length === buenas.length;
  }
  return dadas.some(v => buenas.includes(v));
}
