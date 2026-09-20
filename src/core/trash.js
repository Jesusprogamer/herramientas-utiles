/**
 * Papelera con deshacer.
 *
 * Todo borrado de contenido del usuario pasa por aqui: en vez de eliminar,
 * se guarda una entrada con lo borrado y de donde salio. Asi el aviso de
 * «Deshacer» puede devolverlo a su sitio, y lo que no se deshaga se queda
 * unos dias en la papelera de Ajustes.
 *
 * Es un borrado logico con fecha, que es lo que la sincronizacion necesita:
 * nunca se pierde la pista de lo que se quito ni de cuando.
 */
import * as storage from './storage.js';
import { emit } from './events.js';
import {
  RETENCIONES, RETENCION_POR_DEFECTO, MAX_ENTRADAS,
  restaurarLote, trasPurgar, recortar, buscar, porHerramienta, masRecientesPrimero
} from '../lib/trash.js';

export { RETENCIONES, RETENCION_POR_DEFECTO, buscar, porHerramienta, masRecientesPrimero };

const KEY = 'papelera';
const AJUSTES_KEY = 'papelera-ajustes';

function nuevoId(prefijo = 'p') {
  const azar = crypto.getRandomValues(new Uint32Array(2));
  return `${prefijo}${azar[0].toString(36)}${azar[1].toString(36)}`;
}

function leer() {
  const guardado = storage.get(KEY, []);
  return Array.isArray(guardado) ? guardado : [];
}

function escribir(entradas) {
  storage.set(KEY, recortar(entradas, MAX_ENTRADAS));
  emit('trash:change', { total: entradas.length });
}

/** Dias que se guarda lo borrado. */
export function retencion() {
  const guardado = storage.get(AJUSTES_KEY, null);
  const dias = guardado?.dias;
  return RETENCIONES.includes(dias) ? dias : RETENCION_POR_DEFECTO;
}

export function setRetencion(dias) {
  if (!RETENCIONES.includes(dias)) return;
  storage.set(AJUSTES_KEY, { dias });
  purgar();
}

/**
 * Manda a la papelera uno o varios elementos, como un solo lote.
 *
 * Cada elemento: { clave, ruta, pos, tool, tipo, etiqueta, datos }
 * `clave` es la clave de almacenamiento; `ruta` el camino hasta la lista
 * dentro de lo guardado (vacio si lo guardado ya es la lista).
 *
 * Devuelve el identificador del lote, que es lo que hay que pasarle a
 * `restaurar()` para deshacerlo entero de una vez.
 */
export function enviar(elementos) {
  const lista = Array.isArray(elementos) ? elementos : [elementos];
  if (!lista.length) return null;
  const grupo = nuevoId('g');
  const ahora = Date.now();
  const entradas = lista.map(e => ({
    id: nuevoId(),
    grupo,
    clave: e.clave,
    ruta: Array.isArray(e.ruta) ? e.ruta : [],
    pos: Number.isInteger(e.pos) ? e.pos : null,
    tool: e.tool || 'otros',
    tipo: e.tipo || 'elemento',
    etiqueta: String(e.etiqueta ?? ''),
    // Algunas cosas no viven en una lista sino en un objeto por clave
    // (las clases del horario, las notas de una asignatura).
    mapa: e.mapa === true,
    mapaClave: e.mapaClave ?? null,
    datos: e.datos,
    borradoEn: ahora
  }));
  escribir([...leer(), ...entradas]);
  return grupo;
}

/** Lee la lista que hay al final de `ruta` dentro de lo guardado. */
function listaEn(guardado, ruta) {
  let actual = guardado;
  for (const paso of ruta) actual = actual?.[paso];
  return Array.isArray(actual) ? actual : [];
}

/** Lee el objeto que hay al final de `ruta`. */
function objetoEn(guardado, ruta) {
  let actual = guardado;
  for (const paso of ruta) actual = actual?.[paso];
  return actual && typeof actual === 'object' && !Array.isArray(actual) ? actual : {};
}

/** Escribe la lista (o el objeto) de vuelta al final de `ruta`, sin tocar lo demas. */
function conListaEn(guardado, ruta, lista) {
  if (!ruta.length) return lista;
  const copia = guardado && typeof guardado === 'object' ? { ...guardado } : {};
  let actual = copia;
  for (let i = 0; i < ruta.length - 1; i++) {
    actual[ruta[i]] = actual[ruta[i]] && typeof actual[ruta[i]] === 'object'
      ? { ...actual[ruta[i]] } : {};
    actual = actual[ruta[i]];
  }
  actual[ruta.at(-1)] = lista;
  return copia;
}

/**
 * Devuelve a su sitio todo un lote (o una entrada suelta por su id).
 * Devuelve cuantos elementos han vuelto.
 */
export function restaurar(idOGrupo) {
  const entradas = leer();
  const vuelven = entradas.filter(e => e.grupo === idOGrupo || e.id === idOGrupo);
  if (!vuelven.length) return 0;

  // Se agrupan por destino: cada lista se reescribe una sola vez.
  const porDestino = new Map();
  for (const entrada of vuelven) {
    const destino = `${entrada.clave}|${entrada.ruta.join('.')}`;
    if (!porDestino.has(destino)) porDestino.set(destino, []);
    porDestino.get(destino).push(entrada);
  }

  for (const grupo of porDestino.values()) {
    const { clave, ruta } = grupo[0];
    const enMapa = grupo.filter(e => e.mapa);
    const enLista = grupo.filter(e => !e.mapa);
    let guardado = storage.get(clave, ruta.length ? {} : []);

    if (enLista.length) {
      guardado = conListaEn(guardado, ruta, restaurarLote(listaEn(guardado, ruta), enLista));
    }
    if (enMapa.length) {
      const actual = objetoEn(guardado, ruta);
      const copia = { ...actual };
      for (const entrada of enMapa) copia[entrada.mapaClave] = entrada.datos;
      guardado = conListaEn(guardado, ruta, copia);
    }
    storage.set(clave, guardado);
  }

  const idsVueltos = new Set(vuelven.map(e => e.id));
  escribir(entradas.filter(e => !idsVueltos.has(e.id)));
  emit('trash:restore', { total: vuelven.length, tools: [...new Set(vuelven.map(e => e.tool))] });
  return vuelven.length;
}

/** Quita una entrada de la papelera sin devolverla: esto ya no se recupera. */
export function eliminar(id) {
  const entradas = leer();
  const quedan = entradas.filter(e => e.id !== id);
  if (quedan.length === entradas.length) return false;
  escribir(quedan);
  return true;
}

export function vaciar() {
  escribir([]);
}

/** Tira lo que ha cumplido su plazo. Se llama al arrancar la app. */
export function purgar(ahora = Date.now()) {
  const entradas = leer();
  const quedan = trasPurgar(entradas, retencion(), ahora);
  if (quedan.length !== entradas.length) escribir(quedan);
  return entradas.length - quedan.length;
}

export function listar() {
  return masRecientesPrimero(leer());
}

export function total() {
  return leer().length;
}
