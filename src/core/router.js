/**
 * Enrutador por hash (#/ruta). Es lo que funciona sin configuracion de
 * servidor en GitHub Pages, y permite rutas relativas en todo el proyecto.
 *
 * Las vistas de herramienta se cargan con import() perezoso.
 */
import { emit } from './events.js';

const routes = new Map();
let notFound = null;
let currentCleanup = null;
let outlet = null;
let currentPath = '';

export function register(path, handler) { routes.set(path, handler); }
export function setNotFound(handler) { notFound = handler; }

export function parse(hash = location.hash) {
  const raw = String(hash).replace(/^#/, '') || '/';
  const [pathPart, queryPart] = raw.split('?');
  const path = ('/' + pathPart.replace(/^\/+|\/+$/g, '')).replace(/\/{2,}/g, '/');
  return { path: path === '/' ? '/' : path, query: new URLSearchParams(queryPart || '') };
}

function match(path) {
  if (routes.has(path)) return { handler: routes.get(path), params: {} };
  for (const [pattern, handler] of routes) {
    if (!pattern.includes(':')) continue;
    const p = pattern.split('/').filter(Boolean);
    const s = path.split('/').filter(Boolean);
    if (p.length !== s.length) continue;
    const params = {};
    let ok = true;
    for (let i = 0; i < p.length; i++) {
      if (p[i].startsWith(':')) params[p[i].slice(1)] = decodeURIComponent(s[i]);
      else if (p[i] !== s[i]) { ok = false; break; }
    }
    if (ok) return { handler, params };
  }
  return null;
}

export function navigate(path, { replace = false } = {}) {
  const target = `#${path.startsWith('/') ? path : `/${path}`}`;
  if (location.hash === target) { render(); return; }
  if (replace) history.replaceState(null, '', target);
  else location.hash = target;
  if (replace) render();
}

export function current() { return currentPath; }

async function render() {
  if (!outlet) return;
  const { path, query } = parse();
  currentPath = path;

  if (typeof currentCleanup === 'function') {
    try { currentCleanup(); } catch (err) { console.error('[router] limpieza', err); }
  }
  currentCleanup = null;

  const found = match(path) || (notFound ? { handler: notFound, params: {} } : null);
  if (!found) return;

  while (outlet.firstChild) outlet.removeChild(outlet.firstChild);

  try {
    const cleanup = await found.handler({ outlet, params: found.params, query, path });
    if (typeof cleanup === 'function') currentCleanup = cleanup;
  } catch (err) {
    console.error('[router] fallo al pintar la ruta', path, err);
    emit('router:error', { path, error: err });
  }

  emit('router:change', { path });

  // Foco al contenido principal para quien navega con teclado o lector.
  outlet.focus?.({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: 'auto' });
}

export function start(outletEl) {
  outlet = outletEl;
  window.addEventListener('hashchange', render);
  if (!location.hash) history.replaceState(null, '', '#/');
  return render();
}

export function refresh() { return render(); }
