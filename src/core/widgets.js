/**
 * Recuadros del inicio.
 *
 * Cada herramienta que quiera uno pone un `widget.js` en su carpeta con un
 * `export default` que devuelve un elemento, o null si no tiene nada que
 * enseñar. Aqui solo esta el catalogo, el orden y que esta activado; el
 * codigo de cada uno se carga solo si hace falta.
 */
import * as storage from './storage.js';
import { emit } from './events.js';

const KEY = 'widgets';

/** Catalogo. `ruta` es el modulo, `tool` la herramienta a la que lleva. */
export const WIDGETS = Object.freeze([
  { id: 'agenda', tool: 'agenda', ruta: '../tools/agenda/widget.js' },
  { id: 'tareas', tool: 'listas', ruta: '../tools/listas/widget.js' },
  { id: 'horario', tool: 'horario', ruta: '../tools/horario/widget.js' },
  { id: 'temporizador', tool: 'temporizador', ruta: '../tools/temporizador/widget.js' },
  { id: 'zonas', tool: 'zonas-horarias', ruta: '../tools/zonas-horarias/widget.js' }
]);

const IDS = WIDGETS.map(w => w.id);
/** Los tres primeros vienen activados: son los del dia a dia. */
const POR_DEFECTO = ['agenda', 'tareas', 'horario'];

function sanear(guardado) {
  const orden = Array.isArray(guardado?.orden)
    ? [...new Set(guardado.orden.filter(id => IDS.includes(id)))]
    : [];
  const activos = Array.isArray(guardado?.activos)
    ? guardado.activos.filter(id => IDS.includes(id))
    : null;
  return {
    // Los que se añadan en el futuro entran al final, no se pierden.
    orden: [...orden, ...IDS.filter(id => !orden.includes(id))],
    activos: activos || [...POR_DEFECTO]
  };
}

export function prefs() {
  return sanear(storage.get(KEY, null));
}

function guardar(p) {
  storage.set(KEY, p);
  emit('widgets:change', { prefs: p });
}

export function estaActivo(id) {
  return prefs().activos.includes(id);
}

export function setActivo(id, activo) {
  if (!IDS.includes(id)) return;
  const p = prefs();
  const set = new Set(p.activos);
  activo ? set.add(id) : set.delete(id);
  guardar({ ...p, activos: [...set] });
}

/** Mueve un recuadro arriba (-1) o abajo (+1). */
export function mover(id, delta) {
  const p = prefs();
  const from = p.orden.indexOf(id);
  if (from < 0) return false;
  const to = from + delta;
  if (to < 0 || to >= p.orden.length) return false;
  const orden = [...p.orden];
  orden.splice(to, 0, orden.splice(from, 1)[0]);
  guardar({ ...p, orden });
  return true;
}

/** Los activos, en el orden elegido. */
export function activos() {
  const p = prefs();
  return p.orden.map(id => WIDGETS.find(w => w.id === id)).filter(w => w && p.activos.includes(w.id));
}

/** Todos, en el orden elegido, con su estado: para la pantalla de Ajustes. */
export function listados() {
  const p = prefs();
  return p.orden
    .map(id => WIDGETS.find(w => w.id === id))
    .filter(Boolean)
    .map(w => ({ ...w, activo: p.activos.includes(w.id) }));
}
