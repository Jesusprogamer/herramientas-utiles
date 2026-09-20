/**
 * Recuadro de «Clase actual y siguiente» en el inicio.
 */
import { h } from '../../ui/dom.js';
import { caja, vacio } from '../../ui/widget.js';
import * as storage from '../../core/storage.js';
import * as subjects from '../../core/subjects.js';
import { t } from '../../core/i18n.js';
import { queToca, aMinutos } from '../../lib/schedule.js';

const KEY = 'horario';
const RUTA = '/h/horario';

/** Minutos que faltan para que acabe la clase en curso. */
export function quedan(franja, ahora = new Date()) {
  const fin = aMinutos(franja?.fin);
  if (fin === null) return null;
  return Math.max(0, fin - (ahora.getHours() * 60 + ahora.getMinutes()));
}

export default function widget({ ahora = new Date() } = {}) {
  const guardado = storage.get(KEY, null);
  const franjas = Array.isArray(guardado?.franjas) ? guardado.franjas : [];
  const clases = guardado?.clases && typeof guardado.clases === 'object' ? guardado.clases : {};
  const { ahora: actual, siguiente } = queToca(clases, franjas, ahora);

  if (!actual && !siguiente) {
    return vacio('horario', {
      titulo: t('widgets.horario.titulo'),
      mensaje: t('widgets.horario.sinMas'),
      ruta: RUTA
    });
  }

  const seccion = caja('horario', { titulo: t('widgets.horario.titulo'), ruta: RUTA });
  const ul = h('ul.widget__lista');

  const fila = (x, enCurso) => {
    const asignatura = subjects.byId(x.clase.asignaturaId);
    if (!asignatura) return null;
    const punto = h('span.asig__punto', { 'aria-hidden': 'true' });
    punto.classList.add(`asig--${asignatura.color}`);
    const restan = enCurso ? quedan(x.franja, ahora) : null;
    return h('li.widget__item',
      punto,
      h('div.grow',
        h('p.widget__nombre', { text: asignatura.nombre }),
        h('p.small.muted', {
          text: [
            `${x.franja.inicio}–${x.franja.fin}`,
            x.clase.aula || null
          ].filter(Boolean).join(' · ')
        })),
      h('span.widget__cuenta', {
        class: `widget__cuenta widget__cuenta--${enCurso ? 'hoy' : 'lejos'}`,
        text: enCurso ? t('widgets.horario.quedan', { n: restan }) : t('widgets.horario.despues')
      })
    );
  };

  for (const [x, enCurso] of [[actual, true], [siguiente, false]]) {
    if (!x) continue;
    const li = fila(x, enCurso);
    if (li) ul.appendChild(li);
  }

  if (!ul.children.length) {
    return vacio('horario', {
      titulo: t('widgets.horario.titulo'),
      mensaje: t('widgets.horario.sinMas'),
      ruta: RUTA
    });
  }
  seccion.appendChild(ul);
  return seccion;
}
