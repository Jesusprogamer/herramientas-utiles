/**
 * Genera src/data/elements.js a partir de los datos de PubChem.
 *
 * No se ejecuta en la app: se usa a mano cuando hay que regenerar la tabla.
 * La procedencia y las comprobaciones estan en docs/fuentes-datos.md.
 *
 *   node scripts/build-elements.mjs <ruta-a-pub.json>
 */
import { readFileSync, writeFileSync } from 'node:fs';

const origen = process.argv[2];
if (!origen) {
  console.error('uso: node scripts/build-elements.mjs <pub.json>');
  process.exit(1);
}
const datos = JSON.parse(readFileSync(origen, 'utf8'));

/** Grupo (columna) de cada numero atomico. Los lantanidos y actinidos no tienen. */
function grupo(z) {
  if ([1, 3, 11, 19, 37, 55, 87].includes(z)) return 1;
  if ([4, 12, 20, 38, 56, 88].includes(z)) return 2;
  if (z === 2) return 18;
  if (z >= 5 && z <= 10) return z + 8;
  if (z >= 13 && z <= 18) return z;
  if (z >= 21 && z <= 36) return z - 18;
  if (z >= 39 && z <= 54) return z - 36;
  if (z >= 57 && z <= 71) return null;      // lantanidos
  if (z >= 72 && z <= 86) return z - 68;
  if (z >= 89 && z <= 103) return null;     // actinidos
  if (z >= 104 && z <= 118) return z - 100;
  return null;
}

function periodo(z) {
  if (z <= 2) return 1;
  if (z <= 10) return 2;
  if (z <= 18) return 3;
  if (z <= 36) return 4;
  if (z <= 54) return 5;
  if (z <= 86) return 6;
  return 7;
}

const CATEGORIAS = {
  'Alkali metal': 'alcalino',
  'Alkaline earth metal': 'alcalinoterreo',
  'Transition metal': 'transicion',
  'Post-transition metal': 'postTransicion',
  Metalloid: 'metaloide',
  Nonmetal: 'noMetal',
  Halogen: 'halogeno',
  'Noble gas': 'nobleGas',
  Lanthanide: 'lantanido',
  Actinide: 'actinido'
};

const ESTADOS = { Gas: 'gas', Liquid: 'liquido', Solid: 'solido', Expected: 'previsto' };

/**
 * Correcciones sobre el origen, documentadas en docs/fuentes-datos.md.
 * Cada una dice por que se aparta de PubChem.
 */
const CORRECCIONES = {
  // PubChem redondea el litio a 7; el valor convencional de la IUPAC (2021) es 6.94.
  3: { mass: 6.94 }
};

const limpio = v => (v === null || v === undefined || v === '' ? null : v);

const salida = datos.map(e => {
  const z = e.AtomicNumber;
  const base = {
    z,
    symbol: e.Symbol,
    group: grupo(z),
    period: periodo(z),
    category: CATEGORIAS[e.GroupBlock] || 'noMetal',
    mass: limpio(e.AtomicMass),
    config: String(e.ElectronConfiguration).replace(/\s*\((calculated|predicted)\)\s*/i, ''),
    predicha: /\((calculated|predicted)\)/i.test(e.ElectronConfiguration),
    electronegativity: limpio(e.Electronegativity),
    ionization: limpio(e.IonizationEnergy),
    affinity: limpio(e.ElectronAffinity),
    radius: limpio(e.AtomicRadius),
    melting: limpio(e.MeltingPoint),
    boiling: limpio(e.BoilingPoint),
    density: limpio(e.Density),
    oxidation: Array.isArray(e.OxidationStates) ? e.OxidationStates : [],
    state: ESTADOS[e.StandardState] || 'previsto',
    year: typeof e.YearDiscovered === 'number' ? e.YearDiscovered : null,
    cpk: e.CPKHexColor ? `#${e.CPKHexColor}` : null
  };
  return { ...base, ...(CORRECCIONES[z] || {}) };
});

const cabecera = `/**
 * Tabla periodica: 118 elementos.
 *
 * ARCHIVO GENERADO por scripts/build-elements.mjs. No se edita a mano.
 * Origen, licencia y comprobaciones: docs/fuentes-datos.md
 *
 * Los nombres de los elementos NO estan aqui: viven en locales/*.json
 * bajo elementos.<simbolo>, como el resto de los textos.
 *
 * Unidades: mass u | ionization eV | affinity eV | radius pm (van der Waals)
 *           melting/boiling K | density g/cm3
 */
export const ELEMENTS = Object.freeze(`;

writeFileSync(
  new URL('../src/data/elements.js', import.meta.url),
  // Un elemento por linea: se lee bien en un diff y pesa la mitad que
  // el JSON con sangria.
  `${cabecera}[\n${salida.map(e => `  ${JSON.stringify(e)}`).join(',\n')}\n]);\n\nexport const byZ = z => ELEMENTS[z - 1] || null;\nexport const bySymbol = s =>\n  ELEMENTS.find(e => e.symbol.toLowerCase() === String(s).toLowerCase()) || null;\n`
);

console.log(`${salida.length} elementos escritos`);
