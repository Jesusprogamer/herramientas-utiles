/** Arranque de la aplicacion. */
import * as storage from './core/storage.js';
import * as settings from './core/settings.js';
import * as i18n from './core/i18n.js';
import * as theme from './core/theme.js';
import * as registry from './core/registry.js';
import * as router from './core/router.js';
import * as pwa from './core/pwa.js';
import { on } from './core/events.js';
import { h, clear, $ } from './ui/dom.js';
import { icon } from './ui/icons.js';
import { iconButton, button, emptyState } from './ui/components.js';
import { toast } from './ui/toast.js';
import { t } from './core/i18n.js';

import home from './views/home.js';
import settingsView from './views/settings.js';
import { privacy, licenses, notFound, toolPlaceholder } from './views/info.js';

/* ---------------- Barra superior ---------------- */

const NAV = [
  { path: '/', icon: 'home', key: 'nav.home' },
  { path: '/ajustes', icon: 'settings', key: 'nav.settings' }
];

function paintChrome() {
  $('#brand-name').textContent = t('app.name');
  $('#skip-link').textContent = t('skip.toContent');
  $('#foot-text').textContent = t('foot.text');
  // Sin aria-label: el nombre accesible del enlace es su texto visible ("A mano"),
  // para que el control por voz funcione con lo que se ve en pantalla.

  const nav = $('#appbar-nav');
  nav.setAttribute('aria-label', t('nav.label'));
  clear(nav);
  for (const item of NAV) {
    const link = h('a.icon-btn', {
      href: `#${item.path}`,
      'aria-label': t(item.key),
      title: t(item.key)
    }, icon(item.icon));
    link.dataset.path = item.path;
    nav.appendChild(link);
  }
  markCurrent(router.current());
}

function markCurrent(path) {
  for (const link of document.querySelectorAll('#appbar-nav a')) {
    const active = link.dataset.path === path;
    if (active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
}

/* ---------------- Aviso de actualizacion ---------------- */

let updateBar = null;

function showUpdateBar() {
  if (updateBar) return;
  updateBar = h('div.updatebar', { role: 'status' },
    h('span.grow', { text: t('update.available') }),
    button(t('update.dismiss'), { variant: 'ghost', onClick: hideUpdateBar }),
    button(t('update.action'), {
      variant: 'primary',
      onClick: () => { toast(t('update.applying')); pwa.applyUpdate(); }
    })
  );
  document.body.appendChild(updateBar);
}

function hideUpdateBar() {
  updateBar?.remove();
  updateBar = null;
}

/* ---------------- Rutas ---------------- */

async function toolRoute(ctx) {
  const tool = registry.byId(ctx.params.id);
  if (!tool) return notFound(ctx);
  if (!tool.ready) return toolPlaceholder(ctx);
  try {
    const mod = await import(`./tools/${tool.id}/index.js`);
    const view = mod.default;
    const cleanup = await view.mount(ctx.outlet, {
      t, settings, storage, registry, i18n, navigate: router.navigate
    });
    return () => { try { view.unmount?.(); } catch { /* ignorado */ } cleanup?.(); };
  } catch (err) {
    console.error(`[app] no se pudo cargar la herramienta "${tool.id}"`, err);
    ctx.outlet.appendChild(h('div.page', emptyState({
      iconName: 'alert',
      title: t('tool.failed.title'),
      message: t('tool.failed.message'),
      action: button(t('tool.soon.back'), { variant: 'primary', onClick: () => router.navigate('/') })
    })));
  }
}

function registerRoutes() {
  router.register('/', home);
  router.register('/ajustes', settingsView);
  router.register('/privacidad', privacy);
  router.register('/licencias', licenses);
  router.register('/h/:id', toolRoute);
  router.setNotFound(notFound);
}

/* ---------------- Conexion ---------------- */

function watchConnection() {
  window.addEventListener('offline', () => toast(t('connection.offline'), { kind: 'info' }));
  window.addEventListener('online', () => toast(t('connection.online'), { kind: 'success' }));
}

/* ---------------- Arranque ---------------- */

async function boot() {
  const splash = $('#splash');
  const splashText = $('#splash-text');
  const started = performance.now();

  settings.load();
  storage.runMigrations();
  registry.load();

  try {
    await i18n.init();
  } catch (err) {
    console.error('[app] no se pudieron cargar los idiomas', err);
    splashText.textContent = 'Error';
    return;
  }

  splashText.textContent = t('splash.loading');
  theme.init();
  paintChrome();
  registerRoutes();

  on('i18n:change', () => { paintChrome(); });
  on('router:change', ({ path }) => markCurrent(path));
  on('pwa:update', showUpdateBar);

  await router.start($('#main'));

  $('#app').hidden = false;

  // Un minimo de 350 ms evita un parpadeo brusco en conexiones rapidas.
  const wait = Math.max(0, 350 - (performance.now() - started));
  setTimeout(() => {
    splash.classList.add('splash--hiding');
    setTimeout(() => splash.remove(), 350);
  }, wait);

  watchConnection();
  pwa.watchInstallPrompt();
  pwa.registerServiceWorker();
}

boot().catch(err => {
  console.error('[app] fallo al arrancar', err);
  const splashText = document.getElementById('splash-text');
  if (splashText) splashText.textContent = 'Error';
});
