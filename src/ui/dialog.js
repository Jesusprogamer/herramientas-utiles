/** Dialogos de confirmacion accesibles, basados en <dialog>. */
import { h, clear, focusables } from './dom.js';
import { t } from '../core/i18n.js';

function host() {
  return document.getElementById('dialogs') || document.body;
}

/**
 * confirm({ title, message, confirmLabel, cancelLabel, danger })
 * Devuelve una promesa que resuelve a true / false.
 */
export function confirm({ title, message, confirmLabel, cancelLabel, danger = false } = {}) {
  return new Promise(resolve => {
    const dlg = h('dialog.dialog', { 'aria-labelledby': 'dlg-title' });
    let settled = false;
    const finish = value => {
      if (settled) return;
      settled = true;
      resolve(value);
      try { dlg.close(); } catch { /* ya cerrado */ }
      dlg.remove();
    };

    const confirmBtn = h(`button.btn.${danger ? 'btn--danger' : 'btn--primary'}`, {
      type: 'button',
      text: confirmLabel || t('common.confirm'),
      onClick: () => finish(true)
    });

    dlg.appendChild(h('div.dialog__body',
      h('h2#dlg-title.card__title', { text: title || t('common.confirm') }),
      message ? h('p.muted', { text: message }) : null,
      h('div.dialog__actions',
        h('button.btn', { type: 'button', text: cancelLabel || t('common.cancel'), onClick: () => finish(false) }),
        confirmBtn
      )
    ));

    dlg.addEventListener('cancel', e => { e.preventDefault(); finish(false); });
    dlg.addEventListener('close', () => finish(false));
    dlg.addEventListener('click', e => { if (e.target === dlg) finish(false); });

    host().appendChild(dlg);
    if (typeof dlg.showModal === 'function') dlg.showModal();
    else dlg.setAttribute('open', '');
    (focusables(dlg)[danger ? 0 : 1] || confirmBtn).focus();
  });
}

/** Dialogo con contenido libre. `render(close)` devuelve nodos. */
export function modal({ title, render }) {
  const dlg = h('dialog.dialog', { 'aria-labelledby': 'dlg-title' });
  const close = () => { try { dlg.close(); } catch { /* ya cerrado */ } dlg.remove(); };
  const body = h('div.dialog__body', h('h2#dlg-title.card__title', { text: title }));
  const content = render(close);
  if (content) body.appendChild(content);
  dlg.appendChild(body);
  dlg.addEventListener('click', e => { if (e.target === dlg) close(); });
  host().appendChild(dlg);
  if (typeof dlg.showModal === 'function') dlg.showModal();
  else dlg.setAttribute('open', '');
  focusables(dlg)[0]?.focus();
  return close;
}

export function closeAll() {
  clear(host());
}
