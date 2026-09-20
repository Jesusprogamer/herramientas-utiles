/**
 * Iconos SVG en linea (24x24, trazo). Se construyen con createElementNS,
 * nunca con innerHTML.
 */
const NS = 'http://www.w3.org/2000/svg';

const P = d => ({ t: 'path', d });
const C = (cx, cy, r) => ({ t: 'circle', cx, cy, r });
const R = (x, y, w, h, rx = 2) => ({ t: 'rect', x, y, width: w, height: h, rx });
const L = (x1, y1, x2, y2) => ({ t: 'line', x1, y1, x2, y2 });

export const ICONS = {
  /* --- Navegacion e interfaz --- */
  home: [P('M3 10.5 12 3l9 7.5'), P('M5.5 9.5V20h13V9.5')],
  search: [C(11, 11, 7), P('M20 20l-3.7-3.7')],
  settings: [C(12, 12, 3), P('M19.4 13.5a7.6 7.6 0 0 0 0-3l1.8-1.3-2-3.4-2.1.9a7.6 7.6 0 0 0-2.6-1.5L14.2 3H9.8l-.3 2.2a7.6 7.6 0 0 0-2.6 1.5l-2.1-.9-2 3.4 1.8 1.3a7.6 7.6 0 0 0 0 3l-1.8 1.3 2 3.4 2.1-.9a7.6 7.6 0 0 0 2.6 1.5l.3 2.2h4.4l.3-2.2a7.6 7.6 0 0 0 2.6-1.5l2.1.9 2-3.4z')],
  info: [C(12, 12, 9), L(12, 11, 12, 16), L(12, 7.5, 12, 8)],
  shield: [P('M12 3l7 3v5c0 4.4-2.9 8.3-7 10-4.1-1.7-7-5.6-7-10V6z'), P('M9 12l2 2 4-4')],
  star: [P('M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.7l5.9-.9z')],
  x: [L(6, 6, 18, 18), L(18, 6, 6, 18)],
  check: [P('M5 12.5l4.5 4.5L19 7.5')],
  chevronUp: [P('M6 14.5 12 8.5l6 6')],
  chevronDown: [P('M6 9.5 12 15.5l6-6')],
  arrowLeft: [L(20, 12, 4, 12), P('M10 6 4 12l6 6')],
  eye: [P('M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z'), C(12, 12, 3)],
  eyeOff: [P('M10 6.1A8.6 8.6 0 0 1 12 6c6 0 9.5 6 9.5 6a16 16 0 0 1-3.2 3.8'), P('M6.3 7.6A15.7 15.7 0 0 0 2.5 12S6 18 12 18a9 9 0 0 0 3.3-.6'), L(4, 4, 20, 20)],
  download: [L(12, 4, 12, 15), P('M7.5 10.5 12 15l4.5-4.5'), P('M5 18.5h14')],
  upload: [L(12, 16, 12, 5), P('M7.5 9.5 12 5l4.5 4.5'), P('M5 19h14')],
  trash: [P('M4.5 7h15'), P('M9 7V5h6v2'), P('M7 7l.8 12.2h8.4L17 7'), L(10.5, 10.5, 10.5, 16.5), L(13.5, 10.5, 13.5, 16.5)],
  refresh: [P('M20 12a8 8 0 1 1-2.6-5.9'), P('M20 3.5V9h-5.5')],
  alert: [P('M12 4.5 21 19.5H3z'), L(12, 10, 12, 14), L(12, 16.5, 12, 17)],
  sun: [C(12, 12, 4), L(12, 2.5, 12, 4.5), L(12, 19.5, 12, 21.5), L(2.5, 12, 4.5, 12), L(19.5, 12, 21.5, 12), L(5.3, 5.3, 6.7, 6.7), L(17.3, 17.3, 18.7, 18.7), L(18.7, 5.3, 17.3, 6.7), L(6.7, 17.3, 5.3, 18.7)],
  moon: [P('M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5z')],
  monitor: [R(3, 5, 18, 11, 2), L(9, 20, 15, 20), L(12, 16, 12, 20)],
  globe: [C(12, 12, 9), L(3, 12, 21, 12), P('M12 3c2.6 2.4 4 5.6 4 9s-1.4 6.6-4 9c-2.6-2.4-4-5.6-4-9s1.4-6.6 4-9z')],
  database: [P('M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3z'), P('M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6'), P('M20 12c0 1.7-3.6 3-8 3s-8-1.3-8-3')],
  user: [C(12, 8, 3.6), P('M5 20a7 7 0 0 1 14 0')],
  type: [P('M5 7V5h14v2'), L(12, 5, 12, 19), L(9, 19, 15, 19)],
  sliders: [L(4, 8, 14, 8), L(18, 8, 20, 8), L(4, 16, 8, 16), L(12, 16, 20, 16), C(16, 8, 2), C(10, 16, 2)],
  package: [P('M12 3l8 4.5v9L12 21l-8-4.5v-9z'), P('M4 7.5 12 12l8-4.5'), L(12, 12, 12, 21)],
  wifiOff: [L(3, 3, 21, 21), P('M8.5 15.5a5 5 0 0 1 4.6-1.3'), P('M5.5 12.2A9.6 9.6 0 0 1 9 10.2'), P('M18.5 12.2a9.6 9.6 0 0 0-3.2-2'), L(12, 19, 12, 19.1)],
  inbox: [P('M4 13h4l1.5 3h5L16 13h4'), P('M4 13 6.5 5h11L20 13v5.5H4z')],

  /* --- Herramientas --- */
  timer: [C(12, 13.5, 7.5), L(12, 13.5, 12, 9.5), P('M9.5 2.5h5'), L(12, 2.5, 12, 6)],
  checklist: [P('M4 6.5 5.5 8 8 5'), P('M4 13.5 5.5 15 8 12'), L(11, 6.5, 20, 6.5), L(11, 13.5, 20, 13.5), L(11, 19.5, 17, 19.5), P('M4.5 19.5h2')],
  ruler: [P('M3.5 14.5 14.5 3.5l6 6-11 11z'), L(7, 11, 9, 13), L(10, 8, 12, 10), L(13, 5, 15, 7)],
  key: [C(8, 15, 4.2), P('M11 12 20 3'), L(17.5, 5.5, 19.5, 7.5), L(15, 8, 16.5, 9.5)],
  wordcount: [P('M4 6h16'), P('M4 11h16'), P('M4 16h10'), P('M17.5 15l2 2 3-3.5')],
  percent: [L(6, 18, 18, 6), C(7.5, 7.5, 2.5), C(16.5, 16.5, 2.5)],
  currency: [C(12, 12, 9), P('M15 8.5a3.3 3.3 0 0 0-3-1.5c-1.7 0-3 1-3 2.3 0 3 6 1.7 6 4.7 0 1.4-1.3 2.5-3 2.5a3.5 3.5 0 0 1-3.2-1.8'), L(12, 5, 12, 7), L(12, 17, 12, 19)],
  clock: [C(12, 12, 9), P('M12 7v5.2l3.3 2')],
  dice: [R(3.5, 3.5, 17, 17, 3), C(8.5, 8.5, 1.2), C(15.5, 15.5, 1.2), C(12, 12, 1.2)],
  qr: [R(4, 4, 6, 6, 1), R(14, 4, 6, 6, 1), R(4, 14, 6, 6, 1), L(14, 14, 16, 14), L(14, 17, 14, 20), L(17, 17, 20, 17), L(20, 20, 17, 20), L(20, 14, 20, 15.5)],
  palette: [P('M12 3a9 9 0 0 0 0 18c1.2 0 2-.8 2-1.8 0-.6-.3-1-.6-1.4-.3-.4-.5-.8-.5-1.3 0-1 .8-1.8 1.8-1.8H16a5 5 0 0 0 5-5c0-3.9-4-6.7-9-6.7z'), C(7.5, 11.5, 1.2), C(10.5, 7.5, 1.2), C(15.5, 8.5, 1.2)],
  users: [C(9, 8, 3.4), P('M3 19a6 6 0 0 1 12 0'), P('M16 5.2a3.4 3.4 0 0 1 0 6.6'), P('M17 14.2A6 6 0 0 1 21 19')],

  /* --- Fase 4: matematicas, ciencias y estudio --- */
  plus: [L(12, 5, 12, 19), L(5, 12, 19, 12)],
  minus: [L(5, 12, 19, 12)],
  chart: [P('M3 20h18'), P('M4 16c3-9 6 4 8-3s4 2 8-7')],
  binary: [R(4, 4, 6.5, 7, 1.5), R(13.5, 13, 6.5, 7, 1.5), P('M4 20h6.5'), P('M7.2 13v7'), P('M13.5 4.5 18 11')],
  atom: [C(12, 12, 2), P('M12 4.2c4.6 0 8.3 3.5 8.3 7.8S16.6 19.8 12 19.8 3.7 16.3 3.7 12 7.4 4.2 12 4.2z'), P('M7.8 6.3c2.3-4 6.5-5.6 9.3-3.5S19 9.9 16.7 13.9 10.2 19.5 7.4 17.4 5.5 10.3 7.8 6.3z')],
  book: [P('M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z'), L(8, 7.5, 16, 7.5), L(8, 11, 13.5, 11)],
  calendar: [R(3.5, 5, 17, 15.5, 2.5), L(8, 3, 8, 6.5), L(16, 3, 16, 6.5), L(3.5, 10, 20.5, 10), C(8.5, 14.5, 1), C(12.5, 14.5, 1)],
  grid: [R(3.5, 3.5, 17, 17, 2.5), L(3.5, 9.5, 20.5, 9.5), L(3.5, 15, 20.5, 15), L(9.5, 9.5, 9.5, 20.5)],
  award: [C(12, 9, 5.5), P('M8.5 13.5 7 21l5-2.5 5 2.5-1.5-7.5')],

  /* --- Fase 5: minibarra --- */
  play: [P('M8 5.5 18 12 8 18.5z')],
  pause: [L(9.5, 5.5, 9.5, 18.5), L(14.5, 5.5, 14.5, 18.5)],
  stopwatch: [C(12, 13.5, 7.5), L(12, 13.5, 12, 9.5), L(9.5, 2.5, 14.5, 2.5), L(12, 2.5, 12, 6)]
};

/** Devuelve un <svg> nuevo con el icono pedido. */
export function icon(name, { size, label } = {}) {
  const shapes = ICONS[name] || ICONS.package;
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.7');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
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
  for (const s of shapes) {
    const el = document.createElementNS(NS, s.t);
    for (const [k, v] of Object.entries(s)) if (k !== 't') el.setAttribute(k, String(v));
    svg.appendChild(el);
  }
  return svg;
}

/** Version rellena de la estrella, para los favoritos activos. */
export function starFilled(size) {
  const svg = icon('star', { size });
  svg.setAttribute('fill', 'currentColor');
  return svg;
}
