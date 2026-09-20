/**
 * Idiomas.
 *
 * Todo el texto visible vive en locales/<codigo>.json. Para anadir un idioma
 * basta con crear el archivo y sumar su codigo a AVAILABLE.
 * El cambio se aplica en vivo, sin recargar.
 */
import * as settings from './settings.js';
import { emit } from './events.js';

export const AVAILABLE = ['es', 'en', 'pt', 'ca'];
export const FALLBACK = 'es';

const cache = new Map();
let current = FALLBACK;
let dict = {};
let fallbackDict = {};

/* Claves que han faltado en el idioma activo. Se avisa una sola vez de cada
   una para no llenar la consola, y se pueden consultar con missingKeys(). */
const missing = new Set();

/** Claves que han tenido que caer al idioma de respaldo. */
export function missingKeys() { return [...missing]; }

/** Idioma efectivo: el elegido, o el del navegador si esta en "automatico". */
export function resolveLanguage(pref = settings.get('language')) {
  if (AVAILABLE.includes(pref)) return pref;
  const candidates = navigator.languages?.length ? navigator.languages : [navigator.language || FALLBACK];
  for (const tag of candidates) {
    const base = String(tag).toLowerCase().split('-')[0];
    if (AVAILABLE.includes(base)) return base;
  }
  return FALLBACK;
}

export function language() { return current; }

/** Etiqueta BCP-47 para Intl. */
export function locale() { return current === 'en' ? 'en-GB' : 'es-ES'; }

async function fetchDict(code) {
  if (cache.has(code)) return cache.get(code);
  const res = await fetch(`./locales/${code}.json`, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`No se pudo cargar el idioma "${code}" (${res.status})`);
  const data = await res.json();
  cache.set(code, data);
  return data;
}

export async function setLanguage(pref) {
  const code = resolveLanguage(pref);
  if (!fallbackDict || !Object.keys(fallbackDict).length) {
    fallbackDict = await fetchDict(FALLBACK);
  }
  dict = code === FALLBACK ? fallbackDict : await fetchDict(code);
  current = code;
  missing.clear();

  document.documentElement.setAttribute('lang', code);
  const title = t('app.name');
  if (title) document.title = title;
  const desc = document.querySelector('meta[name="description"]');
  if (desc) desc.setAttribute('content', t('app.description'));

  emit('i18n:change', { language: code });
  return code;
}

export async function init() {
  return setLanguage(settings.get('language'));
}

function lookup(source, path) {
  let node = source;
  for (const part of path.split('.')) {
    if (node === null || typeof node !== 'object' || !(part in node)) return undefined;
    node = node[part];
  }
  return typeof node === 'string' ? node : undefined;
}

/**
 * Traduce una clave. Admite sustituciones: t('home.count', { n: 3 }) con
 * "{n}" en el texto, y plurales con "clave|clave_plural" via opciones.count.
 */
export function t(key, params) {
  let text = lookup(dict, key);
  if (text === undefined) {
    // Respaldo: lo que falte en un idioma se muestra en español.
    text = lookup(fallbackDict, key);
    if (text !== undefined && current !== FALLBACK && !missing.has(key)) {
      missing.add(key);
      console.warn(`[idiomas] "${key}" no esta en "${current}": se muestra en ${FALLBACK}`);
    }
  }
  if (text === undefined) {
    if (!missing.has(key)) {
      missing.add(key);
      console.warn(`[idiomas] falta la clave "${key}" en todos los idiomas`);
    }
    return key;
  }
  if (params) {
    text = text.replace(/\{(\w+)\}/g, (m, name) =>
      Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : m
    );
  }
  return text;
}

/** Plural sencillo: clave.one / clave.other */
export function tn(key, count, params = {}) {
  const form = count === 1 ? 'one' : 'other';
  return t(`${key}.${form}`, { n: formatNumber(count), ...params });
}

/**
 * Devuelve el objeto crudo en esa ruta del diccionario (para bloques con
 * listas, como la pagina de privacidad). Solo lectura.
 */
export function section(path) {
  const walk = source => {
    let node = source;
    for (const part of path.split('.')) {
      if (node === null || typeof node !== 'object' || !(part in node)) return undefined;
      node = node[part];
    }
    return node;
  };
  return walk(dict) ?? walk(fallbackDict) ?? undefined;
}

/* ---------------- Formato con Intl ---------------- */

function hour12() {
  const pref = settings.get('timeFormat');
  if (pref === '12') return true;
  if (pref === '24') return false;
  return undefined; // automatico: lo decide el idioma
}

export function formatNumber(value, options = {}) {
  try { return new Intl.NumberFormat(locale(), options).format(value); }
  catch { return String(value); }
}

export function formatCurrency(value, currency = settings.get('currency'), options = {}) {
  try {
    return new Intl.NumberFormat(locale(), { style: 'currency', currency, ...options }).format(value);
  } catch { return `${formatNumber(value)} ${currency}`; }
}

export function formatDate(date, options) {
  const d = date instanceof Date ? date : new Date(date);
  const pref = settings.get('dateFormat');
  try {
    if (!options && pref !== 'auto') {
      const parts = { dmy: ['day', 'month', 'year'], mdy: ['month', 'day', 'year'], ymd: ['year', 'month', 'day'] }[pref];
      const fmt = new Intl.DateTimeFormat(locale(), { day: '2-digit', month: '2-digit', year: 'numeric' });
      const map = Object.fromEntries(fmt.formatToParts(d).map(p => [p.type, p.value]));
      const sep = pref === 'ymd' ? '-' : '/';
      return parts.map(p => map[p]).join(sep);
    }
    return new Intl.DateTimeFormat(locale(), options || { dateStyle: 'medium' }).format(d);
  } catch { return String(date); }
}

export function formatTime(date, options) {
  const d = date instanceof Date ? date : new Date(date);
  try {
    return new Intl.DateTimeFormat(locale(), {
      hour: '2-digit', minute: '2-digit', hour12: hour12(), ...options
    }).format(d);
  } catch { return String(date); }
}

export function formatDateTime(date) {
  const d = date instanceof Date ? date : new Date(date);
  return `${formatDate(d)} ${formatTime(d)}`;
}

export function formatRelative(date) {
  const d = date instanceof Date ? date : new Date(date);
  const diff = d.getTime() - Date.now();
  const units = [['year', 31536e6], ['month', 2592e6], ['day', 864e5], ['hour', 36e5], ['minute', 6e4], ['second', 1e3]];
  try {
    const rtf = new Intl.RelativeTimeFormat(locale(), { numeric: 'auto' });
    for (const [unit, ms] of units) {
      if (Math.abs(diff) >= ms || unit === 'second') return rtf.format(Math.round(diff / ms), unit);
    }
  } catch { /* sin soporte */ }
  return formatDateTime(d);
}

/** Nombre del idioma en su propio idioma, para el selector. */
export function languageName(code) {
  try {
    const dn = new Intl.DisplayNames([code], { type: 'language' });
    const name = dn.of(code);
    return name ? name[0].toUpperCase() + name.slice(1) : code;
  } catch { return code; }
}

/**
 * Aplica las traducciones al HTML estatico:
 *   data-i18n="clave"                -> textContent
 *   data-i18n-attr="aria-label:clave; placeholder:otra"
 * Nunca se inyecta HTML, solo texto.
 */
export function applyTo(root = document) {
  root.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.getAttribute('data-i18n'));
  });
  root.querySelectorAll('[data-i18n-attr]').forEach(el => {
    for (const pair of el.getAttribute('data-i18n-attr').split(';')) {
      const [attr, key] = pair.split(':').map(s => s && s.trim());
      if (attr && key) el.setAttribute(attr, t(key));
    }
  });
}
