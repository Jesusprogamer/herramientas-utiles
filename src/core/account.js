/**
 * Cuenta y sincronización (Supabase).
 *
 * Reglas de la casa:
 *  · Modo invitado: sin cuenta, la app entera funciona igual.
 *  · Primero local: todo se guarda siempre en el dispositivo y despues,
 *    si hay sesion y conexion, se sube. Nada espera a la red.
 *  · Conflictos: gana el cambio mas reciente segun `updated_at`.
 *  · Esta app NUNCA guarda contraseñas ni tokens por su cuenta: de la
 *    sesion se encarga la libreria de Supabase.
 *  · La libreria vive dentro del proyecto (vendor/supabase), asi que la app
 *    no depende de ningun CDN.
 */
import * as storage from './storage.js';
import { emit, on } from './events.js';
import { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_TABLE } from '../../config.js';

/** Claves que viajan a la nube. Lo demas se queda en el dispositivo. */
export const SYNC_KEYS = [
  'settings',            // ajustes
  'favoritos',           // favoritos del inicio
  'herramientas',        // orden y visibilidad
  'tareas',              // tareas
  'compra',              // lista de la compra
  'compra-historial',    // autocompletado de la compra
  'notas',               // notas rapidas
  'zonas-horarias',      // ciudades guardadas
  'azar-ruleta',         // opciones de la ruleta
  'monedas',             // preferencias de monedas
  'colores',             // colores guardados
  'equipos'              // lista de nombres
];

const META_KEY = 'sync-meta';       // { [clave]: { updatedAt, pushedAt } }
const PUSH_DELAY = 1500;

let client = null;
let libPromise = null;
let session = null;
let status = 'guest';               // guest | signedOut | syncing | synced | offline | error
let lastError = '';
let pushTimer = 0;
let started = false;

/* ---------------- Configuración ---------------- */

export function isConfigured() {
  return /^https:\/\/[a-z0-9-]+\.supabase\.(co|in)\/?$/i.test(String(SUPABASE_URL).trim())
    && String(SUPABASE_ANON_KEY).trim().length > 30;
}

export function state() {
  return {
    configured: isConfigured(),
    signedIn: Boolean(session?.user),
    email: session?.user?.email || '',
    status,
    error: lastError,
    pending: pendingKeys().length
  };
}

function setStatus(next, error = '') {
  status = next;
  lastError = error;
  emit('account:change', state());
}

/* ---------------- Carga de la librería ---------------- */

function loadLibrary() {
  if (libPromise) return libPromise;
  libPromise = new Promise((resolve, reject) => {
    if (window.supabase?.createClient) { resolve(window.supabase); return; }
    const script = document.createElement('script');
    script.src = './vendor/supabase/supabase.js';   // ruta relativa: vale en subcarpetas
    script.async = true;
    script.onload = () => {
      if (window.supabase?.createClient) resolve(window.supabase);
      else reject(new Error('La librería de Supabase se cargó pero no expone createClient'));
    };
    script.onerror = () => reject(new Error('No se pudo cargar vendor/supabase/supabase.js'));
    document.head.appendChild(script);
  });
  return libPromise;
}

export async function getClient() {
  if (!isConfigured()) throw new Error('Supabase no está configurado');
  if (client) return client;
  const lib = await loadLibrary();
  client = lib.createClient(SUPABASE_URL.replace(/\/$/, ''), SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  return client;
}

/* ---------------- Metadatos de sincronización ---------------- */

function meta() {
  const raw = storage.get(META_KEY, {});
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
}

function saveMeta(next) {
  storage.set(META_KEY, next, { silent: true });
}

function touch(key, when = new Date().toISOString()) {
  const m = meta();
  m[key] = { ...(m[key] || {}), updatedAt: when };
  saveMeta(m);
}

function markPushed(key, when) {
  const m = meta();
  m[key] = { ...(m[key] || {}), updatedAt: when, pushedAt: when };
  saveMeta(m);
}

function pendingKeys() {
  const m = meta();
  return SYNC_KEYS.filter(key => {
    const entry = m[key];
    if (!entry?.updatedAt) return false;
    return !entry.pushedAt || entry.pushedAt < entry.updatedAt;
  });
}

/* ---------------- Sesión ---------------- */

export async function init() {
  if (started) return state();
  started = true;

  if (!isConfigured()) { setStatus('guest'); return state(); }

  try {
    const sb = await getClient();
    const { data } = await sb.auth.getSession();
    session = data.session || null;

    sb.auth.onAuthStateChange((event, next) => {
      session = next || null;
      if (session?.user) {
        setStatus('syncing');
        syncNow().catch(err => setStatus('error', err.message));
      } else {
        setStatus('signedOut');
      }
      emit('account:change', state());
    });

    if (session?.user) {
      setStatus('syncing');
      syncNow().catch(err => setStatus('error', err.message));
    } else {
      setStatus('signedOut');
    }
  } catch (err) {
    console.warn('[cuenta] no se pudo iniciar', err);
    setStatus('error', err.message);
  }

  // Cualquier escritura local de una clave sincronizada marca cambio pendiente.
  on('storage:write', ({ name }) => {
    if (!SYNC_KEYS.includes(name)) return;
    touch(name);
    schedulePush();
  });

  window.addEventListener('online', () => {
    if (session?.user) syncNow().catch(() => {});
  });

  return state();
}

export async function signUp(email, password) {
  const sb = await getClient();
  const { data, error } = await sb.auth.signUp({
    email, password,
    options: { emailRedirectTo: location.href.split('#')[0] }
  });
  if (error) throw error;
  // Si el proyecto pide verificar el correo, aun no hay sesion.
  return { needsConfirmation: !data.session };
}

export async function signIn(email, password) {
  const sb = await getClient();
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return true;
}

export async function resetPassword(email) {
  const sb = await getClient();
  const { error } = await sb.auth.resetPasswordForEmail(email, {
    redirectTo: location.href.split('#')[0]
  });
  if (error) throw error;
  return true;
}

export async function signOut() {
  const sb = await getClient();
  const { error } = await sb.auth.signOut();
  if (error) throw error;
  session = null;
  setStatus('signedOut');
  return true;
}

/* ---------------- Sincronización ---------------- */

function schedulePush() {
  if (!session?.user) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => { push().catch(() => {}); }, PUSH_DELAY);
}

/** Baja lo que haya en la nube y aplica lo que sea mas reciente que lo local. */
export async function pull() {
  if (!session?.user) return { applied: [] };
  const sb = await getClient();
  const { data, error } = await sb.from(SUPABASE_TABLE)
    .select('key, value, updated_at')
    .eq('user_id', session.user.id);
  if (error) throw error;

  const m = meta();
  const applied = [];

  for (const row of data || []) {
    if (!SYNC_KEYS.includes(row.key)) continue;
    const localAt = m[row.key]?.updatedAt || '';
    // Gana el mas reciente.
    if (localAt && localAt >= row.updated_at) continue;
    storage.set(row.key, row.value, { silent: true });   // silent: no re-encolar
    m[row.key] = { updatedAt: row.updated_at, pushedAt: row.updated_at };
    applied.push(row.key);
  }
  saveMeta(m);
  if (applied.length) emit('sync:applied', { keys: applied });
  return { applied };
}

/** Sube lo que ha cambiado en local desde el ultimo envio. */
export async function push() {
  if (!session?.user) return { pushed: [] };
  const keys = pendingKeys();
  if (!keys.length) { setStatus('synced'); return { pushed: [] }; }
  if (!navigator.onLine) { setStatus('offline'); return { pushed: [] }; }

  const sb = await getClient();
  const now = new Date().toISOString();
  const rows = keys.map(key => ({
    user_id: session.user.id,
    key,
    value: storage.get(key, null),
    updated_at: now
  }));

  const { error } = await sb.from(SUPABASE_TABLE).upsert(rows, { onConflict: 'user_id,key' });
  if (error) { setStatus('error', error.message); throw error; }

  for (const key of keys) markPushed(key, now);
  setStatus('synced');
  return { pushed: keys };
}

export async function syncNow() {
  if (!session?.user) return state();
  if (!navigator.onLine) { setStatus('offline'); return state(); }
  setStatus('syncing');
  try {
    await pull();
    await push();
    setStatus('synced');
  } catch (err) {
    setStatus('error', err.message);
    throw err;
  }
  return state();
}

/** Marca todo lo local como pendiente: util tras iniciar sesion por primera vez. */
export function markAllDirty() {
  const now = new Date().toISOString();
  const m = meta();
  for (const key of SYNC_KEYS) {
    if (storage.get(key, null) === null) continue;
    m[key] = { ...(m[key] || {}), updatedAt: now };
  }
  saveMeta(m);
}

/** Borra las filas de este usuario en la nube. Lo local no se toca. */
export async function deleteCloudData() {
  if (!session?.user) throw new Error('No hay sesión iniciada');
  const sb = await getClient();
  const { error } = await sb.from(SUPABASE_TABLE).delete().eq('user_id', session.user.id);
  if (error) throw error;
  saveMeta({});
  setStatus('synced');
  return true;
}
