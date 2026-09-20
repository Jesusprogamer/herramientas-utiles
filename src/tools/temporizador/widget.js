/**
 * Recuadro del temporizador en el inicio.
 *
 * Mientras este a la vista, la minibarra se calla en esa pantalla: seria
 * la misma informacion dos veces.
 */
import { h, clear } from '../../ui/dom.js';
import { caja } from '../../ui/widget.js';
import { button } from '../../ui/components.js';
import { t } from '../../core/i18n.js';
import * as timers from '../../core/timers.js';
import { silenciar } from '../../ui/minibar.js';
import { formatCrono } from '../../lib/stopwatch.js';

const RUTA = '/h/temporizador';

export default function widget() {
  const { principal, otros } = timers.activos();
  if (!principal) return null;   // sin nada en marcha, este recuadro no sale

  const seccion = caja('temporizador', { titulo: t('widgets.temporizador.titulo'), ruta: RUTA });
  const cuerpo = h('div.stack');
  seccion.appendChild(cuerpo);

  function pintar() {
    const estado = timers.activos();
    if (!estado.principal) { clear(cuerpo); return; }
    const a = estado.principal;
    clear(cuerpo);

    cuerpo.append(
      h('p.widget__reloj.tnum', {
        text: a.cuentaAtras ? timers.formatClock(a.ms) : formatCrono(a.ms)
      }),
      h('p.small.muted', {
        text: [
          t(a.claveNombre),
          t(a.running ? 'temporizador.state.running' : 'temporizador.state.paused'),
          estado.otros ? t('widgets.temporizador.otros', { n: estado.otros }) : null
        ].filter(Boolean).join(' · ')
      }),
      h('div.row',
        button(a.running ? t('temporizador.pause') : t('temporizador.start'), {
          icon: a.running ? 'pause' : 'play',
          variant: 'primary',
          onClick: () => timers.toggle(a.tipo)
        }),
        button(t('temporizador.reset'), { icon: 'refresh', onClick: () => timers.detener(a.tipo) })
      )
    );
  }

  pintar();
  const off = timers.subscribe(pintar);
  // El reloj avanza solo; el servicio solo avisa de los cambios de estado.
  const reloj = setInterval(pintar, 250);
  const devolverMinibarra = silenciar('widget-temporizador');

  seccion.cleanup = () => { off(); clearInterval(reloj); devolverMinibarra(); };
  return seccion;
}
