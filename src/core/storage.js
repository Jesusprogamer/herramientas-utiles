/**
 * Modulo unico de almacenamiento.
 *
 * - Todas las claves llevan prefijo y version: `amano:v1:<nombre>`.
 * - Toda lectura y escritura va envuelta en try/catch: si el navegador
 *   bloquea localStorage (modo privado, cookies de terceros, cuota llena),
 *   la app sigue funcionando en memoria y solo se pierde la persistencia.
 * - Las migraciones se ejecutan una sola vez al arrancar.
 */

import { emit } from './events.js';

export const PREFIX = 'amano';
export const SCHEMA_VERSION = 1;

const NS = `${PREFIX}:v${SCHEMA_VERSION}:`;
const META_KEY = `${PREFIX}:meta`;

/** Respaldo en memoria cuando localStorage no esta disponible. */
const memory = new Map();
let available = null;
let warned = false;

function probe() {
  if (available !== null) return available;
  try {
    const k = `${PREFIX}:__test__`;
    localStorage.setItem(k, '1');
    localStorage.removeItem(k);
    available = true;
  } catch {
    available = false;
  }
  return available;
}

export function isPersistent() {
  return probe();
}

function warnOnce(err) {
  if (warned) return;
  warned = true;
  console.warn('[almacenamiento] no disponible, se usa memoria temporal', err);
}

function rawGet(key) {
  if (!probe()) return memory.has(key) ? memory.get(key) : null;
  try { return localStorage.getItem(key); }
  catch (err) { warnOnce(err); return memory.has(key) ? memory.get(key) : null; }
}

function rawSet(key, value) {
  memory.set(key, value);
  if (!probe()) return false;
  try { localStorage.setItem(key, value); return true; }
  catch (err) { warnOnce(err); return false; }
}

function rawRemove(key) {
  memory.delete(key);
  if (!probe()) return;
  try { localStorage.removeItem(key); } catch (err) { warnOnce(err); }
}

/** Lee un valor JSON. Devuelve `fallback` si no existe o esta corrupto. */
export function get(name, fallback = null) {
  const raw = rawGet(NS + name);
  if (raw === null || raw === undefined) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return parsed === null || parsed === undefined ? fallback : parsed;
  } catch (err) {
    console.warn(`[almacenamiento] valor corrupto en "${name}", se descarta`, err);
    rawRemove(NS + name);
    return fallback;
  }
}

/**
 * Guarda un valor JSON. Devuelve true si llego a disco.
 * `silent: true` evita avisar a la sincronizacion: se usa al aplicar datos
 * que acaban de llegar de la nube, para no reenviarlos de vuelta.
 */
export function set(name, value, { silent = false } = {}) {
  let raw;
  try { raw = JSON.stringify(value); }
  catch (err) { console.error(`[almacenamiento] no serializable "${name}"`, err); return false; }
  const ok = rawSet(NS + name, raw);
  if (!silent) emit('storage:write', { name });
  return ok;
}

export function remove(name, { silent = false } = {}) {
  rawRemove(NS + name);
  if (!silent) emit('storage:write', { name });
}

/** Todas las claves de la app (sin el prefijo). */
export function keys() {
  const out = new Set();
  for (const k of memory.keys()) if (k.startsWith(NS)) out.add(k.slice(NS.length));
  if (probe()) {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(NS)) out.add(k.slice(NS.length));
      }
    } catch (err) { warnOnce(err); }
  }
  return [...out];
}

/** Vuelca todos los datos de la app (para la copia de seguridad). */
export function exportAll() {
  const data = {};
  for (const name of keys()) data[name] = get(name);
  return data;
}

/** Sustituye todos los datos de la app por los indicados. */
export function importAll(data) {
  clearAll();
  let count = 0;
  for (const [name, value] of Object.entries(data)) {
    if (set(name, value)) count++;
  }
  return count;
}

/** Borra todos los datos locales de la app (incluida la meta de migracion). */
export function clearAll() {
  for (const name of keys()) remove(name);
  rawRemove(META_KEY);
}

/* ------------------------------------------------------------------
   Migraciones
   Cada entrada transforma el almacenamiento de la version anterior a la
   siguiente. Al subir SCHEMA_VERSION, anade aqui la funcion correspondiente.
   ------------------------------------------------------------------ */
const migrations = {
  // 1: version inicial, no hay nada que migrar.
};

export function runMigrations() {
  let meta;
  try { meta = JSON.parse(rawGet(META_KEY) || '{}') || {}; } catch { meta = {}; }
  const from = Number.isInteger(meta.version) ? meta.version : SCHEMA_VERSION;

  for (let v = from + 1; v <= SCHEMA_VERSION; v++) {
    const fn = migrations[v];
    if (typeof fn !== 'function') continue;
    try {
      fn({ get, set, remove, keys });
      console.info(`[almacenamiento] migrado a v${v}`);
    } catch (err) {
      console.error(`[almacenamiento] fallo la migracion a v${v}`, err);
    }
  }

  meta.version = SCHEMA_VERSION;
  meta.updatedAt = new Date().toISOString();
  try { rawSet(META_KEY, JSON.stringify(meta)); } catch { /* ignorado */ }
  return SCHEMA_VERSION;
}
