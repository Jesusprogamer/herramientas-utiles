/**
 * Moneda dibujada a mano en SVG. No imita ninguna moneda real:
 *  · cara -> perfil estilizado con corona de laurel
 *  · cruz -> cruz decorativa con orla
 */
const NS = 'http://www.w3.org/2000/svg';

/** Acabados: [borde claro, centro, borde oscuro, color del relieve]. */
export const FINISHES = {
  oro:   { light: '#ffe08a', mid: '#e8b230', dark: '#9a6b0c', relief: '#6b4906' },
  plata: { light: '#f2f5f8', mid: '#c2cad3', dark: '#7d8792', relief: '#5a636d' },
  cobre: { light: '#f5c9a6', mid: '#c97b45', dark: '#8a4a1f', relief: '#5f3113' }
};
export const FINISH_NAMES = Object.keys(FINISHES);

const el = (name, attrs = {}) => {
  const node = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
};

let uid = 0;

function disc(finish, id) {
  const g = el('g');
  const defs = el('defs');
  const grad = el('radialGradient', { id, cx: '0.35', cy: '0.3', r: '0.85' });
  grad.append(
    el('stop', { offset: '0', 'stop-color': finish.light }),
    el('stop', { offset: '0.6', 'stop-color': finish.mid }),
    el('stop', { offset: '1', 'stop-color': finish.dark })
  );
  defs.appendChild(grad);
  g.append(
    defs,
    el('circle', { cx: 100, cy: 100, r: 96, fill: `url(#${id})` }),
    el('circle', { cx: 100, cy: 100, r: 96, fill: 'none', stroke: finish.dark, 'stroke-width': 4 }),
    el('circle', { cx: 100, cy: 100, r: 84, fill: 'none', stroke: finish.relief, 'stroke-width': 2, opacity: 0.55 })
  );
  return g;
}

/** Cara: perfil mirando a la izquierda, con laurel alrededor. */
export function headsFace(finish) {
  const svg = el('svg', { viewBox: '0 0 200 200', 'aria-hidden': 'true' });
  svg.appendChild(disc(finish, `coin-h-${++uid}`));
  const ink = finish.relief;

  // Corona de laurel: dos arcos con hojas.
  for (const dir of [-1, 1]) {
    svg.appendChild(el('path', {
      d: `M ${100 + dir * 62} 148 Q ${100 + dir * 78} 100 ${100 + dir * 52} 56`,
      fill: 'none', stroke: ink, 'stroke-width': 4, 'stroke-linecap': 'round', opacity: 0.8
    }));
    for (let i = 0; i < 5; i++) {
      const y = 140 - i * 20;
      const x = 100 + dir * (62 + Math.sin(i * 0.7) * 6);
      svg.appendChild(el('ellipse', {
        cx: x, cy: y, rx: 9, ry: 4.5, fill: ink, opacity: 0.75,
        transform: `rotate(${dir * (35 - i * 9)} ${x} ${y})`
      }));
    }
  }

  // Perfil: frente, nariz, labios y barbilla en un solo trazo.
  svg.appendChild(el('path', {
    d: 'M 118 52 C 92 52 74 72 74 98 C 74 108 78 116 78 124 '
     + 'L 70 132 C 68 135 70 138 74 138 L 82 138 '
     + 'C 82 146 86 150 94 151 L 96 164 '
     + 'C 110 162 124 152 132 138 C 140 124 142 108 138 92 '
     + 'C 134 70 128 52 118 52 Z',
    fill: ink, opacity: 0.92
  }));
  svg.appendChild(el('circle', { cx: 112, cy: 92, r: 4, fill: finish.light, opacity: 0.85 }));
  svg.appendChild(el('path', {
    d: 'M 122 60 C 136 64 146 76 148 92',
    fill: 'none', stroke: ink, 'stroke-width': 5, 'stroke-linecap': 'round', opacity: 0.6
  }));
  return svg;
}

/** Cruz: cruz decorativa con orla de puntos. */
export function tailsFace(finish) {
  const svg = el('svg', { viewBox: '0 0 200 200', 'aria-hidden': 'true' });
  svg.appendChild(disc(finish, `coin-t-${++uid}`));
  const ink = finish.relief;

  svg.appendChild(el('path', {
    d: 'M 88 40 H 112 V 88 H 160 V 112 H 112 V 160 H 88 V 112 H 40 V 88 H 88 Z',
    fill: ink, opacity: 0.9, stroke: finish.dark, 'stroke-width': 2, 'stroke-linejoin': 'round'
  }));
  // Remates en las puntas.
  for (const [cx, cy] of [[100, 34], [100, 166], [34, 100], [166, 100]]) {
    svg.appendChild(el('circle', { cx, cy, r: 7, fill: ink, opacity: 0.9 }));
  }
  // Orla de puntos.
  for (let i = 0; i < 24; i++) {
    const angle = (i / 24) * Math.PI * 2;
    svg.appendChild(el('circle', {
      cx: 100 + Math.cos(angle) * 74, cy: 100 + Math.sin(angle) * 74,
      r: 2.6, fill: ink, opacity: 0.5
    }));
  }
  return svg;
}

/**
 * Moneda completa con sus dos caras montadas para girar en 3D.
 * Devuelve { root, showFace(cara) }.
 */
export function buildCoin(finishName) {
  const finish = FINISHES[finishName] || FINISHES.oro;
  const heads = headsFace(finish);
  const tails = tailsFace(finish);
  heads.classList.add('coin3d__face', 'coin3d__face--heads');
  tails.classList.add('coin3d__face', 'coin3d__face--tails');

  const inner = document.createElement('div');
  inner.className = 'coin3d__inner';
  inner.append(heads, tails);

  const root = document.createElement('div');
  root.className = 'coin3d';
  root.appendChild(inner);
  return { root, inner };
}
