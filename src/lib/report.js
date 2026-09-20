/**
 * Armado del informe de error o sugerencia.
 *
 * Modulo puro: recibe los datos ya recogidos y devuelve texto. No mira el
 * navegador ni el almacenamiento, asi que se puede probar sin navegador.
 *
 * Privacidad: aqui NUNCA entra contenido de notas, tareas, cuentas ni
 * nada escrito por la persona salvo su propia descripcion del problema.
 */

/** Nombre y version del navegador a partir del user agent. */
export function navegador(ua = '') {
  const pruebas = [
    [/Edg\/([\d.]+)/, 'Edge'],
    [/OPR\/([\d.]+)/, 'Opera'],
    [/SamsungBrowser\/([\d.]+)/, 'Samsung Internet'],
    [/Firefox\/([\d.]+)/, 'Firefox'],
    [/CriOS\/([\d.]+)/, 'Chrome'],
    [/Chrome\/([\d.]+)/, 'Chrome'],
    [/Version\/([\d.]+).*Safari/, 'Safari']
  ];
  for (const [re, nombre] of pruebas) {
    const m = ua.match(re);
    if (m) return `${nombre} ${m[1].split('.')[0]}`;
  }
  return 'desconocido';
}

/** Sistema operativo, sin mas detalle del necesario. */
export function sistema(ua = '') {
  if (/iPhone|iPad|iPod/.test(ua)) return 'iOS';
  if (/Android/.test(ua)) return 'Android';
  if (/Mac OS X/.test(ua)) return 'macOS';
  if (/Windows/.test(ua)) return 'Windows';
  if (/Linux/.test(ua)) return 'Linux';
  return 'desconocido';
}

/** Pantalla pequena o grande, que es lo que importa para reproducir. */
export const formato = ancho => (ancho < 768 ? 'movil' : 'escritorio');

/**
 * Cuerpo del aviso, en Markdown.
 * `etiquetas` trae los rotulos ya traducidos, para que el informe se lea
 * en el idioma de quien lo escribe.
 */
export function cuerpo({ descripcion, datos, errores = '', etiquetas }) {
  const filas = [
    [etiquetas.version, datos.version],
    [etiquetas.herramienta, datos.herramienta],
    [etiquetas.idiomaApp, datos.idiomaApp],
    [etiquetas.idiomaNavegador, datos.idiomaNavegador],
    [etiquetas.tema, `${datos.tema} · ${datos.acento}`],
    [etiquetas.navegador, datos.navegador],
    [etiquetas.sistema, datos.sistema],
    [etiquetas.formato, datos.formato],
    [etiquetas.pantalla, datos.pantalla],
    [etiquetas.instalada, datos.instalada],
    [etiquetas.conexion, datos.conexion]
  ];

  const partes = [
    `## ${etiquetas.quePasa}`,
    descripcion.trim() || `_${etiquetas.sinDescripcion}_`,
    '',
    `## ${etiquetas.entorno}`,
    ...filas.map(([k, v]) => `- **${k}:** ${v}`)
  ];

  if (errores.trim()) {
    partes.push('', `## ${etiquetas.errores}`, errores.trim());
  }
  return partes.join('\n');
}

/** Titulo del aviso, con su prefijo y recortado a lo que GitHub admite. */
export function titulo(prefijo, descripcion) {
  const limpio = String(descripcion ?? '').replace(/\s+/g, ' ').trim();
  const resumen = limpio.split(/[.\n]/)[0].slice(0, 70) || '';
  return `${prefijo} ${resumen}`.trim();
}
