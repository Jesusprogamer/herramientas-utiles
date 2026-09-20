/** Avisos breves (toasts). */
import { h, clear } from './dom.js';
import { icon } from './icons.js';
import * as audio from '../core/audio.js';

const HOST_ID = 'toasts';
const ICON_BY_KIND = { success: 'check', error: 'alert', info: 'info' };

export function toast(message, { kind = 'info', duration = 3200, action } = {}) {
  const host = document.getElementById(HOST_ID);
  if (!host) return;

  // El sonido acompaña al aviso; nunca lo sustituye.
  if (kind === 'success' || kind === 'error') audio.play(kind);

  const el = h(`div.toast.toast--${kind}`, { role: kind === 'error' ? 'alert' : undefined },
    h('span.toast__icon', icon(ICON_BY_KIND[kind] || 'info')),
    h('span.grow', { text: message })
  );

  if (action) {
    el.appendChild(h('button.btn.btn--sm', {
      type: 'button', text: action.label,
      onClick: () => { dismiss(); action.onClick?.(); }
    }));
  }

  let timer = 0;
  function dismiss() {
    clearTimeout(timer);
    el.classList.add('toast--leaving');
    el.addEventListener('animationend', () => el.remove(), { once: true });
    setTimeout(() => el.remove(), 600);
  }

  host.appendChild(el);
  if (duration > 0) timer = setTimeout(dismiss, duration);
  return dismiss;
}

export const toastOk    = (m, o) => toast(m, { kind: 'success', ...o });
export const toastError = (m, o) => toast(m, { kind: 'error', duration: 5000, ...o });

export function clearToasts() {
  const host = document.getElementById(HOST_ID);
  if (host) clear(host);
}

/* ---------------- Deshacer ---------------- */

export const UNDO_MS = 8000;
const MAX_UNDO = 3;

/**
 * Aviso con boton de deshacer.
 *
 * No se va mientras tenga el raton encima o el foco dentro: si estas a punto
 * de pulsarlo, no desaparece bajo el cursor. Se maneja con teclado y los
 * lectores de pantalla lo leen, porque es la unica via para recuperar algo.
 */
export function undoToast(message, { label, onUndo, duration = UNDO_MS } = {}) {
  const host = document.getElementById(HOST_ID);
  if (!host) return () => {};

  // Como mucho tres a la vez: mas se convierte en una pila ilegible.
  const previos = host.querySelectorAll('.toast--undo');
  for (let i = 0; i <= previos.length - MAX_UNDO; i++) previos[i].dispatchEvent(new Event('amano:dismiss'));

  audio.play('success');

  const boton = h('button.btn.btn--sm', { type: 'button', text: label });
  const el = h('div.toast.toast--info.toast--undo', { role: 'status', 'aria-live': 'polite' },
    h('span.toast__icon', icon('trash')),
    h('span.grow', { text: message }),
    boton
  );

  let timer = 0;
  let restante = duration;
  let desde = 0;
  let cerrado = false;

  function cerrar() {
    if (cerrado) return;
    cerrado = true;
    clearTimeout(timer);
    el.classList.add('toast--leaving');
    el.addEventListener('animationend', () => el.remove(), { once: true });
    setTimeout(() => el.remove(), 600);
  }

  function arrancar() {
    clearTimeout(timer);
    if (restante <= 0) { cerrar(); return; }
    desde = Date.now();
    timer = setTimeout(cerrar, restante);
  }

  function detener() {
    clearTimeout(timer);
    restante -= Date.now() - desde;
  }

  boton.addEventListener('click', () => { cerrar(); onUndo?.(); });
  el.addEventListener('amano:dismiss', cerrar);
  el.addEventListener('mouseenter', detener);
  el.addEventListener('mouseleave', arrancar);
  el.addEventListener('focusin', detener);
  el.addEventListener('focusout', arrancar);

  host.appendChild(el);
  arrancar();
  return cerrar;
}
