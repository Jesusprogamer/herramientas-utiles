/**
 * Papelera: la parte que no toca el DOM ni el almacenamiento.
 *
 * Una entrada de papelera es un objeto plano:
 *   { id, grupo, clave, ruta, pos, tool, tipo, etiqueta, datos, borradoEn }
 *
 * `clave` y `ruta` dicen donde vuelve: la clave de almacenamiento de su
 * herramienta y, dentro de lo guardado, el camino hasta la lista. `pos` es
 * el sitio que ocupaba, para devolverlo donde estaba y no al final.
 */

export const RETENCIONES = [7, 14, 30, 90];
export const RETENCION_POR_DEFECTO = 30;
export const MAX_ENTRADAS = 500;
const DIA_MS = 24 * 60 * 60 * 1000;

/** Mete `datos` en `lista` en la posicion que tenia, sin salirse. */
export function insertarEn(lista, datos, pos) {
  const copia = Array.isArray(lista) ? [...lista] : [];
  const i = Number.isInteger(pos) ? Math.min(Math.max(pos, 0), copia.length) : copia.length;
  copia.splice(i, 0, datos);
  return copia;
}

/**
 * Devuelve varias entradas del mismo lote a la vez.
 * Se insertan de la posicion mas baja a la mas alta: asi cada una cae donde
 * estaba, en vez de irse desplazando entre ellas.
 */
export function restaurarLote(lista, entradas) {
  let salida = Array.isArray(lista) ? [...lista] : [];
  for (const entrada of [...entradas].sort((a, b) => (a.pos ?? 0) - (b.pos ?? 0))) {
    salida = insertarEn(salida, entrada.datos, entrada.pos);
  }
  return salida;
}

/** Entradas que ya han cumplido su plazo. */
export function caducadas(entradas, dias = RETENCION_POR_DEFECTO, ahora = Date.now()) {
  const limite = ahora - Math.max(1, dias) * DIA_MS;
  return entradas.filter(e => Number.isFinite(e.borradoEn) && e.borradoEn < limite);
}

/** Lo que sobrevive a la purga, en el mismo orden. */
export function trasPurgar(entradas, dias = RETENCION_POR_DEFECTO, ahora = Date.now()) {
  const fuera = new Set(caducadas(entradas, dias, ahora).map(e => e.id));
  return entradas.filter(e => !fuera.has(e.id));
}

/**
 * Recorta la papelera si se pasa del tope, tirando primero lo mas antiguo.
 * Nunca toca datos activos: solo lo que ya estaba borrado.
 */
export function recortar(entradas, max = MAX_ENTRADAS) {
  if (entradas.length <= max) return entradas;
  const orden = [...entradas].sort((a, b) => (b.borradoEn || 0) - (a.borradoEn || 0));
  const quedan = new Set(orden.slice(0, max).map(e => e.id));
  return entradas.filter(e => quedan.has(e.id));
}

/** Normaliza para buscar sin tildes ni mayusculas. */
const plano = texto =>
  String(texto ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Filtra por texto de la etiqueta o por herramienta. */
export function buscar(entradas, consulta) {
  const q = plano(consulta).trim();
  if (!q) return entradas;
  return entradas.filter(e => plano(e.etiqueta).includes(q) || plano(e.tool).includes(q));
}

/** Agrupa por herramienta conservando el orden de llegada. */
export function porHerramienta(entradas) {
  const mapa = new Map();
  for (const e of entradas) {
    if (!mapa.has(e.tool)) mapa.set(e.tool, []);
    mapa.get(e.tool).push(e);
  }
  return [...mapa].map(([tool, lista]) => ({ tool, entradas: lista }));
}

/** De la mas reciente a la mas antigua. */
export function masRecientesPrimero(entradas) {
  return [...entradas].sort((a, b) => (b.borradoEn || 0) - (a.borradoEn || 0));
}
