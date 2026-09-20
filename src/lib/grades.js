/**
 * Calculo de notas: media ponderada y «que me hace falta».
 *
 * Modulo puro, sin DOM y sin textos: los avisos salen como claves para
 * que los traduzcan los archivos de idioma.
 */

/** Redondeo a `decimales` sin arrastrar los errores de la coma flotante. */
export function redondear(valor, decimales = 2) {
  const f = 10 ** decimales;
  return Math.round((valor + Number.EPSILON) * f) / f;
}

/** Una nota cuenta si tiene valor numerico y peso mayor que cero. */
export const cuenta = nota =>
  Number.isFinite(nota?.valor) && Number.isFinite(nota?.peso) && nota.peso > 0;

/** Suma de los pesos de las notas ya puestas. */
export function pesoHecho(notas) {
  return notas.filter(cuenta).reduce((suma, n) => suma + n.peso, 0);
}

/** Suma de los pesos declarados, incluidas las notas aun sin poner. */
export function pesoTotal(notas) {
  return notas.reduce((suma, n) => suma + (Number.isFinite(n?.peso) ? Math.max(n.peso, 0) : 0), 0);
}

/**
 * Media ponderada de lo ya evaluado.
 * Devuelve null si todavia no hay ninguna nota que cuente.
 */
export function media(notas) {
  const puestas = notas.filter(cuenta);
  if (!puestas.length) return null;
  const peso = puestas.reduce((s, n) => s + n.peso, 0);
  if (peso <= 0) return null;
  const suma = puestas.reduce((s, n) => s + n.valor * n.peso, 0);
  return redondear(suma / peso, 4);
}

/**
 * Nota del curso contando lo que falta como un cero: sirve para saber
 * «como voy» sin engañarse con una media de dos examenes sueltos.
 */
export function notaAcumulada(notas, total = 100) {
  const suma = notas.filter(cuenta).reduce((s, n) => s + n.valor * n.peso, 0);
  if (total <= 0) return null;
  return redondear(suma / total, 4);
}

/**
 * Que nota media hace falta en lo que queda para llegar a `objetivo`.
 *
 * Devuelve:
 *   { estado: 'conseguido' }                     ya llega aunque saque 0
 *   { estado: 'imposible', necesaria }           ni con el maximo llega
 *   { estado: 'nadaPendiente' }                  no queda nada por evaluar
 *   { estado: 'necesitas', necesaria, holgada }  la nota que hace falta
 */
export function notaNecesaria(notas, objetivo, { total = 100, maximo = 10 } = {}) {
  const hecho = pesoHecho(notas);
  const pendiente = redondear(total - hecho, 6);
  const conseguido = notas.filter(cuenta).reduce((s, n) => s + n.valor * n.peso, 0);
  const faltan = objetivo * total - conseguido;

  if (pendiente <= 0) return { estado: 'nadaPendiente' };
  if (faltan <= 0) return { estado: 'conseguido' };

  const necesaria = redondear(faltan / pendiente, 2);
  if (necesaria > maximo) return { estado: 'imposible', necesaria };
  // «holgada» = llega con la mitad de la nota maxima o menos
  return { estado: 'necesitas', necesaria, holgada: necesaria <= maximo * 0.5 };
}

/**
 * Comprobacion de los pesos: la interfaz avisa cuando no suman el total.
 * { suma, estado: 'exacto' | 'falta' | 'pasa', diferencia }
 */
export function revisarPesos(notas, total = 100) {
  const suma = redondear(pesoTotal(notas), 4);
  const diferencia = redondear(suma - total, 4);
  if (Math.abs(diferencia) < 0.005) return { suma, estado: 'exacto', diferencia: 0 };
  return { suma, estado: diferencia < 0 ? 'falta' : 'pasa', diferencia };
}

/** Resumen de una asignatura, listo para pintar. */
export function resumen(notas, { objetivo = 5, total = 100, maximo = 10 } = {}) {
  return {
    media: media(notas),
    acumulada: notaAcumulada(notas, total),
    pesoHecho: redondear(pesoHecho(notas), 4),
    pesoPendiente: redondear(Math.max(total - pesoHecho(notas), 0), 4),
    pesos: revisarPesos(notas, total),
    objetivo: notaNecesaria(notas, objetivo, { total, maximo }),
    aprobada: media(notas) !== null && media(notas) >= objetivo
  };
}

/** Media de las medias de varias asignaturas, cada una con su peso opcional. */
export function mediaGeneral(asignaturas) {
  const validas = asignaturas
    .map(a => ({ valor: media(a.notas), peso: Number.isFinite(a.peso) && a.peso > 0 ? a.peso : 1 }))
    .filter(a => a.valor !== null);
  if (!validas.length) return null;
  const peso = validas.reduce((s, a) => s + a.peso, 0);
  return redondear(validas.reduce((s, a) => s + a.valor * a.peso, 0) / peso, 4);
}
