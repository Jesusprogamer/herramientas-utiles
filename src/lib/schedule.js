/**
 * Horario de clase: rejilla de dias y franjas.
 *
 * Modulo puro, sin DOM ni textos. Las horas son cadenas "HH:MM" y los
 * dias, numeros 0-6 al estilo de Date (0 = domingo).
 */

/** Orden de la semana empezando en lunes. */
export const DIAS_SEMANA = [1, 2, 3, 4, 5, 6, 0];

export const MAX_FRANJAS = 16;
export const MAX_CLASES = 200;

const HORA = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const esHora = texto => HORA.test(String(texto ?? ''));

/** "HH:MM" -> minutos desde medianoche, o null. */
export function aMinutos(hora) {
  if (!esHora(hora)) return null;
  const [h, m] = String(hora).split(':').map(Number);
  return h * 60 + m;
}

/** minutos -> "HH:MM", dando la vuelta al pasar de las 24 h. */
export function aHora(minutos) {
  const total = ((Math.round(minutos) % 1440) + 1440) % 1440;
  const dos = n => String(n).padStart(2, '0');
  return `${dos(Math.floor(total / 60))}:${dos(total % 60)}`;
}

/** Duracion de una franja en minutos; null si no se puede calcular. */
export function duracion(franja) {
  const a = aMinutos(franja?.inicio);
  const b = aMinutos(franja?.fin);
  if (a === null || b === null) return null;
  return b > a ? b - a : null;
}

export const franjaValida = franja => duracion(franja) !== null;

/** Ordena las franjas por hora de inicio. */
export function ordenarFranjas(franjas) {
  return [...franjas]
    .filter(franjaValida)
    .sort((a, b) => aMinutos(a.inicio) - aMinutos(b.inicio));
}

/** true si dos franjas se pisan. */
export function sePisan(a, b) {
  const ia = aMinutos(a.inicio); const fa = aMinutos(a.fin);
  const ib = aMinutos(b.inicio); const fb = aMinutos(b.fin);
  if ([ia, fa, ib, fb].some(v => v === null)) return false;
  return ia < fb && ib < fa;
}

/** Pares de franjas que se pisan, para avisar al montar el horario. */
export function solapes(franjas) {
  const orden = ordenarFranjas(franjas);
  const pares = [];
  for (let i = 0; i < orden.length - 1; i++) {
    if (sePisan(orden[i], orden[i + 1])) pares.push([orden[i], orden[i + 1]]);
  }
  return pares;
}

/**
 * Genera franjas seguidas: `cuantas` de `minutos` cada una desde `desde`,
 * con un descanso opcional tras la franja numero `descansoTras`.
 */
export function generarFranjas({ desde = '08:00', minutos = 55, cuantas = 6, descanso = 0, descansoTras = 3 } = {}) {
  const salida = [];
  let actual = aMinutos(desde);
  if (actual === null) return salida;
  for (let i = 0; i < Math.min(cuantas, MAX_FRANJAS); i++) {
    const fin = actual + minutos;
    salida.push({ inicio: aHora(actual), fin: aHora(fin) });
    actual = fin;
    if (descanso > 0 && i + 1 === descansoTras) actual += descanso;
  }
  return salida;
}

/** Clave de una celda del horario. */
export const celda = (dia, franja) => `${dia}:${franja}`;

/**
 * Clases de un dia, ya ordenadas y emparejadas con su franja.
 * `clases` es un objeto { "dia:franja": { asignaturaId, aula } }.
 */
export function clasesDelDia(clases, franjas, dia) {
  return ordenarFranjas(franjas)
    .map((franja, i) => ({ franja, indice: i, clase: clases[celda(dia, i)] || null }))
    .filter(x => x.clase?.asignaturaId);
}

/** Minutos de clase de cada dia, para el resumen. */
export function minutosPorDia(clases, franjas) {
  const salida = new Map();
  for (const dia of DIAS_SEMANA) {
    const total = clasesDelDia(clases, franjas, dia)
      .reduce((s, x) => s + (duracion(x.franja) || 0), 0);
    if (total > 0) salida.set(dia, total);
  }
  return salida;
}

/** Cuantas horas semanales tiene cada asignatura. */
export function minutosPorAsignatura(clases, franjas) {
  const orden = ordenarFranjas(franjas);
  const salida = new Map();
  for (const [clave, clase] of Object.entries(clases)) {
    if (!clase?.asignaturaId) continue;
    const indice = Number(clave.split(':')[1]);
    const mins = duracion(orden[indice]);
    if (!mins) continue;
    salida.set(clase.asignaturaId, (salida.get(clase.asignaturaId) || 0) + mins);
  }
  return salida;
}

/**
 * Que toca ahora y que toca despues, mirando el reloj.
 * Devuelve { ahora, siguiente } con { franja, indice, clase } o null.
 */
export function queToca(clases, franjas, ahora = new Date()) {
  const dia = ahora.getDay();
  const minutos = ahora.getHours() * 60 + ahora.getMinutes();
  const delDia = clasesDelDia(clases, franjas, dia);
  const actual = delDia.find(x => {
    const i = aMinutos(x.franja.inicio);
    const f = aMinutos(x.franja.fin);
    return minutos >= i && minutos < f;
  }) || null;
  const siguiente = delDia.find(x => aMinutos(x.franja.inicio) > minutos) || null;
  return { ahora: actual, siguiente };
}
