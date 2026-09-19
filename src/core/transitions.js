/**
 * Transiciones entre pantallas.
 *
 * Usa la View Transitions API donde exista y, donde no, un respaldo en CSS
 * (fundido con un ligero desplazamiento). La animación depende de la
 * dirección: entrar en una herramienta y volver atrás se sienten distintos.
 *
 * Nunca bloquea la interacción: si algo falla o tarda, el cambio de pantalla
 * ocurre igual.
 */
import * as settings from './settings.js';

export const MODES = ['ninguna', 'suave', 'completa'];

const DURATIONS = { ninguna: 0, suave: 150, completa: 280 };

const systemReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Modo que se aplica de verdad.
 * "Reducir movimiento", venga del sistema o del ajuste propio, manda:
 * en ese caso no hay animación aunque se haya elegido otra cosa.
 */
export function effectiveMode() {
  if (systemReducedMotion() || settings.get('reduceMotion')) return 'ninguna';
  const mode = settings.get('transitions');
  return MODES.includes(mode) ? mode : 'suave';
}

export function supportsViewTransitions() {
  return typeof document.startViewTransition === 'function';
}

/** Profundidad de una ruta: "/" = 0, "/ajustes" = 1, "/h/qr" = 2. */
function depth(path) {
  return String(path).split('/').filter(Boolean).length;
}

/** 'adelante' al entrar en algo más profundo, 'atras' al salir. */
export function directionBetween(from, to) {
  const a = depth(from);
  const b = depth(to);
  if (b > a) return 'adelante';
  if (b < a) return 'atras';
  return 'lateral';
}

let running = false;

/**
 * Ejecuta `update` (que cambia el DOM) envuelto en la transición.
 * Devuelve una promesa que se resuelve cuando el DOM ya está actualizado,
 * sin esperar a que termine la animación.
 */
export async function run(direction, update) {
  const mode = effectiveMode();
  const root = document.documentElement;

  if (mode === 'ninguna' || running) {
    await update();
    return;
  }

  root.dataset.transition = mode;
  root.dataset.direction = direction;
  running = true;

  const cleanup = () => {
    running = false;
    delete root.dataset.transition;
    delete root.dataset.direction;
  };

  if (supportsViewTransitions()) {
    try {
      const transition = document.startViewTransition(() => update());
      // Se limpia al acabar la animación, pero no se espera a ella.
      transition.finished.then(cleanup, cleanup);
      await transition.updateCallbackDone;
      return;
    } catch (err) {
      console.warn('[transiciones] fallo la View Transition, se usa el respaldo', err);
      cleanup();
      await update();
      return;
    }
  }

  // Respaldo en CSS: se desvanece lo viejo, se cambia y entra lo nuevo.
  const outlet = document.getElementById('main');
  if (!outlet) { cleanup(); await update(); return; }

  outlet.classList.add('view-leave');
  await new Promise(resolve => setTimeout(resolve, Math.min(120, DURATIONS[mode] / 2)));
  outlet.classList.remove('view-leave');

  await update();

  outlet.classList.add('view-enter');
  const done = () => {
    outlet.classList.remove('view-enter');
    cleanup();
  };
  outlet.addEventListener('animationend', done, { once: true });
  setTimeout(done, DURATIONS[mode] + 120);   // por si no llega el evento
}
