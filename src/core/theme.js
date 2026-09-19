/**
 * Tema, acento, tamano de texto y animaciones.
 * El primer pintado ya lo resuelve el script inline de index.html;
 * este modulo mantiene todo sincronizado despues.
 */
import * as settings from './settings.js';
import { on } from './events.js';

const THEME_COLORS = { dark: '#0f1115', light: '#f5f6f9' };
const mq = window.matchMedia('(prefers-color-scheme: light)');

export function resolvedTheme() {
  const pref = settings.get('theme');
  if (pref === 'system') return mq.matches ? 'light' : 'dark';
  return pref === 'light' ? 'light' : 'dark';
}

export function apply() {
  const root = document.documentElement;
  const theme = resolvedTheme();

  root.setAttribute('data-theme', theme);
  root.setAttribute('data-accent', settings.get('accent'));
  root.setAttribute('data-text-size', settings.get('textSize'));

  if (settings.get('reduceMotion')) root.setAttribute('data-reduce-motion', 'on');
  else root.removeAttribute('data-reduce-motion');

  root.style.colorScheme = theme;

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', THEME_COLORS[theme]);
  const scheme = document.querySelector('meta[name="color-scheme"]');
  if (scheme) scheme.setAttribute('content', theme === 'light' ? 'light dark' : 'dark light');
}

export function init() {
  apply();
  // Si el usuario elige "Sistema", seguimos los cambios del sistema en vivo.
  const onSystemChange = () => { if (settings.get('theme') === 'system') apply(); };
  if (typeof mq.addEventListener === 'function') mq.addEventListener('change', onSystemChange);
  else if (typeof mq.addListener === 'function') mq.addListener(onSystemChange);

  on('settings:change', ({ changed }) => {
    if (changed.some(k => ['theme', 'accent', 'textSize', 'reduceMotion'].includes(k))) apply();
  });
}
