/**
 * Generacion de archivos .ics (RFC 5545) para el calendario.
 *
 * Modulo puro y sin textos: el resumen y la descripcion llegan ya
 * traducidos desde fuera. Las horas se escriben en «hora local flotante»
 * (sin zona), que es lo que uno espera de un examen: a las nueve es a las
 * nueve esté donde esté el móvil.
 */

/** Longitud maxima de linea del formato, en octetos. */
const MAX_OCTETOS = 75;

/** Escapa los caracteres con significado propio en un valor de texto. */
export function escapar(texto) {
  return String(texto ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

const octetos = texto => new TextEncoder().encode(texto).length;

/**
 * Parte una linea larga en varias, con un espacio al principio de cada
 * continuacion. Se cuenta en octetos y no se corta un caracter por medio,
 * que es donde fallan las tildes.
 */
export function plegar(linea) {
  if (octetos(linea) <= MAX_OCTETOS) return [linea];
  const salida = [];
  let actual = '';
  let limite = MAX_OCTETOS;
  for (const caracter of linea) {
    if (octetos(actual + caracter) > limite) {
      salida.push(actual);
      actual = ' ';
      limite = MAX_OCTETOS;
    }
    actual += caracter;
  }
  if (actual.trim() !== '') salida.push(actual);
  return salida;
}

const dos = n => String(n).padStart(2, '0');

/** YYYYMMDD a partir de una fecha local. */
export function fechaICS(fecha) {
  return `${fecha.getFullYear()}${dos(fecha.getMonth() + 1)}${dos(fecha.getDate())}`;
}

/** YYYYMMDDTHHMMSS local, sin zona. */
export function fechaHoraICS(fecha) {
  return `${fechaICS(fecha)}T${dos(fecha.getHours())}${dos(fecha.getMinutes())}${dos(fecha.getSeconds())}`;
}

/** YYYYMMDDTHHMMSSZ en UTC, para DTSTAMP. */
export function marcaUTC(fecha) {
  return `${fecha.getUTCFullYear()}${dos(fecha.getUTCMonth() + 1)}${dos(fecha.getUTCDate())}`
    + `T${dos(fecha.getUTCHours())}${dos(fecha.getUTCMinutes())}${dos(fecha.getUTCSeconds())}Z`;
}

/** Suma dias a una fecha sin tocar la original. */
export function masDias(fecha, dias) {
  const copia = new Date(fecha);
  copia.setDate(copia.getDate() + dias);
  return copia;
}

/**
 * Un evento.
 *
 * { uid, inicio: Date, fin?: Date, todoElDia?, resumen, descripcion?,
 *   lugar?, avisoMinutos?, creado? }
 */
export function evento(datos, { creado = new Date() } = {}) {
  const lineas = ['BEGIN:VEVENT', `UID:${escapar(datos.uid)}`, `DTSTAMP:${marcaUTC(creado)}`];

  if (datos.todoElDia) {
    lineas.push(`DTSTART;VALUE=DATE:${fechaICS(datos.inicio)}`);
    // DTEND es exclusivo: para un dia entero, el dia siguiente
    lineas.push(`DTEND;VALUE=DATE:${fechaICS(masDias(datos.fin || datos.inicio, 1))}`);
  } else {
    lineas.push(`DTSTART:${fechaHoraICS(datos.inicio)}`);
    lineas.push(`DTEND:${fechaHoraICS(datos.fin || new Date(datos.inicio.getTime() + 60 * 60 * 1000))}`);
  }

  lineas.push(`SUMMARY:${escapar(datos.resumen)}`);
  if (datos.descripcion) lineas.push(`DESCRIPTION:${escapar(datos.descripcion)}`);
  if (datos.lugar) lineas.push(`LOCATION:${escapar(datos.lugar)}`);

  if (Number.isFinite(datos.avisoMinutos) && datos.avisoMinutos > 0) {
    lineas.push(
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${escapar(datos.resumen)}`,
      `TRIGGER:-PT${Math.round(datos.avisoMinutos)}M`,
      'END:VALARM'
    );
  }

  lineas.push('END:VEVENT');
  return lineas;
}

/**
 * Calendario completo. Devuelve el texto listo para descargar, con
 * finales de linea CRLF como manda el formato.
 */
export function calendario(eventos, { nombre = 'A mano', creado = new Date() } = {}) {
  const lineas = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//A mano//Agenda//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapar(nombre)}`,
    ...eventos.flatMap(e => evento(e, { creado })),
    'END:VCALENDAR'
  ];
  return `${lineas.flatMap(plegar).join('\r\n')}\r\n`;
}
