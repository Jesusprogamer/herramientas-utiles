/**
 * Ultimos errores de JavaScript, solo en memoria.
 *
 * No se guardan en disco ni se envian a ningun sitio: estan aqui para que,
 * si decides informar de un fallo, puedas adjuntarlos. Se queda con el
 * mensaje y el sitio; nunca con contenido tuyo.
 */
const MAX = 10;
const errores = [];
let escuchando = false;

/** Recorta la ruta a lo justo para saber que archivo es. */
function sitio(archivo, linea, columna) {
  if (!archivo) return '';
  let corto = String(archivo);
  try { corto = new URL(archivo).pathname; } catch { /* ya era relativa */ }
  const partes = corto.split('/').filter(Boolean).slice(-2).join('/');
  return `${partes}:${linea ?? '?'}:${columna ?? '?'}`;
}

export function registrar(mensaje, archivo, linea, columna) {
  const texto = String(mensaje ?? '').slice(0, 200);
  if (!texto) return;
  const entrada = { mensaje: texto, sitio: sitio(archivo, linea, columna), cuando: Date.now() };
  // Un mismo error repitiendose no aporta: se cuenta en vez de acumularse.
  const igual = errores.find(e => e.mensaje === entrada.mensaje && e.sitio === entrada.sitio);
  if (igual) { igual.veces = (igual.veces || 1) + 1; igual.cuando = entrada.cuando; return; }
  errores.push(entrada);
  if (errores.length > MAX) errores.shift();
}

export function listar() {
  return errores.map(e => ({ ...e }));
}

export function hayErrores() { return errores.length > 0; }

export function limpiar() { errores.length = 0; }

/** Texto listo para pegar en un informe. */
export function comoTexto() {
  return errores
    .map(e => `- ${e.mensaje}${e.sitio ? ` (${e.sitio})` : ''}${e.veces > 1 ? ` ×${e.veces}` : ''}`)
    .join('\n');
}

export function init() {
  if (escuchando) return;
  escuchando = true;
  window.addEventListener('error', e => registrar(e.message, e.filename, e.lineno, e.colno));
  window.addEventListener('unhandledrejection', e => {
    const motivo = e.reason;
    registrar(motivo?.message || String(motivo), motivo?.fileName, motivo?.lineNumber, motivo?.columnNumber);
  });
}
