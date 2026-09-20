/**
 * Sesion de test: barajado, avance y puntuacion.
 *
 * Modulo puro. El azar entra por parametro (`aleatorio`) para que las
 * pruebas puedan fijarlo, y el reloj tambien (`ahora`).
 */

/** Fisher-Yates con el azar que se le pase. */
export function barajar(lista, aleatorio = Math.random) {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(aleatorio() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

/** Toma `n` al azar sin repetir. */
export function tomar(lista, n, aleatorio = Math.random) {
  if (!Number.isFinite(n) || n <= 0) return barajar(lista, aleatorio);
  return barajar(lista, aleatorio).slice(0, n);
}

/**
 * Opciones multiples: la correcta mas `n-1` señuelos sacados del resto.
 * Nunca se repite una opcion ni falta la correcta.
 */
export function opciones(correcta, candidatos, n = 4, aleatorio = Math.random) {
  const otros = [...new Set(candidatos.map(String))].filter(x => x !== String(correcta));
  const senuelos = barajar(otros, aleatorio).slice(0, Math.max(0, n - 1));
  return barajar([String(correcta), ...senuelos], aleatorio);
}

/** Arranca una sesion sobre una lista de preguntas ya generadas. */
export function crear(preguntas, { ahora = Date.now() } = {}) {
  return {
    preguntas,
    indice: 0,
    respuestas: [],          // { pregunta, dada, acierto, saltada, ms }
    empezada: ahora,
    inicioPregunta: ahora,
    terminada: false
  };
}

export const actual = sesion => sesion.preguntas[sesion.indice] || null;

/**
 * Anota una respuesta y pasa a la siguiente.
 * `saltada` cuenta como fallo: saltar no es no contestar.
 */
export function responder(sesion, { dada, acierto, saltada = false, ahora = Date.now() }) {
  const pregunta = actual(sesion);
  if (!pregunta || sesion.terminada) return sesion;

  const respuestas = [...sesion.respuestas, {
    pregunta,
    dada: String(dada ?? ''),
    acierto: saltada ? false : acierto === true,
    saltada,
    ms: Math.max(0, ahora - sesion.inicioPregunta)
  }];
  const indice = sesion.indice + 1;
  return {
    ...sesion,
    respuestas,
    indice,
    inicioPregunta: ahora,
    terminada: indice >= sesion.preguntas.length
  };
}

/** Resumen final: aciertos, fallos, porcentaje y tiempo medio. */
export function resultado(sesion) {
  const total = sesion.respuestas.length;
  const aciertos = sesion.respuestas.filter(r => r.acierto).length;
  const fallos = sesion.respuestas.filter(r => !r.acierto);
  const ms = sesion.respuestas.reduce((s, r) => s + r.ms, 0);
  return {
    total,
    aciertos,
    fallos: fallos.length,
    saltadas: sesion.respuestas.filter(r => r.saltada).length,
    porcentaje: total ? Math.round((aciertos / total) * 100) : 0,
    mediaMs: total ? Math.round(ms / total) : 0,
    listaFallos: fallos
  };
}

/** Las preguntas falladas, para repasar solo esas. */
export const soloFallos = sesion => sesion.respuestas.filter(r => !r.acierto).map(r => r.pregunta);

/**
 * Lo que mas se falla, por tipo de pregunta y por elemento o formula.
 * Devuelve las listas ordenadas de mas fallos a menos.
 */
export function puntosFlacos(historial) {
  const porTipo = new Map();
  const porTema = new Map();
  for (const sesion of historial) {
    for (const fallo of sesion.fallos || []) {
      porTipo.set(fallo.tipo, (porTipo.get(fallo.tipo) || 0) + 1);
      if (fallo.tema) porTema.set(fallo.tema, (porTema.get(fallo.tema) || 0) + 1);
    }
  }
  const ordenar = mapa => [...mapa]
    .map(([clave, veces]) => ({ clave, veces }))
    .sort((a, b) => b.veces - a.veces);
  return { porTipo: ordenar(porTipo), porTema: ordenar(porTema) };
}

export const MAX_HISTORIAL = 50;

/** Anade una sesion al historial, quedandose con las ultimas 50. */
export function alHistorial(historial, entrada) {
  return [entrada, ...(Array.isArray(historial) ? historial : [])].slice(0, MAX_HISTORIAL);
}
