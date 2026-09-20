/**
 * Recuadro de «Tareas de hoy» en el inicio.
 *
 * Lee directamente del almacenamiento: no hace falta cargar la herramienta
 * entera para enseñar cinco lineas.
 */
import { h } from '../../ui/dom.js';
import { caja, vacio } from '../../ui/widget.js';
import * as storage from '../../core/storage.js';
import { t, formatDate } from '../../core/i18n.js';

const KEY = 'tareas';
const RUTA = '/h/listas';
export const MAX = 5;

const dosDigitos = n => String(n).padStart(2, '0');
const hoyISO = (ahora = new Date()) =>
  `${ahora.getFullYear()}-${dosDigitos(ahora.getMonth() + 1)}-${dosDigitos(ahora.getDate())}`;

/**
 * Tareas para hoy y vencidas, sin las hechas.
 * Las vencidas van primero: son las que llevan esperando.
 */
export function deHoy(tareas, ahora = new Date()) {
  const hoy = hoyISO(ahora);
  const conFecha = (Array.isArray(tareas) ? tareas : [])
    .filter(x => x && !x.done && typeof x.due === 'string' && x.due);
  const vencidas = conFecha.filter(x => x.due < hoy).sort((a, b) => (a.due < b.due ? -1 : 1));
  const deHoyMismo = conFecha.filter(x => x.due === hoy);
  return { vencidas, hoy: deHoyMismo, total: vencidas.length + deHoyMismo.length };
}

export default function widget({ ahora = new Date() } = {}) {
  const tareas = storage.get(KEY, []);
  const { vencidas, hoy, total } = deHoy(tareas, ahora);

  if (!total) {
    return vacio('tareas', {
      titulo: t('widgets.tareas.titulo'),
      mensaje: t('widgets.tareas.vacio'),
      ruta: RUTA
    });
  }

  const seccion = caja('tareas', { titulo: t('widgets.tareas.titulo'), ruta: RUTA });
  const ul = h('ul.widget__lista');

  const fila = (tarea, vencida) => {
    const marcar = h('input.check', {
      type: 'checkbox',
      'aria-label': t('listas.tareas.markDone', { text: tarea.text })
    });
    marcar.addEventListener('change', () => {
      // Se escribe leyendo de nuevo: otra pestaña puede haber cambiado algo.
      const actuales = storage.get(KEY, []);
      const i = actuales.findIndex(x => x.id === tarea.id);
      if (i >= 0) {
        actuales[i] = { ...actuales[i], done: true, doneAt: Date.now() };
        storage.set(KEY, actuales);
      }
    });

    const li = h('li.widget__item',
      marcar,
      h('div.grow',
        // Texto escrito por la persona: siempre por textContent.
        h('p.widget__nombre', { text: tarea.text }),
        h('p.small.muted', {
          text: vencida
            ? t('widgets.tareas.vencio', { fecha: formatDate(new Date(`${tarea.due}T00:00:00`), { dateStyle: 'medium' }) })
            : t('widgets.tareas.paraHoy')
        }))
    );
    if (vencida) li.classList.add('widget__item--urgente');
    return li;
  };

  for (const tarea of [...vencidas, ...hoy].slice(0, MAX)) {
    ul.appendChild(fila(tarea, tarea.due < hoyISO(ahora)));
  }
  seccion.appendChild(ul);

  if (total > MAX) {
    seccion.appendChild(h('p.small.muted', { text: t('widgets.tareas.mas', { n: total - MAX }) }));
  }
  return seccion;
}
