/** Arranque de la aplicacion. */
import * as storage from './core/storage.js';
import * as settings from './core/settings.js';
import * as i18n from './core/i18n.js';
import * as theme from './core/theme.js';
import { markSvg } from './core/accents.js';
import * as registry from './core/registry.js';
import * as router from './core/router.js';
import * as pwa from './core/pwa.js';
import * as account from './core/account.js';
import * as audio from './core/audio.js';
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

/**
 * Sustituye las marcas estaticas del HTML por el SVG con degradado del
 * acento. El HTML trae una version plana para que la pantalla de carga tenga
 * algo que enseñar antes de que arranque el JS.
 */
function paintMarks() {
  const brand = document.querySelector('#brand-link .brand-mark');
  if (brand) {
    const logo = markSvg({ accent: settings.get('accent') });
    logo.classList.add('brand-logo');
    brand.replaceWith(logo);
    theme.registerMark(logo);
  }

  const splashMark = document.querySelector('#splash .splash__mark');
  if (splashMark) {
    const logo = markSvg({ accent: settings.get('accent'), animated: true });
    logo.classList.add('splash-logo');
    splashMark.replaceWith(logo);
    theme.registerMark(logo);
  }
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

/* Los estilos de las herramientas se cargan una sola vez, la primera vez que
   se abre una. Asi no retrasan el primer pintado del inicio. */
let toolStyles = null;
function ensureToolStyles() {
  if (toolStyles) return toolStyles;
  toolStyles = new Promise(resolve => {
    const link = h('link', { rel: 'stylesheet', href: './styles/tools.css' });
    link.addEventListener('load', resolve, { once: true });
    link.addEventListener('error', resolve, { once: true });
    document.head.appendChild(link);
    setTimeout(resolve, 2000);   // nunca bloquear la vista por un estilo
  });
  return toolStyles;
}

async function toolRoute(ctx) {
  const tool = registry.byId(ctx.params.id);
  if (!tool) return notFound(ctx);
  if (!tool.ready) return toolPlaceholder(ctx);
  try {
    await ensureToolStyles();
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
  paintMarks();
  paintChrome();
  registerRoutes();

  on('i18n:change', () => { paintChrome(); });
  on('router:change', ({ path }) => { markCurrent(path); audio.play('navigate'); });
  on('pwa:update', showUpdateBar);

  // Datos llegados de la nube: recargamos lo que la app tiene en memoria
  // y repintamos la pantalla actual para que se vean al momento.
  on('sync:applied', ({ keys }) => {
    settings.load();
    registry.load();
    theme.apply();
    if (keys.includes('settings')) i18n.setLanguage(settings.get('language')).catch(() => {});
    router.refresh();
    toast(t('sync.applied'), { kind: 'success' });
  });

  await router.start($('#main'));

  $('#app').hidden = false;

  // Un minimo de 350 ms evita un parpadeo brusco en conexiones rapidas.
  const wait = Math.max(0, 350 - (performance.now() - started));
  setTimeout(() => {
    splash.classList.add('splash--hiding');
    setTimeout(() => splash.remove(), 350);
  }, wait);

  audio.init();
  watchConnection();
  pwa.watchInstallPrompt();
  pwa.registerServiceWorker();

  // La cuenta es opcional: si no esta configurada, esto no hace nada.
  account.init().catch(err => console.warn('[app] cuenta no disponible', err));
}

boot().catch(err => {
  console.error('[app] fallo al arrancar', err);
  const splashText = document.getElementById('splash-text');
  if (splashText) splashText.textContent = 'Error';
});
