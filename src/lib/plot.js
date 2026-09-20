/**
 * Utilidades puras para dibujar funciones.
 *
 * Están aparte de la herramienta para poder probarlas sin navegador:
 * aquí no se toca el DOM ni se usa eval.
 */
import { evaluate } from './expr.js';

/**
 * Devuelve un paso de rejilla «redondo» (1, 2, 5, 10, 20, 50…) de forma que
 * en `span` quepan aproximadamente `objetivo` divisiones.
 */
export function pasoRejilla(span, objetivo = 8) {
  if (!Number.isFinite(span) || span <= 0 || objetivo <= 0) return 1;
  const crudo = span / objetivo;
  const exp = Math.floor(Math.log10(crudo));
  const base = Math.pow(10, exp);
  for (const m of [1, 2, 5, 10]) {
    if (crudo <= m * base) return m * base;
  }
  return 10 * base;
}

/**
 * Muestrea `nodo` en `puntos` columnas entre x0 y x1.
 * Donde la función no existe (1/0, log(-1)…) devuelve y = NaN, para que
 * el trazo se corte en vez de inventar una línea.
 */
export function muestrear(nodo, x0, x1, puntos) {
  const total = Math.max(2, Math.round(puntos));
  const salida = new Array(total);
  const paso = (x1 - x0) / (total - 1);
  for (let i = 0; i < total; i++) {
    const x = x0 + i * paso;
    let y;
    try {
      y = evaluate(nodo, { vars: { x } });
    } catch {
      y = NaN;
    }
    salida[i] = { x, y: Number.isFinite(y) ? y : NaN };
  }
  return salida;
}

/** Mínimo y máximo de lo que se ve, con margen; null si no hay nada finito. */
export function rangoVisible(muestras, margen = 0.1) {
  const ys = muestras.map(p => p.y).filter(Number.isFinite);
  if (!ys.length) return null;
  let min = Math.min(...ys);
  let max = Math.max(...ys);
  if (max - min < 1e-9) { min -= 1; max += 1; }
  const m = (max - min) * margen;
  return { y0: min - m, y1: max + m };
}
