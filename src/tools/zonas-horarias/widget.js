/**
 * Recuadro de «Hora en mis ciudades» en el inicio.
 */
import { h } from '../../ui/dom.js';
import { caja, vacio } from '../../ui/widget.js';
import * as storage from '../../core/storage.js';
import { t, formatTime } from '../../core/i18n.js';

const KEY = 'zonas-horarias';
const RUTA = '/h/zonas-horarias';
export const MAX = 3;

/** Diferencia en horas con la zona de aqui, con su signo. */
export function diferencia(zona, ahora = new Date()) {
  const enZona = new Date(ahora.toLocaleString('en-US', { timeZone: zona }));
  const aqui = new Date(ahora.toLocaleString('en-US'));
  return Math.round((enZona - aqui) / 3600000);
}

/** De dia entre las 7 y las 21 en la hora de esa zona. */
export function esDeDia(zona, ahora = new Date()) {
  const hora = Number(new Intl.DateTimeFormat('en-GB', {
    timeZone: zona, hour: '2-digit', hour12: false
  }).format(ahora));
  return hora >= 7 && hora < 21;
}

export default function widget({ ahora = new Date() } = {}) {
  // La herramienta guarda un array de zonas, sin envoltorio.
  const guardado = storage.get(KEY, []);
  const zonas = (Array.isArray(guardado) ? guardado : [])
    .filter(z => typeof z === 'string')
    .slice(0, MAX);

  if (!zonas.length) {
    return vacio('zonas', {
      titulo: t('widgets.zonas.titulo'),
      mensaje: t('widgets.zonas.vacio'),
      ruta: RUTA
    });
  }

  const seccion = caja('zonas', { titulo: t('widgets.zonas.titulo'), ruta: RUTA });
  const ul = h('ul.widget__lista');

  for (const zona of zonas) {
    let hora = '';
    let dif = 0;
    let dia = true;
    try {
      hora = formatTime(ahora, { timeZone: zona });
      dif = diferencia(zona, ahora);
      dia = esDeDia(zona, ahora);
    } catch {
      continue;   // una zona que el navegador no conoce se salta, sin romper
    }
    ul.appendChild(h('li.widget__item',
      h('span.widget__dia', { 'aria-hidden': 'true', text: dia ? '☀' : '☾' }),
      h('div.grow',
        h('p.widget__nombre', { text: zona.split('/').pop().replace(/_/g, ' ') }),
        h('p.small.muted', {
          text: dif === 0
            ? t('zonas.sameTime')
            : t(dif > 0 ? 'zonas.ahead' : 'zonas.behind', { diff: dif > 0 ? `+${dif}` : String(dif) })
        })),
      h('span.widget__reloj-pequeno.tnum', { text: hora })
    ));
  }

  if (!ul.children.length) {
    return vacio('zonas', { titulo: t('widgets.zonas.titulo'), mensaje: t('widgets.zonas.vacio'), ruta: RUTA });
  }
  seccion.appendChild(ul);
  return seccion;
}
