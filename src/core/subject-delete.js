/**
 * Borrar una asignatura se lleva consigo lo que colgaba de ella.
 *
 * Las notas, los examenes y las clases de una asignatura no tienen sentido
 * sin ella, asi que van a la papelera en el mismo lote: un solo «Deshacer»
 * devuelve la asignatura y todo lo suyo.
 *
 * Aqui no se toca el DOM: solo se leen y escriben datos.
 */
import * as storage from './storage.js';
import * as subjects from './subjects.js';

/** Lo que cuelga de una asignatura, listo para mandar a la papelera. */
export function vinculados(id) {
  const salida = [];

  // Notas: la clave guarda { porAsignatura: { <id>: [...] } }
  const notas = storage.get('notas', null);
  if (notas?.porAsignatura?.[id]?.length) {
    salida.push({
      clave: 'notas', ruta: ['porAsignatura'], pos: null,
      tool: 'notas', tipo: 'notasDeAsignatura', mapa: true, mapaClave: id,
      datos: notas.porAsignatura[id]
    });
  }

  // Examenes de la agenda
  const agenda = storage.get('agenda', null);
  const examenes = Array.isArray(agenda?.examenes) ? agenda.examenes : [];
  examenes.forEach((examen, pos) => {
    if (examen?.asignaturaId !== id) return;
    salida.push({
      clave: 'agenda', ruta: ['examenes'], pos,
      tool: 'agenda', tipo: 'examen',
      etiqueta: examen.titulo || '', datos: examen
    });
  });

  // Clases del horario: es un objeto { "dia:franja": { asignaturaId } }
  const horario = storage.get('horario', null);
  const clases = horario?.clases && typeof horario.clases === 'object' ? horario.clases : {};
  for (const [celda, clase] of Object.entries(clases)) {
    if (clase?.asignaturaId !== id) continue;
    salida.push({
      clave: 'horario', ruta: ['clases'], pos: null,
      tool: 'horario', tipo: 'clase', mapa: true, mapaClave: celda,
      etiqueta: celda, datos: clase
    });
  }

  return salida;
}

/** Quita de su sitio todo lo vinculado (ya guardado en la papelera). */
export function quitarVinculados(id) {
  const notas = storage.get('notas', null);
  if (notas?.porAsignatura?.[id]) {
    const copia = { ...notas, porAsignatura: { ...notas.porAsignatura } };
    delete copia.porAsignatura[id];
    storage.set('notas', copia);
  }

  const agenda = storage.get('agenda', null);
  if (Array.isArray(agenda?.examenes)) {
    storage.set('agenda', { ...agenda, examenes: agenda.examenes.filter(e => e?.asignaturaId !== id) });
  }

  const horario = storage.get('horario', null);
  if (horario?.clases && typeof horario.clases === 'object') {
    const clases = { ...horario.clases };
    for (const [celda, clase] of Object.entries(clases)) {
      if (clase?.asignaturaId === id) delete clases[celda];
    }
    storage.set('horario', { ...horario, clases });
  }
}

/**
 * Prepara el lote completo: la asignatura y lo suyo.
 * La asignatura va primero para que, al restaurar, ya exista cuando
 * vuelvan sus examenes y sus clases.
 */
export function loteDeBorrado(id) {
  const asignatura = subjects.byId(id);
  if (!asignatura) return [];
  const pos = subjects.all().findIndex(a => a.id === id);
  return [
    {
      clave: 'asignaturas', ruta: [], pos,
      tool: 'asignaturas', tipo: 'asignatura',
      etiqueta: asignatura.nombre, datos: asignatura
    },
    ...vinculados(id)
  ];
}
