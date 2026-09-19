/** Fabricas de componentes reutilizables. */
import { h, nextId } from './dom.js';
import { icon } from './icons.js';

export function button(label, { variant = '', icon: iconName, onClick, type = 'button', ...rest } = {}) {
  const el = h(`button.btn${variant ? `.btn--${variant}` : ''}`, { type, onClick, ...rest });
  if (iconName) { const svg = icon(iconName); svg.classList.add('btn__icon'); el.appendChild(svg); }
  el.appendChild(document.createTextNode(label));
  return el;
}

export function iconButton(iconName, label, { onClick, pressed, ...rest } = {}) {
  const el = h('button.icon-btn', {
    type: 'button', 'aria-label': label, title: label, onClick,
    ...(pressed === undefined ? {} : { 'aria-pressed': String(pressed) }),
    ...rest
  });
  el.appendChild(icon(iconName));
  return el;
}

/** Campo de texto con etiqueta, pista y error enlazados por aria. */
export function field({ label, hint, type = 'text', value = '', onInput, ...rest }) {
  const id = nextId('f');
  const hintId = hint ? `${id}-hint` : undefined;
  const errId = `${id}-err`;
  const input = h('input.input', {
    id, type, value, onInput,
    'aria-describedby': [hintId, errId].filter(Boolean).join(' ') || undefined,
    ...rest
  });
  const error = h('p.field__error', { id: errId, hidden: true, role: 'alert' });
  const wrap = h('div.field',
    h('label.field__label', { for: id, text: label }),
    input,
    hint ? h('p.field__hint', { id: hintId, text: hint }) : null,
    error
  );
  wrap.setError = msg => {
    error.hidden = !msg;
    error.textContent = msg || '';
    input.setAttribute('aria-invalid', msg ? 'true' : 'false');
  };
  wrap.input = input;
  return wrap;
}

/** Desplegable con etiqueta. options = [{ value, label }] */
export function select({ label, options, value, onChange, hint }) {
  const id = nextId('s');
  const hintId = hint ? `${id}-hint` : undefined;
  const el = h('select.select', { id, 'aria-describedby': hintId, onChange });
  for (const opt of options) {
    el.appendChild(h('option', { value: opt.value, selected: opt.value === value, text: opt.label }));
  }
  const wrap = h('div.field',
    label ? h('label.field__label', { for: id, text: label }) : null,
    el,
    hint ? h('p.field__hint', { id: hintId, text: hint }) : null
  );
  wrap.select = el;
  return wrap;
}

/** Interruptor accesible. */
export function toggle({ label, checked = false, onChange, describedBy }) {
  const input = h('input', {
    type: 'checkbox', checked, role: 'switch',
    'aria-describedby': describedBy,
    onChange: e => onChange?.(e.target.checked)
  });
  const el = h('label.switch',
    input,
    h('span.switch__track', h('span.switch__thumb')),
    label ? h('span.visually-hidden', { text: label }) : null
  );
  if (label) input.setAttribute('aria-label', label);
  el.input = input;
  return el;
}

/** Grupo de opciones excluyentes (radiogroup). */
export function segmented({ label, options, value, onChange }) {
  const group = h('div.segmented', { role: 'radiogroup', 'aria-label': label });
  const buttons = [];

  const setValue = next => {
    for (const b of buttons) {
      const on = b.dataset.value === next;
      b.setAttribute('aria-checked', String(on));
      b.tabIndex = on ? 0 : -1;
    }
  };

  options.forEach(opt => {
    const b = h('button.segmented__item', {
      type: 'button', role: 'radio', text: opt.label,
      dataset: { value: opt.value },
      'aria-checked': String(opt.value === value),
      tabIndex: opt.value === value ? 0 : -1,
      onClick: () => { setValue(opt.value); onChange?.(opt.value); }
    });
    buttons.push(b);
    group.appendChild(b);
  });

  group.addEventListener('keydown', e => {
    const idx = buttons.indexOf(document.activeElement);
    if (idx < 0) return;
    let next = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (idx + 1) % buttons.length;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (idx - 1 + buttons.length) % buttons.length;
    if (next === null) return;
    e.preventDefault();
    buttons[next].focus();
    buttons[next].click();
  });

  group.setValue = setValue;
  return group;
}

/** Aviso en linea. */
export function notice(message, { kind = 'info', iconName, title } = {}) {
  const map = { info: 'info', warning: 'alert', danger: 'alert', success: 'check' };
  const svg = icon(iconName || map[kind] || 'info');
  svg.classList.add('notice__icon');
  return h(`div.notice.notice--${kind}`, svg,
    h('div.grow',
      title ? h('p', { text: title, style: { fontWeight: '600' } }) : null,
      h('p', { text: message })
    )
  );
}

/** Estado vacio. */
export function emptyState({ iconName = 'inbox', title, message, action }) {
  const svg = icon(iconName);
  svg.classList.add('empty__icon');
  return h('div.empty', svg,
    h('p.empty__title', { text: title }),
    message ? h('p', { text: message }) : null,
    action || null
  );
}

/** Tarjeta con cuerpo. */
export function card(...children) {
  return h('section.card', h('div.card__body.stack', ...children));
}

/** Fila de ajuste. */
export function settingRow({ label, desc, control, stacked = false }) {
  const id = nextId('set');
  if (desc && control) control.setAttribute?.('aria-describedby', id);
  return h(`div.setting${stacked ? '.setting--stacked' : ''}`,
    h('div.setting__text',
      h('span.setting__label', { text: label }),
      desc ? h('span.setting__desc', { id, text: desc }) : null
    ),
    h('div.setting__control', control)
  );
}
