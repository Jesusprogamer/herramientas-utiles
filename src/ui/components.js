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

/**
 * Pestañas accesibles (patron tablist/tab/tabpanel).
 * tabs = [{ id, label, render(panel) }]. Devuelve el contenedor.
 */
export function tabs({ label, items, active, onChange }) {
  const list = h('div.tabs__list', { role: 'tablist', 'aria-label': label });
  const panels = h('div.tabs__panels');
  const buttons = [];
  let current = active || items[0]?.id;

  function show(id, { focus = false, silent = false } = {}) {
    current = id;
    for (const b of buttons) {
      const on = b.dataset.id === id;
      b.setAttribute('aria-selected', String(on));
      b.tabIndex = on ? 0 : -1;
      if (on && focus) b.focus();
    }
    for (const p of panels.children) p.hidden = p.dataset.id !== id;

    // onChange va antes de pintar, para que quien escuche pueda preparar el
    // estado que el panel necesita. La primera llamada es silenciosa: nadie ha
    // cambiado nada todavia y el contenedor aun no existe.
    if (!silent) onChange?.(id);

    const item = items.find(i => i.id === id);
    const panel = [...panels.children].find(p => p.dataset.id === id);
    if (item && panel && !panel.dataset.painted) {
      panel.dataset.painted = '1';
      item.render(panel);
    }
  }

  items.forEach(item => {
    const btn = h('button.tabs__tab', {
      type: 'button', role: 'tab', id: `tab-${item.id}`,
      'aria-controls': `panel-${item.id}`,
      'aria-selected': String(item.id === current),
      tabIndex: item.id === current ? 0 : -1,
      dataset: { id: item.id },
      text: item.label,
      onClick: () => show(item.id)
    });
    buttons.push(btn);
    list.appendChild(btn);
    panels.appendChild(h('div.tabs__panel', {
      role: 'tabpanel', id: `panel-${item.id}`,
      'aria-labelledby': `tab-${item.id}`,
      tabIndex: 0,
      dataset: { id: item.id },
      hidden: item.id !== current
    }));
  });

  list.addEventListener('keydown', e => {
    const i = buttons.indexOf(document.activeElement);
    if (i < 0) return;
    const keys = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    if (e.key === 'Home') { e.preventDefault(); show(items[0].id, { focus: true }); return; }
    if (e.key === 'End') { e.preventDefault(); show(items[items.length - 1].id, { focus: true }); return; }
    const delta = keys[e.key];
    if (!delta) return;
    e.preventDefault();
    show(items[(i + delta + items.length) % items.length].id, { focus: true });
  });

  const wrap = h('div.tabs', list, panels);
  wrap.show = show;
  show(current, { silent: true });
  return wrap;
}

/** Deslizador con valor visible. */
export function slider({ label, min, max, step = 1, value, onInput, format }) {
  const id = nextId('r');
  const out = h('output', { for: id, text: format ? format(value) : String(value) });
  const input = h('input.range', {
    type: 'range', id, min, max, step, value,
    onInput: e => {
      const v = Number(e.target.value);
      out.textContent = format ? format(v) : String(v);
      onInput?.(v);
    }
  });
  const wrap = h('div.field',
    h('div.row',
      h('label.field__label.grow', { for: id, text: label }),
      h('span.slider__value.tnum', out)
    ),
    input
  );
  wrap.input = input;
  wrap.setValue = v => { input.value = String(v); out.textContent = format ? format(v) : String(v); };
  return wrap;
}

/** Bloque de resultado grande con boton de copiar. */
export function resultBox({ value = '', mono = true, ariaLabel }) {
  const text = h(`p.resultbox__value${mono ? '.mono' : ''}`, { text: value, 'aria-live': 'polite', 'aria-label': ariaLabel });
  const box = h('div.resultbox', text);
  box.setValue = v => { text.textContent = v; };
  box.value = () => text.textContent;
  return box;
}
