/**
 * Textos de las paginas sueltas (404.html y offline.html).
 *
 * Estas dos paginas son autonomas: GitHub Pages puede servir 404.html desde
 * cualquier ruta profunda, asi que no dependen de ningun archivo externo.
 * Aun asi el texto sigue viniendo de locales/*.json; aqui no hay ni una frase
 * fija. Si el diccionario no se puede cargar, no se inventa nada.
 */
const KEYS = {
  '404': { title: 'notfound.title', message: 'notfound.message', action: 'notfound.action' },
  offline: { title: 'offlinePage.title', message: 'offlinePage.message', action: 'offlinePage.action' }
};

const AVAILABLE = ['es', 'en'];

function pickLanguage() {
  let pref = 'es';
  try { pref = (JSON.parse(localStorage.getItem('amano:v1:settings')) || {}).language || 'es'; }
  catch { /* almacenamiento bloqueado */ }
  if (AVAILABLE.includes(pref)) return pref;
  for (const tag of (navigator.languages || [navigator.language || 'es'])) {
    const base = String(tag).toLowerCase().split('-')[0];
    if (AVAILABLE.includes(base)) return base;
  }
  return 'es';
}

/**
 * Candidatos a raiz del sitio, de la mas corta a la mas larga. En GitHub
 * Pages el 404 puede llegar desde .../repositorio/lo/que/sea, asi que
 * probamos primero el dominio y despues cada segmento de la ruta.
 */
function rootCandidates() {
  const out = [];
  const segments = location.pathname.split('/').filter(Boolean);
  // Quitamos el nombre del archivo si lo hay.
  if (segments.length && segments[segments.length - 1].includes('.')) segments.pop();
  for (let i = 0; i <= segments.length; i++) {
    out.push(`/${segments.slice(0, i).join('/')}${i ? '/' : ''}`);
  }
  return [...new Set(out)];
}

function lookup(dict, path) {
  let node = dict;
  for (const part of path.split('.')) {
    if (!node || typeof node !== 'object' || !(part in node)) return undefined;
    node = node[part];
  }
  return typeof node === 'string' ? node : undefined;
}

(async function init() {
  const page = location.pathname.endsWith('offline.html') ? 'offline' : '404';
  const keys = KEYS[page];
  const lang = pickLanguage();
  document.documentElement.setAttribute('lang', lang);

  let dict = null;
  let root = rootCandidates()[0] || '/';

  for (const candidate of rootCandidates()) {
    try {
      const res = await fetch(`${candidate}locales/${lang}.json`, { cache: 'force-cache' });
      if (res.ok) { dict = await res.json(); root = candidate; break; }
    } catch { /* probamos el siguiente */ }
  }

  const action = document.getElementById('action');
  if (action) action.href = root;

  if (!dict) return;   // sin diccionario no inventamos texto

  document.title = `${lookup(dict, keys.title) || ''} · ${lookup(dict, 'app.name') || ''}`;
  const set = (id, key) => {
    const el = document.getElementById(id);
    const value = lookup(dict, key);
    if (el && value) el.textContent = value;
  };
  set('title', keys.title);
  set('message', keys.message);
  set('action', keys.action);
})();
