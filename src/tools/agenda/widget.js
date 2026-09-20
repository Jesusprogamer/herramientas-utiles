/**
 * Recuadro de la agenda en el inicio.
 *
 * Devuelve null cuando no hay ningun examen proximo, para que el inicio
 * no se llene de cajas vacias. Se carga con import() perezoso desde
 * src/views/home.js, asi que no pesa en el arranque.
 */
import { h } from '../../ui/dom.js';
import { t, formatDate } from '../../core/i18n.js';
import { navigate } from '../../core/router.js';
import * as subjects from '../../core/subjects.js';
import { aFecha, diasHasta, proximos, cuandoClave, urgencia } from '../../lib/agenda.js';
import { leer } from './store.js';

export const MAX_EN_INICIO = 3;

/** Texto de «cuanto falta», ya traducido. */
export function cuando(dias) {
  const clave = cuandoClave(dias);
  return clave ? t(`agenda.cuando.${clave}`, { n: dias }) : '';
}

export default function homeWidget({ ahora = new Date() } = {}) {
  const { examenes } = leer();
  const lista = proximos(examenes.filter(e => !e.hecho), ahora, MAX_EN_INICIO);
  if (!lista.length) return null;

  const caja = h('section.widget', { 'aria-labelledby': 'widget-agenda' });
  caja.append(
    h('div.row',
      h('h2.widget__titulo#widget-agenda', { text: t('agenda.proximos') }),
      h('button.btn.btn--sm', {
        type: 'button',
        text: t('agenda.verTodos'),
        onClick: () => navigate('/h/agenda')
      })
    )
  );

  const ul = h('ul.widget__lista');
  for (const examen of lista) {
    const dias = diasHasta(examen.dia, ahora);
    const asignatura = examen.asignaturaId ? subjects.byId(examen.asignaturaId) : null;
    const fecha = aFecha(examen.dia, examen.hora);

    const punto = h('span.asig__punto', { 'aria-hidden': 'true' });
    if (asignatura) punto.classList.add(`asig--${asignatura.color}`);

    ul.appendChild(h('li.widget__item',
      punto,
      h('div.grow',
        h('p.widget__nombre', { text: examen.titulo || asignatura?.nombre || t('agenda.sinTitulo') }),
        h('p.small.muted', {
          text: [
            asignatura && examen.titulo ? asignatura.nombre : null,
            formatDate(fecha, examen.hora ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' })
          ].filter(Boolean).join(' · ')
        })),
      h('span.widget__cuenta', { class: `widget__cuenta widget__cuenta--${urgencia(dias)}`, text: cuando(dias) })
    ));
  }
  caja.appendChild(ul);
  return caja;
}
