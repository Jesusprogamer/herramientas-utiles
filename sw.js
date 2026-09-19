/* Service worker de "A mano".
   Alcance relativo: funciona igual en la raiz de un dominio que en
   https://usuario.github.io/repositorio/ */

const APP_VERSION = '2.1.0';          // sincronizar con src/core/version.js
const CACHE_NAME = `amano-v${APP_VERSION}`;

/* Esqueleto de la app: se guarda en la instalacion para que arranque
   sin conexion desde la primera vez. Rutas relativas al propio sw.js. */
const PRECACHE = [
  './',
  './index.html',
  './offline.html',
  './404.html',
  './manifest.json',
  './styles/tokens.css',
  './styles/themes.css',
  './styles/base.css',
  './styles/components.css',
  './styles/layout.css',
  './styles/tools.css',
  './locales/es.json',
  './locales/en.json',
  './src/main.js',
  './src/standalone.js',
  './src/core/version.js',
  './src/core/events.js',
  './src/core/storage.js',
  './src/core/settings.js',
  './src/core/theme.js',
  './src/core/i18n.js',
  './src/core/registry.js',
  './src/core/router.js',
  './src/core/pwa.js',
  './src/core/random.js',
  './src/core/account.js',
  './src/core/licenses.js',
  './config.js',
  './src/ui/dom.js',
  './src/ui/icons.js',
  './src/ui/toast.js',
  './src/ui/dialog.js',
  './src/ui/components.js',
  './src/views/home.js',
  './src/views/settings.js',
  './src/views/info.js',
  './src/tools/temporizador/index.js',
  './src/tools/listas/index.js',
  './src/tools/unidades/index.js',
  './src/tools/contrasenas/index.js',
  './src/tools/contador-texto/index.js',
  './src/tools/porcentajes/index.js',
  './src/tools/monedas/index.js',
  './src/tools/zonas-horarias/index.js',
  './src/tools/azar/index.js',
  './src/tools/qr/index.js',
  './src/tools/colores/index.js',
  './src/tools/equipos/index.js',
  './vendor/qrcode/qrcode.mjs',
  './vendor/qrcode/qrcode-utf8.mjs',
  './assets/icons/favicon.svg',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/maskable-192.png',
  './assets/icons/maskable-512.png',
  './assets/icons/apple-touch-icon.png'
];

/* Nunca se cachea: las peticiones a Supabase van siempre a la red. */
function isNeverCached(url) {
  return url.hostname.endsWith('supabase.co') || url.hostname.endsWith('supabase.in');
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // addAll falla entero si un recurso falla; los pedimos de uno en uno.
    await Promise.all(PRECACHE.map(async path => {
      try {
        const res = await fetch(new Request(path, { cache: 'reload' }));
        if (res.ok) await cache.put(path, res);
      } catch (err) {
        console.warn('[sw] no se pudo precachear', path, err);
      }
    }));
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(
      names.filter(n => n.startsWith('amano-') && n !== CACHE_NAME).map(n => caches.delete(n))
    );
    if (self.registration.navigationPreload) {
      try { await self.registration.navigationPreload.enable(); } catch { /* opcional */ }
    }
    await self.clients.claim();
  })());
});

/* El aviso "Hay una actualizacion disponible" llama aqui. */
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

async function cacheFirstThenUpdate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request, { ignoreSearch: false });

  const network = fetch(request).then(res => {
    if (res && res.ok && res.type === 'basic') cache.put(request, res.clone()).catch(() => {});
    return res;
  }).catch(() => null);

  if (cached) { network; return cached; }           // stale-while-revalidate
  const res = await network;
  if (res) return res;
  throw new Error('sin red y sin cache');
}

async function handleNavigation(event) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const preload = await event.preloadResponse;
    if (preload) { cache.put('./index.html', preload.clone()).catch(() => {}); return preload; }
    const res = await fetch(event.request);
    if (res && res.ok) cache.put('./index.html', res.clone()).catch(() => {});
    return res;
  } catch {
    return (await cache.match('./index.html'))
        || (await cache.match('./'))
        || (await cache.match('./offline.html'))
        || Response.error();
  }
}

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (isNeverCached(url)) return;                   // siempre a la red
  if (url.origin !== self.location.origin) return;  // otros origenes: sin tocar

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(event));
    return;
  }

  event.respondWith(
    cacheFirstThenUpdate(request).catch(async () => {
      const cache = await caches.open(CACHE_NAME);
      return (await cache.match('./offline.html')) || Response.error();
    })
  );
});
