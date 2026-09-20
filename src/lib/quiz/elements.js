/**
 * Preguntas del modo test de la tabla periodica.
 *
 * Modulo puro: recibe los elementos y los nombres ya traducidos, y devuelve
 * preguntas. No mira el DOM ni el almacenamiento.
 *
 * Sobre las valencias: los estados de oxidacion salen de PubChem, que
 * publica los habituales de cada elemento (ver docs/fuentes-datos.md). No
 * tenemos una separacion fiable entre «habituales» y «poco habituales»,
 * asi que no nos la inventamos: la politica global se aplica sobre lo que
 * hay, y quien quiera afinar lo hace elemento a elemento desde la
 * personalizacion. Los elementos sin datos quedan fuera de esas preguntas.
 */

export const TIPOS = [
  'simbolo', 'nombre', 'z', 'masa', 'grupo', 'periodo',
  'categoria', 'estado', 'config', 'electroneg', 'valencias'
];

/** El dato que pide cada tipo; si falta, ese elemento no se pregunta. */
const DATO = {
  simbolo: e => e.symbol,
  nombre: e => e.symbol,
  z: e => e.z,
  masa: e => e.mass,
  grupo: e => e.group,
  periodo: e => e.period,
  categoria: e => e.category,
  estado: e => e.state,
  config: e => e.config,
  electroneg: e => e.electronegativity,
  valencias: e => (e.oxidation?.length ? e.oxidation : null)
};

export const tieneDato = (elemento, tipo) => {
  const v = DATO[tipo]?.(elemento);
  return v !== null && v !== undefined && v !== '';
};

/** Elementos sin estados de oxidacion: se excluyen y se pueden listar. */
export const sinValencias = elementos => elementos.filter(e => !e.oxidation?.length);

/**
 * Filtra por lo que se haya elegido.
 * { categorias, grupos, periodos, zDesde, zHasta, favoritos }
 */
export function filtrar(elementos, filtros = {}) {
  const { categorias, grupos, periodos, zDesde, zHasta, favoritos } = filtros;
  return elementos.filter(e => {
    if (categorias?.length && !categorias.includes(e.category)) return false;
    if (grupos?.length && !grupos.includes(e.group)) return false;
    if (periodos?.length && !periodos.includes(e.period)) return false;
    if (Number.isFinite(zDesde) && e.z < zDesde) return false;
    if (Number.isFinite(zHasta) && e.z > zHasta) return false;
    if (favoritos?.length && !favoritos.includes(e.symbol)) return false;
    return true;
  });
}

/**
 * Valencias que cuentan como acierto para un elemento.
 * `porElemento` es la personalizacion: { Fe: [2, 3] }. Si la hay, manda.
 */
export function valenciasAceptadas(elemento, { porElemento = {} } = {}) {
  const propias = porElemento[elemento.symbol];
  if (Array.isArray(propias)) return propias.filter(Number.isFinite);
  return (elemento.oxidation || []).filter(Number.isFinite);
}

/**
 * Genera una pregunta. `nombreDe` traduce el simbolo a nombre; `etiquetaDe`
 * traduce categorias y estados. `formato` es 'escribir' u 'opciones'.
 */
export function pregunta(elemento, tipo, { nombreDe, etiquetaDe, formato = 'escribir', config = {} } = {}) {
  const base = { id: `${elemento.symbol}:${tipo}`, tipo, tema: elemento.symbol, z: elemento.z, formato };

  switch (tipo) {
    case 'simbolo':
      return { ...base, enunciado: nombreDe(elemento), respuesta: elemento.symbol, clase: 'texto' };
    case 'nombre':
      return { ...base, enunciado: elemento.symbol, respuesta: nombreDe(elemento), clase: 'texto' };
    case 'z':
      return { ...base, enunciado: nombreDe(elemento), respuesta: String(elemento.z), clase: 'numero' };
    case 'masa':
      return { ...base, enunciado: nombreDe(elemento), respuesta: elemento.mass, clase: 'numero' };
    case 'grupo':
      return { ...base, enunciado: nombreDe(elemento), respuesta: String(elemento.group), clase: 'numero' };
    case 'periodo':
      return { ...base, enunciado: nombreDe(elemento), respuesta: String(elemento.period), clase: 'numero' };
    case 'categoria':
      return { ...base, enunciado: nombreDe(elemento), respuesta: etiquetaDe('cat', elemento.category), clase: 'texto', formato: 'opciones' };
    case 'estado':
      return { ...base, enunciado: nombreDe(elemento), respuesta: etiquetaDe('estado', elemento.state), clase: 'texto', formato: 'opciones' };
    case 'config':
      return {
        ...base,
        enunciado: nombreDe(elemento),
        respuesta: elemento.config,
        formas: { completa: elemento.config, abreviada: elemento.config },
        clase: 'config'
      };
    case 'electroneg':
      return { ...base, enunciado: nombreDe(elemento), respuesta: elemento.electronegativity, clase: 'numero' };
    case 'valencias':
      return {
        ...base,
        enunciado: nombreDe(elemento),
        respuesta: valenciasAceptadas(elemento, config),
        clase: 'valencias'
      };
    default:
      return null;
  }
}

/**
 * Genera la tanda entera: por cada elemento que pase el filtro, una
 * pregunta de cada tipo activo, quitando las que no tengan dato.
 */
export function generar(elementos, { tipos = TIPOS, filtros = {}, ...resto } = {}) {
  const activos = tipos.filter(x => TIPOS.includes(x));
  const candidatos = filtrar(elementos, filtros);
  const salida = [];
  for (const elemento of candidatos) {
    for (const tipo of activos) {
      if (!tieneDato(elemento, tipo)) continue;
      const p = pregunta(elemento, tipo, resto);
      if (p) salida.push(p);
    }
  }
  return salida;
}
