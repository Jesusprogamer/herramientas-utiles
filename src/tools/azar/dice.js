/**
 * Dados dibujados en SVG.
 *  · d6 -> cara clásica de puntos
 *  · los demás -> la forma del dado (triángulo, rombo, pentágono…) con su número
 */
const NS = 'http://www.w3.org/2000/svg';
const el = (n, a = {}) => {
  const node = document.createElementNS(NS, n);
  for (const [k, v] of Object.entries(a)) node.setAttribute(k, String(v));
  return node;
};

/* Posiciones de los puntos del d6, en una rejilla de 3x3. */
const PIPS = {
  1: [[1, 1]],
  2: [[0, 0], [2, 2]],
  3: [[0, 0], [1, 1], [2, 2]],
  4: [[0, 0], [2, 0], [0, 2], [2, 2]],
  5: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]],
  6: [[0, 0], [2, 0], [0, 1], [2, 1], [0, 2], [2, 2]]
};

/** Contorno de cada tipo de dado, dentro de un lienzo de 100. */
const OUTLINES = {
  4: 'M 50 8 L 92 82 L 8 82 Z',                                  // triángulo
  8: 'M 50 6 L 90 50 L 50 94 L 10 50 Z',                         // rombo
  10: 'M 50 6 L 88 38 L 74 88 L 26 88 L 12 38 Z',                // pentágono
  12: 'M 50 6 L 84 24 L 92 62 L 68 92 L 32 92 L 8 62 L 16 24 Z', // heptágono
  20: 'M 50 6 L 88 28 L 88 72 L 50 94 L 12 72 L 12 28 Z'         // hexágono
};

function frame() {
  const svg = el('svg', { viewBox: '0 0 100 100', 'aria-hidden': 'true' });
  svg.classList.add('die__svg');
  return svg;
}

/** Cara clásica de puntos, para el d6. */
export function d6Face(value) {
  const svg = frame();
  svg.appendChild(el('rect', {
    x: 6, y: 6, width: 88, height: 88, rx: 18,
    fill: 'var(--c-surface-2)', stroke: 'var(--c-accent)', 'stroke-width': 3
  }));
  for (const [cx, cy] of PIPS[value] || []) {
    svg.appendChild(el('circle', {
      cx: 27 + cx * 23, cy: 27 + cy * 23, r: 8, fill: 'var(--c-accent)'
    }));
  }
  return svg;
}

/** Dado con forma y número dentro, para el resto de caras. */
export function shapeFace(sides, value) {
  const svg = frame();
  const outline = OUTLINES[sides] || OUTLINES[20];
  svg.appendChild(el('path', {
    d: outline, fill: 'var(--c-surface-2)',
    stroke: 'var(--c-accent)', 'stroke-width': 3, 'stroke-linejoin': 'round'
  }));
  const text = el('text', {
    x: 50, y: sides === 4 ? 66 : 50,
    'text-anchor': 'middle', 'dominant-baseline': 'central',
    fill: 'var(--c-accent)', 'font-size': String(value >= 100 ? 26 : 34),
    'font-weight': '700', 'font-family': 'system-ui, sans-serif'
  });
  text.textContent = String(value);
  svg.appendChild(text);
  return svg;
}

export function dieFace(sides, value) {
  return sides === 6 ? d6Face(value) : shapeFace(sides, value);
}
