/**
 * Construye un archivo de idioma a partir de una lista de valores.
 *
 * La forma la pone locales/es.json: se recorre su arbol y se va poniendo
 * en cada hoja la siguiente linea del archivo de valores, en el mismo
 * orden en que las imprime scripts/build-locale.mjs --claves.
 *
 *   node scripts/build-locale.mjs --claves          (lista las claves)
 *   node scripts/build-locale.mjs --valores [es]    (lista sus textos)
 *   node scripts/build-locale.mjs pt valores.txt    (construye el idioma)
 *
 * En los valores, "\n" (dos caracteres) es un salto de linea de verdad.
 * Si no cuadran las cuentas se para: mas vale eso que un archivo
 * desplazado una linea.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const referencia = JSON.parse(readFileSync(new URL('../locales/es.json', import.meta.url), 'utf8'));

/** Claves «planas» solo para leerlas; la forma real la pone el recorrido. */
function* claves(objeto, prefijo = '') {
  for (const [clave, valor] of Object.entries(objeto)) {
    const completa = prefijo ? `${prefijo}.${clave}` : clave;
    if (Array.isArray(valor)) {
      for (let i = 0; i < valor.length; i++) yield `${completa}[${i}]`;
    } else if (valor && typeof valor === 'object') {
      yield* claves(valor, completa);
    } else {
      yield completa;
    }
  }
}

/** Recorre las hojas de `objeto` en el orden de las claves. */
function rellenarDesde(objeto, visitar) {
  if (Array.isArray(objeto)) { objeto.forEach(x => rellenarDesde(x, visitar)); return; }
  if (objeto && typeof objeto === 'object') {
    for (const valor of Object.values(objeto)) rellenarDesde(valor, visitar);
    return;
  }
  visitar(objeto);
}

/** Copia la forma de `modelo` poniendo en cada hoja el siguiente valor. */
function rellenar(modelo, siguiente) {
  if (Array.isArray(modelo)) return modelo.map(x => rellenar(x, siguiente));
  if (modelo && typeof modelo === 'object') {
    const salida = {};
    for (const [clave, valor] of Object.entries(modelo)) salida[clave] = rellenar(valor, siguiente);
    return salida;
  }
  return siguiente();
}

const listaClaves = [...claves(referencia)];

if (process.argv[2] === '--claves') {
  console.log(listaClaves.join('\n'));
  process.exit(0);
}

/* Los textos de un idioma en el mismo orden que las claves: es el punto
   de partida para traducir, y sirve para comprobar la ida y vuelta. */
if (process.argv[2] === '--valores') {
  const codigo = process.argv[3] || 'es';
  const idioma = JSON.parse(readFileSync(new URL(`../locales/${codigo}.json`, import.meta.url), 'utf8'));
  const textos = [];
  rellenarDesde(idioma, texto => textos.push(String(texto).replace(/\n/g, '\\n')));
  console.log(textos.join('\n'));
  process.exit(0);
}

const [codigo, ruta] = process.argv.slice(2);
if (!codigo || !ruta) {
  console.error('uso: node scripts/build-locale.mjs <codigo> <archivo-de-valores>');
  process.exit(1);
}

const valores = readFileSync(ruta, 'utf8').replace(/\n$/, '').split('\n');
if (listaClaves.length !== valores.length) {
  console.error(`descuadre: ${listaClaves.length} claves y ${valores.length} valores.`);
  const hasta = Math.min(listaClaves.length, valores.length);
  console.error(`la ultima que cuadra es "${listaClaves[hasta - 1]}"`);
  process.exit(1);
}

let i = 0;
const salida = rellenar(referencia, () => valores[i++].replace(/\\n/g, '\n'));

writeFileSync(
  new URL(`../locales/${codigo}.json`, import.meta.url),
  `${JSON.stringify(salida, null, 2)}\n`
);
console.log(`locales/${codigo}.json: ${listaClaves.length} claves`);
