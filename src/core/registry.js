/**
 * Catalogo de herramientas.
 *
 * Anadir una herramienta = crear su carpeta en src/tools/<id>/index.js
 * (con `export default { id, mount(el, ctx), unmount() }`), sumar su entrada
 * aqui y anadir sus textos a locales/*.json (tools.<id>.name / .desc).
 */
import * as storage from './storage.js';
import { emit } from './events.js';

/**
 * Categorias del inicio. El orden es el que se ve en los filtros.
 * Sus nombres estan en los idiomas, bajo `categories.<id>`.
 */
export const CATEGORIES = ['calculo', 'tiempo', 'texto', 'azar', 'estudio'];

/** `ready: false` = la herramienta aun no esta implementada (proximas fases). */
export const TOOLS = [
  { id: 'temporizador',   icon: 'timer',     category: 'tiempo',  ready: true  },
  { id: 'listas',         icon: 'checklist', category: 'texto',   ready: true  },
  { id: 'unidades',       icon: 'ruler',     category: 'calculo', ready: true  },
  { id: 'contrasenas',    icon: 'key',       category: 'azar',    ready: true  },
  { id: 'contador-texto', icon: 'wordcount', category: 'texto',   ready: true  },
  { id: 'porcentajes',    icon: 'percent',   category: 'calculo', ready: true  },
  { id: 'calculadora',    icon: 'sliders',   category: 'calculo', ready: true  },
  { id: 'graficas',       icon: 'chart',     category: 'calculo', ready: true  },
  { id: 'bases',          icon: 'binary',    category: 'calculo', ready: true  },
  { id: 'monedas',        icon: 'currency',  category: 'calculo', ready: true  },
  { id: 'tabla',          icon: 'atom',      category: 'estudio', ready: true  },
  { id: 'formulario',     icon: 'book',      category: 'estudio', ready: true  },
  { id: 'notas',          icon: 'award',     category: 'estudio', ready: true  },
  { id: 'agenda',         icon: 'calendar',  category: 'estudio', ready: true  },
  { id: 'zonas-horarias', icon: 'clock',     category: 'tiempo',  ready: true  },
  { id: 'azar',           icon: 'dice',      category: 'azar',    ready: true  },
  { id: 'qr',             icon: 'qr',        category: 'texto',   ready: true  },
  { id: 'colores',        icon: 'palette',   category: 'texto',   ready: true  },
  { id: 'equipos',        icon: 'users',     category: 'azar',    ready: true  }
];

const IDS = TOOLS.map(tool => tool.id);
const FAV_KEY = 'favoritos';
const PREFS_KEY = 'herramientas';

let favorites = [];
let prefs = { order: [...IDS], hidden: [] };

function sanitizeIds(list) {
  if (!Array.isArray(list)) return [];
  return [...new Set(list.filter(id => IDS.includes(id)))];
}

export function load() {
  favorites = sanitizeIds(storage.get(FAV_KEY, []));
  const saved = storage.get(PREFS_KEY, null) || {};
  const order = sanitizeIds(saved.order);
  // Las herramientas nuevas se anaden al final conservando el orden guardado.
  prefs = {
    order: [...order, ...IDS.filter(id => !order.includes(id))],
    hidden: sanitizeIds(saved.hidden)
  };
}

function persistPrefs() {
  storage.set(PREFS_KEY, prefs);
  emit('tools:change', { prefs });
}

function persistFavorites() {
  storage.set(FAV_KEY, favorites);
  emit('favorites:change', { favorites });
}

export function byId(id) {
  return TOOLS.find(tool => tool.id === id) || null;
}

/** Herramientas en el orden elegido. `includeHidden` para la pantalla de Ajustes. */
export function list({ includeHidden = false } = {}) {
  return prefs.order
    .map(byId)
    .filter(Boolean)
    .filter(tool => includeHidden || !prefs.hidden.includes(tool.id));
}

export function isHidden(id) { return prefs.hidden.includes(id); }

export function setHidden(id, hidden) {
  if (!IDS.includes(id)) return;
  const set = new Set(prefs.hidden);
  hidden ? set.add(id) : set.delete(id);
  prefs.hidden = [...set];
  persistPrefs();
}

/** Mueve una herramienta una posicion arriba (-1) o abajo (+1). */
export function move(id, delta) {
  const from = prefs.order.indexOf(id);
  if (from < 0) return false;
  const to = from + delta;
  if (to < 0 || to >= prefs.order.length) return false;
  prefs.order.splice(to, 0, prefs.order.splice(from, 1)[0]);
  persistPrefs();
  return true;
}

/** Reordena a partir de una lista completa de ids (arrastrar y soltar). */
export function setOrder(ids) {
  const clean = sanitizeIds(ids);
  prefs.order = [...clean, ...IDS.filter(id => !clean.includes(id))];
  persistPrefs();
}

export function resetOrder() {
  prefs.order = [...IDS];
  persistPrefs();
}

export function isFavorite(id) { return favorites.includes(id); }

export function favoriteIds() { return favorites.filter(id => !prefs.hidden.includes(id)); }

export function toggleFavorite(id) {
  if (!IDS.includes(id)) return false;
  const i = favorites.indexOf(id);
  if (i >= 0) favorites.splice(i, 1);
  else favorites.push(id);
  persistFavorites();
  return favorites.includes(id);
}

export function prefsSnapshot() { return { ...prefs, favorites: [...favorites] }; }
