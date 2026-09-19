/**
 * Tareas, lista de la compra y notas rapidas, en tres pestañas.
 *
 * Todo el contenido que escribe la persona se trata SIEMPRE como texto plano
 * (textContent / value). Nunca se inyecta HTML, asi una nota con "<script>"
 * se ve tal cual en lugar de ejecutarse.
 */
import { h, clear, copyText, nextId } from '../../ui/dom.js';
import { icon } from '../../ui/icons.js';
import { button, iconButton, tabs, segmented, emptyState, select } from '../../ui/components.js';
import { confirm } from '../../ui/dialog.js';
import { toast, toastOk, toastError } from '../../ui/toast.js';
import * as storage from '../../core/storage.js';
import { t, tn, formatDate, formatRelative } from '../../core/i18n.js';

const KEYS = { tasks: 'tareas', shop: 'compra', shopHistory: 'compra-historial', notes: 'notas' };

/* El editor de notas guarda con retardo; esto permite volcar lo pendiente si
   sales de la herramienta o cierras la pestaña antes de que venza. */
let flushNotes = null;

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(36).slice(2)}`);

const SHOP_CATEGORIES = ['fruta', 'verdura', 'carne', 'pescado', 'lacteos', 'panaderia',
  'bebidas', 'congelados', 'despensa', 'limpieza', 'higiene', 'otros'];

/** Lee una lista del almacenamiento descartando lo que no tenga forma valida. */
function readList(key, validate) {
  const raw = storage.get(key, []);
  return Array.isArray(raw) ? raw.filter(validate) : [];
}

const isTask = x => x && typeof x === 'object' && typeof x.id === 'string' && typeof x.text === 'string';
const isNote = x => x && typeof x === 'object' && typeof x.id === 'string' && typeof x.body === 'string';

/* Fecha de hoy en local (no UTC) con formato YYYY-MM-DD, para <input type=date>. */
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/* <label> en lugar de <span>: asi pulsar en cualquier punto de la caja
   alterna la casilla, tambien en pantallas pequeñas. */
function checkbox({ checked, label, onChange }) {
  const input = h('input', { type: 'checkbox', checked, 'aria-label': label, onChange: e => onChange(e.target.checked) });
  return h('label.check', input, icon('check'));
}

/* ================================================================
   TAREAS
   ================================================================ */

function renderTasks(panel) {
  let tasks = readList(KEYS.tasks, isTask);
  let filter = 'todas';

  const save = () => storage.set(KEYS.tasks, tasks);

  const listEl = h('div.stack');
  const counter = h('p.small.muted', { 'aria-live': 'polite' });

  const input = h('input.input', {
    type: 'text', maxlength: '300',
    placeholder: t('listas.tareas.placeholder'),
    'aria-label': t('listas.tareas.addLabel'),
    onKeyDown: e => { if (e.key === 'Enter') add(); }
  });
  const dueInput = h('input.input', {
    type: 'date', 'aria-label': t('listas.tareas.dueLabel'), style: { maxWidth: '11rem' }
  });

  function add() {
    const text = input.value.trim();
    if (!text) { input.focus(); return; }
    tasks.unshift({ id: uid(), text, done: false, due: dueInput.value || null, createdAt: Date.now() });
    input.value = '';
    dueInput.value = '';
    save();
    paint();
    input.focus();
  }

  function move(id, delta) {
    const from = tasks.findIndex(x => x.id === id);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= tasks.length) return;
    tasks.splice(to, 0, tasks.splice(from, 1)[0]);
    save();
    paint();
  }

  function reorder(draggedId, targetId) {
    if (draggedId === targetId) return;
    const from = tasks.findIndex(x => x.id === draggedId);
    const to = tasks.findIndex(x => x.id === targetId);
    if (from < 0 || to < 0) return;
    tasks.splice(to, 0, tasks.splice(from, 1)[0]);
    save();
    paint();
  }

  function startEdit(task, row) {
    const field = h('input.input', { type: 'text', value: task.text, maxlength: '300', 'aria-label': t('listas.tareas.editLabel') });
    const dateField = h('input.input', { type: 'date', value: task.due || '', 'aria-label': t('listas.tareas.dueLabel'), style: { maxWidth: '11rem' } });
    const commit = () => {
      const next = field.value.trim();
      if (next) { task.text = next; task.due = dateField.value || null; save(); }
      paint();
    };
    clear(row);
    row.appendChild(h('div.stack.grow',
      field,
      h('div.row',
        dateField,
        button(t('common.save'), { variant: 'primary', onClick: commit }),
        button(t('common.cancel'), { onClick: paint })
      )
    ));
    field.focus();
    field.select();
    field.addEventListener('keydown', e => {
      if (e.key === 'Enter') commit();
      if (e.key === 'Escape') paint();
    });
  }

  function taskRow(task, index, shown) {
    const late = task.due && !task.done && task.due < todayISO();
    const row = h(`div.item${task.done ? '.item--done' : ''}`, { draggable: 'true', dataset: { id: task.id } });

    row.addEventListener('dragstart', e => {
      e.dataTransfer.setData('text/plain', task.id);
      e.dataTransfer.effectAllowed = 'move';
      row.classList.add('item--dragging');
    });
    row.addEventListener('dragend', () => row.classList.remove('item--dragging'));
    row.addEventListener('dragover', e => { e.preventDefault(); row.classList.add('item--over'); });
    row.addEventListener('dragleave', () => row.classList.remove('item--over'));
    row.addEventListener('drop', e => {
      e.preventDefault();
      row.classList.remove('item--over');
      reorder(e.dataTransfer.getData('text/plain'), task.id);
    });

    row.append(
      checkbox({
        checked: task.done,
        label: t(task.done ? 'listas.tareas.markPending' : 'listas.tareas.markDone', { text: task.text }),
        onChange: value => { task.done = value; save(); paint(); }
      }),
      h('div.item__main',
        h('span.item__text', { text: task.text }),
        task.due ? h('span', { class: `item__meta${late ? ' item__meta--late' : ''}` },
          h('span', { text: t(late ? 'listas.tareas.overdue' : 'listas.tareas.due', { date: formatDate(`${task.due}T12:00:00`) }) })
        ) : null
      ),
      h('div.item__actions',
        iconButton('chevronUp', t('listas.tareas.moveUp'), { disabled: index === 0, onClick: () => move(task.id, -1) }),
        iconButton('chevronDown', t('listas.tareas.moveDown'), { disabled: index === shown - 1, onClick: () => move(task.id, 1) }),
        iconButton('type', t('listas.tareas.edit'), { onClick: () => startEdit(task, row) }),
        iconButton('trash', t('listas.tareas.delete'), {
          onClick: () => { tasks = tasks.filter(x => x.id !== task.id); save(); paint(); }
        })
      )
    );
    return row;
  }

  function paint() {
    clear(listEl);
    const pending = tasks.filter(x => !x.done).length;
    counter.textContent = tasks.length ? tn('listas.tareas.pending', pending) : '';
    clearDone.disabled = !tasks.some(x => x.done);

    const visible = tasks.filter(x =>
      filter === 'todas' ? true : filter === 'pendientes' ? !x.done : x.done);

    if (!visible.length) {
      listEl.appendChild(emptyState({
        iconName: 'checklist',
        title: t(tasks.length ? 'listas.tareas.emptyFilter.title' : 'listas.tareas.empty.title'),
        message: t(tasks.length ? 'listas.tareas.emptyFilter.message' : 'listas.tareas.empty.message')
      }));
      return;
    }
    visible.forEach((task, i) => listEl.appendChild(taskRow(task, i, visible.length)));
  }

  const clearDone = button(t('listas.tareas.clearDone'), {
    icon: 'trash',
    onClick: async () => {
      const ok = await confirm({
        title: t('listas.tareas.clearDone'),
        message: t('listas.tareas.clearDoneConfirm'),
        confirmLabel: t('common.delete'), danger: true
      });
      if (!ok) return;
      tasks = tasks.filter(x => !x.done);
      save();
      paint();
      toastOk(t('listas.tareas.cleared'));
    }
  });

  panel.append(
    h('div.stack',
      h('div.list-add', input, button(t('listas.add'), { variant: 'primary', onClick: add })),
      h('div.row', dueInput, h('span.small.faint', { text: t('listas.tareas.dueHint') })),
      h('div.row',
        segmented({
          label: t('listas.tareas.filterLabel'),
          value: filter,
          options: ['todas', 'pendientes', 'hechas'].map(v => ({ value: v, label: t(`listas.tareas.filter.${v}`) })),
          onChange: v => { filter = v; paint(); }
        }),
        h('span.grow'),
        clearDone
      ),
      counter,
      listEl
    )
  );
  paint();
}

/* ================================================================
   COMPRA
   ================================================================ */

function renderShopping(panel) {
  let items = readList(KEYS.shop, isTask);
  let history = storage.get(KEYS.shopHistory, []);
  if (!Array.isArray(history)) history = [];

  const save = () => storage.set(KEYS.shop, items);
  const saveHistory = () => storage.set(KEYS.shopHistory, history.slice(0, 200));

  const listId = nextId('compra');
  const datalist = h('datalist', { id: listId });

  const input = h('input.input', {
    type: 'text', maxlength: '120', list: listId,
    placeholder: t('listas.compra.placeholder'),
    'aria-label': t('listas.compra.addLabel'),
    onKeyDown: e => { if (e.key === 'Enter') add(); }
  });
  const qty = h('input.input', {
    type: 'text', maxlength: '20', style: { maxWidth: '6.5rem' },
    placeholder: t('listas.compra.qtyPlaceholder'),
    'aria-label': t('listas.compra.qtyLabel'),
    onKeyDown: e => { if (e.key === 'Enter') add(); }
  });
  const category = select({
    label: null,
    value: '',
    options: [{ value: '', label: t('listas.compra.noCategory') },
      ...SHOP_CATEGORIES.map(c => ({ value: c, label: t(`listas.compra.category.${c}`) }))],
    onChange: () => {}
  });
  category.select.setAttribute('aria-label', t('listas.compra.categoryLabel'));

  const listEl = h('div.stack');

  function refreshDatalist() {
    clear(datalist);
    for (const name of history.slice(0, 60)) datalist.appendChild(h('option', { value: name }));
  }

  function add() {
    const text = input.value.trim();
    if (!text) { input.focus(); return; }
    items.push({
      id: uid(), text, done: false,
      qty: qty.value.trim() || null,
      category: category.select.value || null
    });
    const lower = text.toLowerCase();
    history = [text, ...history.filter(x => x.toLowerCase() !== lower)];
    save(); saveHistory(); refreshDatalist();
    input.value = ''; qty.value = '';
    paint();
    input.focus();
  }

  /** Los marcados bajan al final, conservando su orden relativo. */
  function ordered() {
    return [...items.filter(x => !x.done), ...items.filter(x => x.done)];
  }

  function asText() {
    return ordered().map(item => {
      const parts = [item.done ? '[x]' : '[ ]', item.qty ? `${item.qty} ×` : null, item.text,
        item.category ? `(${t(`listas.compra.category.${item.category}`)})` : null];
      return parts.filter(Boolean).join(' ');
    }).join('\n');
  }

  function paint() {
    clear(listEl);
    const list = ordered();
    pendingLabel.textContent = items.length ? tn('listas.compra.pending', items.filter(x => !x.done).length) : '';
    uncheckAll.disabled = !items.some(x => x.done);
    clearBought.disabled = !items.some(x => x.done);

    if (!list.length) {
      listEl.appendChild(emptyState({
        iconName: 'inbox',
        title: t('listas.compra.empty.title'),
        message: t('listas.compra.empty.message')
      }));
      return;
    }

    for (const item of list) {
      listEl.appendChild(h(`div.item${item.done ? '.item--done' : ''}`,
        checkbox({
          checked: item.done,
          label: t(item.done ? 'listas.compra.markPending' : 'listas.compra.markBought', { text: item.text }),
          onChange: value => { item.done = value; save(); paint(); }
        }),
        h('div.item__main',
          h('span.item__text', { text: item.qty ? `${item.qty} × ${item.text}` : item.text }),
          item.category ? h('span.item__meta', h('span.chip', { text: t(`listas.compra.category.${item.category}`) })) : null
        ),
        h('div.item__actions',
          iconButton('trash', t('listas.compra.delete', { text: item.text }), {
            onClick: () => { items = items.filter(x => x.id !== item.id); save(); paint(); }
          })
        )
      ));
    }
  }

  const pendingLabel = h('p.small.muted', { 'aria-live': 'polite' });

  const uncheckAll = button(t('listas.compra.uncheckAll'), {
    icon: 'refresh',
    onClick: () => { items.forEach(x => { x.done = false; }); save(); paint(); }
  });

  const clearBought = button(t('listas.compra.clearBought'), {
    icon: 'trash',
    onClick: async () => {
      const ok = await confirm({
        title: t('listas.compra.clearBought'),
        message: t('listas.compra.clearBoughtConfirm'),
        confirmLabel: t('common.delete'), danger: true
      });
      if (!ok) return;
      items = items.filter(x => !x.done);
      save(); paint();
      toastOk(t('listas.compra.cleared'));
    }
  });

  const shareBtn = button(t('listas.compra.share'), {
    icon: 'upload',
    onClick: async () => {
      const text = asText();
      if (!text) { toast(t('listas.compra.empty.title')); return; }
      if (navigator.share) {
        try { await navigator.share({ title: t('tools.listas.name'), text }); return; }
        catch { /* cancelado o no permitido: caemos a copiar */ }
      }
      if (await copyText(text)) toastOk(t('common.copied'));
      else toastError(t('common.copyFailed'));
    }
  });

  refreshDatalist();
  panel.append(
    h('div.stack',
      h('div.list-add', input, qty, button(t('listas.add'), { variant: 'primary', onClick: add })),
      h('div.row', category, h('span.small.faint', { text: t('listas.compra.categoryHint') })),
      datalist,
      h('div.row', uncheckAll, clearBought, shareBtn),
      pendingLabel,
      listEl
    )
  );
  paint();
}

/* ================================================================
   NOTAS
   ================================================================ */

function renderNotes(panel) {
  let notes = readList(KEYS.notes, isNote);
  let query = '';
  let editingId = null;
  let saveTimer = 0;

  const save = () => storage.set(KEYS.notes, notes);
  const view = h('div.stack');

  const norm = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  function sorted(list) {
    return [...list].sort((a, b) =>
      (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || (b.updatedAt || 0) - (a.updatedAt || 0));
  }

  function openEditor(id) { editingId = id; paint(); }

  function newNote() {
    const note = { id: uid(), title: '', body: '', pinned: false, updatedAt: Date.now() };
    notes.unshift(note);
    save();
    openEditor(note.id);
  }

  function paintEditor() {
    const note = notes.find(n => n.id === editingId);
    if (!note) { editingId = null; paint(); return; }

    const status = h('span.small.faint');
    const title = h('input.input', {
      type: 'text', value: note.title, maxlength: '120',
      placeholder: t('listas.notas.titlePlaceholder'),
      'aria-label': t('listas.notas.titleLabel')
    });
    const body = h('textarea.textarea', {
      rows: '14', 'aria-label': t('listas.notas.bodyLabel'),
      placeholder: t('listas.notas.bodyPlaceholder')
    });
    body.value = note.body;   // value, nunca innerHTML: siempre texto plano

    const autosave = () => {
      clearTimeout(saveTimer);
      status.textContent = t('listas.notas.saving');
      saveTimer = setTimeout(() => {
        note.title = title.value;
        note.body = body.value;
        note.updatedAt = Date.now();
        save();
        status.textContent = t('listas.notas.saved');
      }, 400);
    };
    title.addEventListener('input', autosave);
    body.addEventListener('input', autosave);

    const commitNow = () => {
      clearTimeout(saveTimer);
      note.title = title.value;
      note.body = body.value;
      note.updatedAt = Date.now();
      save();
    };
    flushNotes = commitNow;
    window.addEventListener('pagehide', commitNow);

    view.append(h('div.stack',
      h('div.row',
        button(t('common.back'), { icon: 'arrowLeft', onClick: () => { commitNow(); editingId = null; paint(); } }),
        h('span.grow'),
        iconButton('star', t(note.pinned ? 'listas.notas.unpin' : 'listas.notas.pin'), {
          pressed: note.pinned,
          onClick: () => { note.pinned = !note.pinned; note.updatedAt = Date.now(); save(); paint(); }
        }),
        iconButton('trash', t('listas.notas.delete'), {
          onClick: async () => {
            const ok = await confirm({
              title: t('listas.notas.deleteConfirmTitle'),
              message: t('listas.notas.deleteConfirmMessage'),
              confirmLabel: t('common.delete'), danger: true
            });
            if (!ok) return;
            clearTimeout(saveTimer);
            notes = notes.filter(n => n.id !== note.id);
            save();
            editingId = null;
            paint();
            toastOk(t('listas.notas.deleted'));
          }
        })
      ),
      title,
      body,
      h('div.row', status, h('span.grow'),
        h('span.small.faint', { text: t('listas.notas.updated', { when: formatRelative(note.updatedAt || Date.now()) }) }))
    ));
    title.focus();
  }

  function paintList() {
    const search = h('div.search');
    const searchIcon = icon('search');
    searchIcon.classList.add('search__icon');
    const searchInput = h('input.input', {
      type: 'search', value: query,
      placeholder: t('listas.notas.searchPlaceholder'),
      'aria-label': t('listas.notas.searchLabel'),
      onInput: e => { query = e.target.value; paint(); }
    });
    search.append(searchIcon, searchInput);

    const q = norm(query.trim());
    const found = q
      ? notes.filter(n => norm(n.title).includes(q) || norm(n.body).includes(q))
      : notes;

    const grid = h('div.notes-grid');
    for (const note of sorted(found)) {
      grid.appendChild(h('button.note-card', {
        type: 'button',
        onClick: () => openEditor(note.id)
      },
        h('span.note-card__title', { text: note.title || t('listas.notas.untitled') }),
        h('span.note-card__body', { text: note.body || t('listas.notas.emptyBody') }),
        h('span.note-card__foot',
          h('span.small.faint', { text: formatRelative(note.updatedAt || Date.now()) }),
          note.pinned ? h('span.chip.chip--accent', { text: t('listas.notas.pinned') }) : null
        )
      ));
    }

    view.append(h('div.stack',
      h('div.row',
        button(t('listas.notas.new'), { variant: 'primary', icon: 'type', onClick: newNote }),
        h('div.grow', search)
      ),
      found.length ? grid : emptyState({
        iconName: 'type',
        title: t(notes.length ? 'listas.notas.noResults.title' : 'listas.notas.empty.title'),
        message: t(notes.length ? 'listas.notas.noResults.message' : 'listas.notas.empty.message'),
        action: notes.length ? null : button(t('listas.notas.new'), { variant: 'primary', onClick: newNote })
      })
    ));
    if (query) searchInput.focus();
  }

  function paint() {
    if (flushNotes) { window.removeEventListener('pagehide', flushNotes); flushNotes(); flushNotes = null; }
    clear(view);
    if (editingId) paintEditor();
    else paintList();
  }

  panel.appendChild(view);
  paint();
}

/* ================================================================ */

export default {
  id: 'listas',

  mount(container) {
    const view = h('div.page',
      h('header.page__header',
        h('h1.page__title', { text: t('tools.listas.name') }),
        h('p.page__lead', { text: t('tools.listas.desc') })
      ),
      tabs({
        label: t('tools.listas.name'),
        items: [
          { id: 'tareas', label: t('listas.tab.tareas'), render: renderTasks },
          { id: 'compra', label: t('listas.tab.compra'), render: renderShopping },
          { id: 'notas', label: t('listas.tab.notas'), render: renderNotes }
        ]
      })
    );
    container.appendChild(view);
  },

  unmount() {
    if (flushNotes) {
      window.removeEventListener('pagehide', flushNotes);
      flushNotes();
      flushNotes = null;
    }
  }
};
