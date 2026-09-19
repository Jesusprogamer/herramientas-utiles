/**
 * Service worker, aviso de actualizacion e instalacion.
 */
import { emit } from './events.js';

let registration = null;
let waitingWorker = null;
let deferredPrompt = null;
let reloading = false;

export function supported() {
  return 'serviceWorker' in navigator;
}

export function installAvailable() {
  return deferredPrompt !== null;
}

export function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function trackWorker(worker) {
  if (!worker) return;
  worker.addEventListener('statechange', () => {
    if (worker.state === 'installed' && navigator.serviceWorker.controller) {
      waitingWorker = worker;
      emit('pwa:update', { worker });
    }
  });
}

export async function registerServiceWorker() {
  if (!supported()) return null;
  // El alcance relativo permite publicar en https://usuario.github.io/repo/
  try {
    registration = await navigator.serviceWorker.register('./sw.js', { scope: './' });
  } catch (err) {
    console.warn('[pwa] no se pudo registrar el service worker', err);
    return null;
  }

  if (registration.waiting && navigator.serviceWorker.controller) {
    waitingWorker = registration.waiting;
    emit('pwa:update', { worker: waitingWorker });
  }
  trackWorker(registration.installing);
  registration.addEventListener('updatefound', () => trackWorker(registration.installing));

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return;
    reloading = true;
    location.reload();
  });

  return registration;
}

export function hasUpdate() { return waitingWorker !== null; }

/** Aplica la actualizacion en espera: el SW toma el control y se recarga. */
export function applyUpdate() {
  if (!waitingWorker) return false;
  waitingWorker.postMessage({ type: 'SKIP_WAITING' });
  return true;
}

export function dismissUpdate() {
  emit('pwa:update-dismissed', {});
}

/** Busca una version nueva a peticion del usuario. */
export async function checkForUpdate() {
  if (!registration) return { supported: supported(), found: hasUpdate() };
  try {
    await registration.update();
  } catch (err) {
    console.warn('[pwa] fallo al buscar actualizaciones', err);
  }
  if (registration.waiting && navigator.serviceWorker.controller) {
    waitingWorker = registration.waiting;
    emit('pwa:update', { worker: waitingWorker });
  }
  return { supported: true, found: hasUpdate() };
}

/** Captura el aviso de instalacion para poder ofrecerlo desde Ajustes. */
export function watchInstallPrompt() {
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e;
    emit('pwa:installable', {});
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    emit('pwa:installed', {});
  });
}

export async function promptInstall() {
  if (!deferredPrompt) return 'unavailable';
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  deferredPrompt = null;
  emit('pwa:installable', {});
  return outcome; // 'accepted' | 'dismissed'
}
