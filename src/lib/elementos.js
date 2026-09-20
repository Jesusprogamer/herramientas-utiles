/**
 * Busqueda y escalas de la tabla periodica.
 *
 * Aparte de la herramienta para poder probarlo sin navegador: aqui no se
 * toca el DOM. Los nombres llegan de fuera (`nombreDe`) porque viven en los
 * archivos de idioma, no en los datos.
 */

/** Normaliza para buscar sin tildes ni mayusculas. */
export const sinTildes = texto =>
  String(texto).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Elementos que encajan con la busqueda, de la coincidencia mas exacta a la
 * mas floja. Asi «oro» abre el oro aunque «boro» y «cloro» tambien lo lleven.
 */
export function buscar(lista, consulta, nombreDe) {
  const q = sinTildes(consulta).trim();
  if (!q) return lista;
  if (/^\d+$/.test(q)) return lista.filter(e => String(e.z) === q);

  const puntos = e => {
    const sim = sinTildes(e.symbol);
    const nom = sinTildes(nombreDe(e));
    if (nom === q) return 0;
    if (sim === q) return 1;
    if (nom.startsWith(q)) return 2;
    if (sim.startsWith(q)) return 3;
    if (nom.includes(q)) return 4;
    return null;
  };

  return lista
    .map(e => ({ e, p: puntos(e) }))
    .filter(x => x.p !== null)
    .sort((a, b) => a.p - b.p || a.e.z - b.e.z)
    .map(x => x.e);
}

/** El elemento que la busqueda senala sin ambiguedad, o null. */
export function coincidenciaExacta(encontrados, consulta, nombreDe) {
  if (!encontrados.length) return null;
  const q = sinTildes(consulta).trim();
  if (!q) return null;
  const primero = encontrados[0];
  const exacto = /^\d+$/.test(q)
    ? String(primero.z) === q
    : sinTildes(nombreDe(primero)) === q || sinTildes(primero.symbol) === q;
  return exacto || encontrados.length === 1 ? primero : null;
}

/** Posicion en una escala 0..1, o null si falta el dato. */
export function escala(valor, min, max) {
  if (valor === null || valor === undefined) return null;
  if (max === min) return 0.5;
  return Math.min(Math.max((valor - min) / (max - min), 0), 1);
}

/** Minimo y maximo de un campo, ignorando los elementos sin dato. */
export function rango(lista, campo) {
  const valores = lista.map(e => e[campo]).filter(v => v !== null && v !== undefined);
  return [Math.min(...valores), Math.max(...valores)];
}
