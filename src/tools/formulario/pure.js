/**
 * Parte del formulario que no toca el DOM, para poder probarla sin navegador.
 */
import { sinTildes } from '../../lib/elementos.js';

/** Formulas que encajan con la busqueda: nombre, variable o la propia formula. */
export function filtrar(lista, consulta, grupo, nombreDe) {
  const q = sinTildes(consulta).trim();
  return lista.filter(f => {
    if (grupo !== 'todos' && f.grupo !== grupo) return false;
    if (!q) return true;
    return sinTildes(nombreDe(f)).includes(q)
      || sinTildes(f.expr).includes(q)
      || f.vars.some(v => sinTildes(v.n) === q);
  });
}
