/**
 * Utilidades de la agenda de examenes.
 *
 * Modulo puro: ni DOM ni textos. Las fechas se manejan como cadenas
 * «AAAA-MM-DD» mas una hora opcional «HH:MM», para que no se desplacen
 * al cruzar husos.
 */

/** Convierte "2026-03-14" y "09:30" en una fecha local. */
export function aFecha(dia, hora = null) {
  const [a, m, d] = String(dia).split('-').map(Number);
  if (!a || !m || !d) return null;
  const fecha = new Date(a, m - 1, d, 0, 0, 0, 0);
  if (Number.isNaN(fecha.getTime())) return null;
  if (hora) {
    const [hh, mm] = String(hora).split(':').map(Number);
    if (Number.isFinite(hh) && Number.isFinite(mm)) fecha.setHours(hh, mm, 0, 0);
  }
  return fecha;
}

/** "AAAA-MM-DD" de una fecha local. */
export function aDia(fecha) {
  const dos = n => String(n).padStart(2, '0');
  return `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}`;
}

/** Medianoche de hoy: el punto desde el que se cuentan los dias. */
export const hoy = (ahora = new Date()) =>
  new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());

/**
 * Dias que faltan: 0 es hoy, 1 manana, -1 ayer.
 * Se cuenta por dias de calendario, no por horas, para que «manana a las
 * ocho» no salga como «hoy» a las diez de la noche.
 */
export function diasHasta(dia, ahora = new Date()) {
  const objetivo = aFecha(dia);
  if (!objetivo) return null;
  const MS = 24 * 60 * 60 * 1000;
  return Math.round((objetivo - hoy(ahora)) / MS);
}

/** Un examen es valido si tiene fecha y algo que examinar. */
export const valido = examen =>
  Boolean(examen && aFecha(examen.dia) && (examen.titulo?.trim() || examen.asignaturaId));

/** Ordena por fecha y hora; los que no tienen hora van primero ese dia. */
export function ordenar(examenes) {
  return [...examenes].sort((a, b) => {
    if (a.dia !== b.dia) return a.dia < b.dia ? -1 : 1;
    const ha = a.hora || '';
    const hb = b.hora || '';
    if (ha === hb) return 0;
    if (!ha) return -1;
    if (!hb) return 1;
    return ha < hb ? -1 : 1;
  });
}

/** Los que aun no han pasado (hoy incluido), ordenados. */
export function proximos(examenes, ahora = new Date(), limite = Infinity) {
  return ordenar(examenes.filter(e => valido(e) && diasHasta(e.dia, ahora) >= 0)).slice(0, limite);
}

/** Los que ya pasaron, del mas reciente al mas antiguo. */
export function pasados(examenes, ahora = new Date()) {
  return ordenar(examenes.filter(e => valido(e) && diasHasta(e.dia, ahora) < 0)).reverse();
}

/** Agrupa por dia conservando el orden: [{ dia, examenes }]. */
export function porDia(examenes) {
  const mapa = new Map();
  for (const e of ordenar(examenes)) {
    if (!mapa.has(e.dia)) mapa.set(e.dia, []);
    mapa.get(e.dia).push(e);
  }
  return [...mapa].map(([dia, lista]) => ({ dia, examenes: lista }));
}

/** Clave del texto que describe cuanto falta: hoy, manana, enDias o pasado. */
export function cuandoClave(dias) {
  if (dias === null) return null;
  if (dias < 0) return 'pasado';
  if (dias === 0) return 'hoy';
  if (dias === 1) return 'manana';
  return 'enDias';
}

/** Urgencia para el color: 'hoy' | 'pronto' (3 dias o menos) | 'lejos'. */
export function urgencia(dias) {
  if (dias === null || dias < 0) return 'lejos';
  if (dias === 0) return 'hoy';
  if (dias <= 3) return 'pronto';
  return 'lejos';
}
