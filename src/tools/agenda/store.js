/**
 * Lo que la agenda guarda, compartido entre la herramienta y el recuadro
 * del inicio para que los dos lean exactamente lo mismo.
 */
import * as storage from '../../core/storage.js';

export const KEY = 'agenda';
export const MAX_TITULO = 80;
export const MAX_NOTAS = 500;
export const MAX_EXAMENES = 200;

/** Minutos de aviso que se ofrecen al exportar. */
export const AVISOS = [0, 60, 1440, 2880, 10080];

const limpiar = texto => String(texto ?? '').replace(/\s+/g, ' ').trim();

function sanearExamen(e) {
  if (!e || typeof e !== 'object') return null;
  const dia = typeof e.dia === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(e.dia) ? e.dia : null;
  if (!dia) return null;
  return {
    id: typeof e.id === 'string' && e.id ? e.id : nuevoId(),
    dia,
    hora: typeof e.hora === 'string' && /^\d{2}:\d{2}$/.test(e.hora) ? e.hora : null,
    titulo: limpiar(e.titulo).slice(0, MAX_TITULO),
    asignaturaId: typeof e.asignaturaId === 'string' ? e.asignaturaId : '',
    lugar: limpiar(e.lugar).slice(0, MAX_TITULO),
    notas: String(e.notas ?? '').slice(0, MAX_NOTAS),
    hecho: e.hecho === true
  };
}

export function nuevoId() {
  const azar = crypto.getRandomValues(new Uint32Array(2));
  return `e${azar[0].toString(36)}${azar[1].toString(36)}`;
}

export function leer() {
  const guardado = storage.get(KEY, null);
  const lista = Array.isArray(guardado?.examenes) ? guardado.examenes : [];
  return {
    examenes: lista.map(sanearExamen).filter(Boolean).slice(0, MAX_EXAMENES),
    aviso: AVISOS.includes(guardado?.aviso) ? guardado.aviso : 1440,
    verPasados: guardado?.verPasados === true
  };
}

export function escribir(estado) {
  storage.set(KEY, {
    examenes: estado.examenes.map(sanearExamen).filter(Boolean),
    aviso: estado.aviso,
    verPasados: estado.verPasados
  });
}
