/**
 * Asignaturas compartidas.
 *
 * Las usan la calculadora de notas, la agenda de examenes y el horario:
 * se crean una vez y valen para las tres. Cada asignatura tiene nombre,
 * color e id estable; el nombre lo escribe la persona, asi que NO se
 * traduce y nunca se mete con innerHTML.
 */
import * as storage from './storage.js';
import { emit } from './events.js';

const KEY = 'asignaturas';

/** Colores disponibles; el valor real lo pone el tema en CSS. */
export const COLORES = ['azul', 'verde', 'naranja', 'rosa', 'violeta', 'cian', 'amarillo', 'gris'];

export const MAX_NOMBRE = 40;
export const MAX_ASIGNATURAS = 30;

let lista = [];
let cargado = false;

/** Id corto y estable; no hace falta que sea criptografico. */
function nuevoId() {
  const azar = crypto.getRandomValues(new Uint32Array(2));
  return `a${azar[0].toString(36)}${azar[1].toString(36)}`;
}

function limpiarNombre(nombre) {
  return String(nombre ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_NOMBRE);
}

function sanear(guardado) {
  if (!Array.isArray(guardado)) return [];
  const vistos = new Set();
  return guardado
    .map(a => ({
      id: typeof a?.id === 'string' && a.id ? a.id : nuevoId(),
      nombre: limpiarNombre(a?.nombre),
      color: COLORES.includes(a?.color) ? a.color : COLORES[0]
    }))
    .filter(a => {
      if (!a.nombre || vistos.has(a.id)) return false;
      vistos.add(a.id);
      return true;
    })
    .slice(0, MAX_ASIGNATURAS);
}

export function load() {
  lista = sanear(storage.get(KEY, []));
  cargado = true;
  return lista;
}

function guardar() {
  storage.set(KEY, lista);
  emit('asignaturas:change', { asignaturas: [...lista] });
}

/** Copia de la lista: quien la reciba no puede cambiarla por accidente. */
export function all() {
  if (!cargado) load();
  return lista.map(a => ({ ...a }));
}

export function byId(id) {
  if (!cargado) load();
  const a = lista.find(x => x.id === id);
  return a ? { ...a } : null;
}

/** Nombre de una asignatura, o el texto de respaldo si ya no existe. */
export function nombreDe(id, siNoEsta = '') {
  return byId(id)?.nombre || siNoEsta;
}

/** Anade una asignatura. Devuelve la creada, o null si no cabe o esta vacia. */
export function add(nombre, color = COLORES[0]) {
  if (!cargado) load();
  const limpio = limpiarNombre(nombre);
  if (!limpio || lista.length >= MAX_ASIGNATURAS) return null;
  const asignatura = {
    id: nuevoId(),
    nombre: limpio,
    color: COLORES.includes(color) ? color : COLORES[lista.length % COLORES.length]
  };
  lista = [...lista, asignatura];
  guardar();
  return { ...asignatura };
}

export function update(id, cambios) {
  if (!cargado) load();
  const i = lista.findIndex(a => a.id === id);
  if (i < 0) return null;
  const nombre = cambios.nombre !== undefined ? limpiarNombre(cambios.nombre) : lista[i].nombre;
  if (!nombre) return null;
  const color = COLORES.includes(cambios.color) ? cambios.color : lista[i].color;
  lista = lista.map((a, j) => (j === i ? { ...a, nombre, color } : a));
  guardar();
  return { ...lista[i] };
}

/**
 * Quita una asignatura. Lo que dependiera de ella se entera por el evento
 * `asignaturas:change`: aqui no se borra nada de otras herramientas.
 */
export function remove(id) {
  if (!cargado) load();
  const antes = lista.length;
  lista = lista.filter(a => a.id !== id);
  if (lista.length === antes) return false;
  guardar();
  return true;
}

export function move(id, delta) {
  if (!cargado) load();
  const from = lista.findIndex(a => a.id === id);
  if (from < 0) return false;
  const to = from + delta;
  if (to < 0 || to >= lista.length) return false;
  const copia = [...lista];
  copia.splice(to, 0, copia.splice(from, 1)[0]);
  lista = copia;
  guardar();
  return true;
}

/** Color siguiente que toca, para que dos seguidas no salgan iguales. */
export function colorSugerido() {
  if (!cargado) load();
  const usados = new Set(lista.map(a => a.color));
  return COLORES.find(c => !usados.has(c)) || COLORES[lista.length % COLORES.length];
}
