/**
 * Buscar una clave de idioma dentro del diccionario.
 *
 * El punto separa niveles, pero hay claves que lo llevan dentro: en
 * "calc.paso" conviven "expr" y "lineal.inicio". En cada nivel se prueba
 * primero lo que queda del camino entero y solo despues se baja un nivel,
 * asi da igual como esten agrupadas en el archivo.
 *
 * Modulo puro y compartido: lo usan la app (src/core/i18n.js) y el
 * comprobador (scripts/check-locales.js), para que los dos busquen igual.
 */
export function lookup(dict, key) {
  let node = dict;
  const partes = String(key).split('.');
  for (let i = 0; i < partes.length; i++) {
    if (node === null || typeof node !== 'object') return undefined;
    const resto = partes.slice(i).join('.');
    if (resto in node && typeof node[resto] === 'string') return node[resto];
    if (!(partes[i] in node)) return undefined;
    node = node[partes[i]];
  }
  return typeof node === 'string' ? node : undefined;
}
