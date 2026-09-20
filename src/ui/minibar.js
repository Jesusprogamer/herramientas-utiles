/**
 * Minibarra del temporizador.
 *
 * Vive fuera de las vistas: mientras haya algo en marcha se ve en cualquier
 * pantalla. Se esconde sola cuando no queda nada corriendo y en la propia
 * herramienta del temporizador, para no duplicar los mismos botones.
 */
import { h, clear } from './dom.js';
import { iconButton } from './components.js';
import { t } from '../core/i18n.js';
import * as settings from '../core/settings.js';
import { on } from '../core/events.js';
import * as timers from '../core/timers.js';
import { navigate } from '../core/router.js';

const RUTA = '/h/temporizador';

let barra = null;
let desuscribir = null;
let ticker = 0;
let tituloOriginal = '';
/** Rutas que piden ocultar la barra (la herramienta y los widgets del inicio). */
const silencios = new Set();

/** Pide ocultar la minibarra mientras algo la duplique. Devuelve el deshacer. */
export function silenciar(motivo) {
  silencios.add(motivo);
  pintar();
  return () => { silencios.delete(motivo); pintar(); };
}

function visible() {
  if (!settings.get('showMinibar')) return false;
  if (silencios.size) return false;
  return Boolean(timers.activos().principal);
}

function texto(activo) {
  return activo.cuentaAtras ? timers.formatClock(activo.ms) : timers.formatClock(activo.ms);
}

function pintar() {
  const { principal, otros } = timers.activos();
  const mostrar = visible();

  if (!mostrar) {
    barra?.remove();
    barra = null;
    document.body.classList.remove('has-minibar');
    restaurarTitulo();
    return;
  }

  if (!barra) {
    barra = h('div.minibar', { role: 'status', 'aria-live': 'off' });
    document.body.appendChild(barra);
    document.body.classList.add('has-minibar');
  }
  clear(barra);

  const nombre = t(principal.claveNombre);
  const reloj = h('span.minibar__reloj.tnum', { text: texto(principal) });

  const abrir = h('button.minibar__abrir', {
    type: 'button',
    // El nombre accesible no lleva el tiempo: cambiaria cada segundo.
    'aria-label': t('minibar.abrir', { nombre }),
    onClick: () => navigate(RUTA)
  },
  h('span.minibar__nombre', { text: nombre }),
  reloj,
  otros ? h('span.minibar__mas', { text: `+${otros}` }) : null
  );

  const pausar = iconButton(principal.running ? 'timer' : 'timer',
    principal.running ? t('minibar.pausar', { nombre }) : t('minibar.reanudar', { nombre }), {
      onClick: () => timers.toggle(principal.tipo)
    });
  pausar.classList.toggle('minibar__btn--pausa', principal.running);

  const parar = iconButton('x', t('minibar.parar', { nombre }), {
    onClick: () => timers.detener(principal.tipo)
  });

  barra.append(abrir, pausar, parar);
  ponerTitulo(texto(principal), nombre);
}

/* El titulo de la pestana avisa del tiempo aunque la app este de fondo. */
function ponerTitulo(reloj, nombre) {
  if (!tituloOriginal) tituloOriginal = document.title;
  const nuevo = `${reloj} · ${tituloOriginal}`;
  if (document.title !== nuevo) document.title = nuevo;
  if (barra) barra.dataset.nombre = nombre;
}

function restaurarTitulo() {
  if (tituloOriginal && document.title !== tituloOriginal) document.title = tituloOriginal;
}

/** Arranca la minibarra. Se llama una vez, al arrancar la app. */
export function init() {
  tituloOriginal = document.title;
  desuscribir?.();
  desuscribir = timers.subscribe(pintar);
  on('settings:change', ({ changed }) => {
    if (changed.includes('showMinibar')) pintar();
  });
  on('i18n:change', pintar);
  // El reloj de la barra avanza solo; el servicio solo avisa de los cambios.
  clearInterval(ticker);
  ticker = setInterval(() => { if (visible()) pintar(); }, 1000);
  pintar();
}
