/**
 * Piezas compartidas por los recuadros del inicio.
 */
import { h } from './dom.js';
import { t } from '../core/i18n.js';
import { navigate } from '../core/router.js';

/** Caja con titulo y enlace a la herramienta. */
export function caja(id, { titulo, ruta, accion }) {
  const seccion = h('section.widget', { 'aria-labelledby': `widget-${id}` });
  seccion.dataset.widget = id;
  seccion.appendChild(h('div.row',
    h('h2.widget__titulo', { id: `widget-${id}`, text: titulo }),
    h('button.btn.btn--sm', {
      type: 'button',
      text: accion || t('widgets.abrir'),
      onClick: () => navigate(ruta)
    })
  ));
  return seccion;
}

/** Estado vacio de una linea con enlace a su herramienta. */
export function vacio(id, { titulo, mensaje, ruta, accion }) {
  const seccion = caja(id, { titulo, ruta, accion });
  seccion.appendChild(h('p.small.muted.widget__vacio', { text: mensaje }));
  return seccion;
}
