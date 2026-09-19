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
