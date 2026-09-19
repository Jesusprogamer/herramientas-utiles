/**
 * Degradados de la marca, uno por color de acento.
 *
 * Este archivo es la ÚNICA fuente de los dos tonos de cada degradado. De aquí
 * salen el logo de la cabecera, la pantalla de carga, "Acerca de", el favicon,
 * el apple-touch-icon y los iconos de instalación que genera
 * scripts/build-icons.js. Si cambias un tono, cambia en todos los sitios.
 *
 * El símbolo (los tres cuadrados y el círculo) es siempre blanco: lo que
 * cambia es el fondo.
 */

/**
 * `from` arriba a la izquierda, `to` abajo a la derecha.
 *
 * Regla al elegir tonos: el símbolo es blanco, así que AMBOS extremos deben
 * quedar al menos a 3:1 de contraste con el blanco. Si no, a tamaño de
 * favicon el símbolo se pierde sobre la esquina clara. Cada tono es el más
 * luminoso que cumple ese mínimo, manteniendo intactos el matiz y la
 * saturación, y el extremo oscuro va 14 puntos de luminosidad por debajo.
 * tests/accents.test.js comprueba el 3:1 y falla si alguien lo rompe.
 */
export const GRADIENTS = Object.freeze({
  azul:     { from: '#4791ff', to: '#235adb' },
  violeta:  { from: '#9f7aff', to: '#6933ff' },
  verde:    { from: '#24a752', to: '#166e3b' },
  naranja:  { from: '#e76f00', to: '#954a0b' },
  rosa:     { from: '#ff4a9e', to: '#d82a84' },
  cian:     { from: '#139fb3', to: '#0d6372' }
});

export const DEFAULT_ACCENT = 'azul';
export const ACCENT_NAMES = Object.keys(GRADIENTS);
export const SYMBOL_COLOR = '#ffffff';

export function gradientFor(accent) {
  return GRADIENTS[accent] || GRADIENTS[DEFAULT_ACCENT];
}

/**
 * Geometría del símbolo dentro de un lienzo de 512.
 * `inset` sube o baja el tamaño del símbolo; los iconos "maskable" lo
 * encogen para que no lo recorte la máscara del sistema.
 */
const SHAPES = [
  { t: 'rect', x: 128, y: 128, w: 112, h: 112, r: 28 },
  { t: 'rect', x: 272, y: 128, w: 112, h: 112, r: 28 },
  { t: 'rect', x: 128, y: 272, w: 112, h: 112, r: 28 },
  { t: 'circle', cx: 328, cy: 328, r: 56 }
];

/**
 * SVG de la marca como texto.
 * @param {object} options
 * @param {string} options.accent   nombre del acento
 * @param {boolean} options.maskable  fondo a sangre y símbolo encogido
 * @param {string} options.id       identificador del degradado (único por documento)
 */
export function markSvgSource({ accent = DEFAULT_ACCENT, maskable = false, id = 'amano-grad' } = {}) {
  const { from, to } = gradientFor(accent);
  const scale = maskable ? 0.62 : 1;
  const background = maskable
    ? '<rect width="512" height="512"/>'
    : '<rect width="512" height="512" rx="112"/>';

  const symbol = SHAPES.map(s => (s.t === 'rect'
    ? `<rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" rx="${s.r}"/>`
    : `<circle cx="${s.cx}" cy="${s.cy}" r="${s.r}"/>`)).join('');

  const group = maskable
    ? `<g fill="${SYMBOL_COLOR}" transform="translate(256 256) scale(${scale}) translate(-256 -256)">${symbol}</g>`
    : `<g fill="${SYMBOL_COLOR}">${symbol}</g>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">`
    + `<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">`
    + `<stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/>`
    + `</linearGradient></defs>`
    + `<g fill="url(#${id})">${background}</g>`
    + group
    + `</svg>`;
}

/** Favicon como data URL, para cambiarlo sin pedir nada a la red. */
export function faviconDataUrl(accent) {
  const svg = markSvgSource({ accent, id: 'f' });
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/** Carpeta de los iconos ya renderizados de ese acento. */
export function iconDir(accent) {
  return `./assets/icons/${ACCENT_NAMES.includes(accent) ? accent : DEFAULT_ACCENT}/`;
}

/** Manifest correspondiente a ese acento. */
export function manifestPath(accent) {
  return ACCENT_NAMES.includes(accent) && accent !== DEFAULT_ACCENT
    ? `./manifest-${accent}.json`
    : './manifest.json';
}

/* ---------------- Construcción del SVG en el DOM ---------------- */

const NS = 'http://www.w3.org/2000/svg';
let uid = 0;

/**
 * Devuelve un <svg> de la marca, construido nodo a nodo.
 * `refresh(accent)` lo repinta con otro acento sin recrearlo.
 */
export function markSvg({ accent = DEFAULT_ACCENT, size, label, animated = false } = {}) {
  const gradientId = `amano-grad-${++uid}`;
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 512 512');
  if (size) { svg.setAttribute('width', size); svg.setAttribute('height', size); }
  if (label) {
    svg.setAttribute('role', 'img');
    const title = document.createElementNS(NS, 'title');
    title.textContent = label;
    svg.appendChild(title);
  } else {
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
  }

  const defs = document.createElementNS(NS, 'defs');
  const gradient = document.createElementNS(NS, 'linearGradient');
  gradient.setAttribute('id', gradientId);
  gradient.setAttribute('x1', '0'); gradient.setAttribute('y1', '0');
  gradient.setAttribute('x2', '1'); gradient.setAttribute('y2', '1');
  const stopFrom = document.createElementNS(NS, 'stop');
  stopFrom.setAttribute('offset', '0');
  const stopTo = document.createElementNS(NS, 'stop');
  stopTo.setAttribute('offset', '1');
  gradient.append(stopFrom, stopTo);
  defs.appendChild(gradient);
  svg.appendChild(defs);

  const background = document.createElementNS(NS, 'rect');
  background.setAttribute('width', '512');
  background.setAttribute('height', '512');
  background.setAttribute('rx', '112');
  background.setAttribute('fill', `url(#${gradientId})`);
  svg.appendChild(background);

  SHAPES.forEach((shape, index) => {
    const el = document.createElementNS(NS, shape.t);
    if (shape.t === 'rect') {
      el.setAttribute('x', shape.x); el.setAttribute('y', shape.y);
      el.setAttribute('width', shape.w); el.setAttribute('height', shape.h);
      el.setAttribute('rx', shape.r);
    } else {
      el.setAttribute('cx', shape.cx); el.setAttribute('cy', shape.cy);
      el.setAttribute('r', shape.r);
    }
    el.setAttribute('fill', SYMBOL_COLOR);
    if (animated) {
      el.setAttribute('class', 'mark__shape');
      el.style.animationDelay = `${index * 0.12}s`;
    }
    svg.appendChild(el);
  });

  svg.refresh = next => {
    const { from, to } = gradientFor(next);
    stopFrom.setAttribute('stop-color', from);
    stopTo.setAttribute('stop-color', to);
  };
  svg.refresh(accent);
  return svg;
}
