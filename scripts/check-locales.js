/**
 * Comprueba que todos los archivos de idioma tengan exactamente las mismas
 * claves, con la misma forma y los mismos marcadores.
 *
 *   node scripts/check-locales.js          -> falla si hay algun descuadre
 *   node scripts/check-locales.js --quiet  -> solo el resumen
 *
 * El idioma de referencia es el español: es el respaldo que usa la app
 * cuando a otro idioma le falta una clave, asi que tiene que estar completo.
 *
 * Tambien se usa desde tests/locales.test.js.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { lookup as resolve } from '../src/lib/lookup.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const LOCALES_DIR = path.resolve(HERE, '..', 'locales');
export const REFERENCE = 'es';

/** Aplana un diccionario a { 'a.b.c': valor }. Las listas se tratan aparte. */
export function flatten(node, prefix = '', out = {}) {
  for (const [key, value] of Object.entries(node)) {
    const full = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) flatten(value, full, out);
    else out[full] = value;
  }
  return out;
}

/** Marcadores de sustitucion: {n}, {name}… Si no coinciden, el texto se rompe. */
export function placeholders(value) {
  const found = new Set();
  const scan = text => {
    for (const match of String(text).matchAll(/\{(\w+)\}/g)) found.add(match[1]);
  };
  if (Array.isArray(value)) value.forEach(scan);
  else scan(value);
  return found;
}

/**
 * Claves que el codigo pide con un texto literal: t('algo.asi').
 * Las que se arman sobre la marcha (`quiz.tipo.${tipo}`) no se pueden ver
 * desde aqui, asi que esas quedan para las pruebas del navegador.
 */
export { resolve };

export function usedKeys(dir = path.resolve(HERE, '..', 'src')) {
  const out = new Map();   // clave -> primer archivo donde sale
  const walk = folder => {
    for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
      const full = path.join(folder, entry.name);
      if (entry.isDirectory()) { walk(full); continue; }
      if (!entry.name.endsWith('.js')) continue;
      // Los comentarios llevan ejemplos: t('home.count'). No cuentan.
      const code = fs.readFileSync(full, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, ' ')
        .replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
      const rel = path.relative(path.resolve(HERE, '..'), full);
      for (const m of code.matchAll(/\btn?\(\s*'([a-zA-Z][\w.]*)'/g)) {
        const plural = m[0].startsWith('tn');
        const claves = plural ? [`${m[1]}.one`, `${m[1]}.other`] : [m[1]];
        for (const c of claves) if (!out.has(c)) out.set(c, rel);
      }
    }
  };
  walk(dir);
  return out;
}

export function listLocales() {
  return fs.readdirSync(LOCALES_DIR)
    .filter(name => name.endsWith('.json'))
    .map(name => name.replace(/\.json$/, ''))
    .sort();
}

export function readLocale(code) {
  return JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, `${code}.json`), 'utf8'));
}

const shapeOf = value => (Array.isArray(value) ? 'lista' : typeof value);

/**
 * Compara un idioma con el de referencia.
 * Devuelve { code, problems: [{ tipo, clave, detalle }] }.
 */
export function compareLocale(code, reference) {
  const target = flatten(readLocale(code));
  const problems = [];

  for (const [key, refValue] of Object.entries(reference)) {
    if (!(key in target)) {
      problems.push({ tipo: 'falta', clave: key, detalle: 'no existe en este idioma' });
      continue;
    }
    const value = target[key];

    if (shapeOf(value) !== shapeOf(refValue)) {
      problems.push({ tipo: 'forma', clave: key, detalle: `es ${shapeOf(value)} y deberia ser ${shapeOf(refValue)}` });
      continue;
    }
    if (Array.isArray(refValue) && value.length !== refValue.length) {
      problems.push({ tipo: 'lista', clave: key, detalle: `tiene ${value.length} elementos y la referencia ${refValue.length}` });
    }
    if (typeof value === 'string' && !value.trim()) {
      problems.push({ tipo: 'vacia', clave: key, detalle: 'el texto esta vacio' });
    }

    const refMarks = placeholders(refValue);
    const marks = placeholders(value);
    const missing = [...refMarks].filter(m => !marks.has(m));
    const extra = [...marks].filter(m => !refMarks.has(m));
    if (missing.length) {
      problems.push({ tipo: 'marcador', clave: key, detalle: `le falta {${missing.join('}, {')}}` });
    }
    if (extra.length) {
      problems.push({ tipo: 'marcador', clave: key, detalle: `sobra {${extra.join('}, {')}}` });
    }
  }

  for (const key of Object.keys(target)) {
    if (!(key in reference)) {
      problems.push({ tipo: 'sobra', clave: key, detalle: 'no existe en el idioma de referencia' });
    }
  }

  return { code, problems };
}

/** Revisa todos los idiomas. Devuelve { reference, total, results }. */
export function checkAll() {
  const codes = listLocales();
  if (!codes.includes(REFERENCE)) {
    throw new Error(`Falta el idioma de referencia locales/${REFERENCE}.json`);
  }
  const refDict = readLocale(REFERENCE);
  const reference = flatten(refDict);
  const results = codes
    .filter(code => code !== REFERENCE)
    .map(code => compareLocale(code, reference));

  /* Claves que el codigo pide y el idioma de referencia no sabe dar. Es el
     fallo que mas se cuela: pedir "algo.desc" cuando solo existe "algo". */
  const huerfanas = [];
  for (const [key, file] of usedKeys()) {
    if (resolve(refDict, key) === undefined) {
      huerfanas.push({ tipo: 'codigo', clave: key, detalle: `la pide ${file} y no existe en ${REFERENCE}` });
    }
  }
  if (huerfanas.length) results.push({ code: `${REFERENCE} (uso en el codigo)`, problems: huerfanas });

  return { reference: REFERENCE, total: Object.keys(reference).length, codes, results };
}

/* ---------------- Uso desde la linea de ordenes ---------------- */

function main() {
  const quiet = process.argv.includes('--quiet');
  let report;
  try {
    report = checkAll();
  } catch (err) {
    console.error(`check-locales: ${err.message}`);
    process.exit(1);
  }

  const { total, codes, results } = report;
  let failed = 0;

  for (const { code, problems } of results) {
    if (!problems.length) {
      console.log(`  ${code}: ${total} claves, todo cuadra`);
      continue;
    }
    failed += problems.length;
    console.log(`  ${code}: ${problems.length} problema(s)`);
    if (!quiet) {
      const shown = problems.slice(0, 40);
      for (const p of shown) console.log(`      [${p.tipo}] ${p.clave} — ${p.detalle}`);
      if (problems.length > shown.length) {
        console.log(`      … y ${problems.length - shown.length} mas`);
      }
    }
  }

  console.log(`\ncheck-locales: ${codes.length} idioma(s), ${total} claves de referencia (${REFERENCE}).`);
  if (failed) {
    console.error(`FALLA: ${failed} problema(s). Cada idioma debe tener las mismas claves que ${REFERENCE}.`);
    process.exit(1);
  }
  console.log('OK: todos los idiomas cuadran.');
}

if (import.meta.url === `file://${process.argv[1]}`) main();
