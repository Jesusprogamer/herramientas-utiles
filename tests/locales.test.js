/**
 * Los idiomas tienen que cuadrar entre si.
 * Se ejecuta con: node --test tests/
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { lookup } from '../src/lib/lookup.js';
import { checkAll, listLocales, flatten, placeholders, readLocale, resolve, usedKeys, REFERENCE } from '../scripts/check-locales.js';

test('existe el idioma de referencia', () => {
  assert.ok(listLocales().includes(REFERENCE), `falta locales/${REFERENCE}.json`);
});

test('todos los idiomas tienen las mismas claves que el de referencia', () => {
  const { results } = checkAll();
  const rotos = results.filter(r => r.problems.length);
  const detalle = rotos
    .map(r => `${r.code}: ` + r.problems.map(p => `[${p.tipo}] ${p.clave} — ${p.detalle}`).join('; '))
    .join('\n');
  assert.equal(rotos.length, 0, `Idiomas con problemas:\n${detalle}`);
});

test('el idioma de referencia no tiene textos vacios', () => {
  const plano = flatten(readLocale(REFERENCE));
  const vacias = Object.entries(plano)
    .filter(([, v]) => (typeof v === 'string' ? !v.trim() : Array.isArray(v) && v.some(x => !String(x).trim())))
    .map(([k]) => k);
  assert.deepEqual(vacias, [], `Claves vacias en ${REFERENCE}`);
});

test('el nombre de la app solo vive en los idiomas y en el manifest', async () => {
  const { readFileSync } = await import('node:fs');
  const manifest = JSON.parse(readFileSync(new URL('../manifest.json', import.meta.url), 'utf8'));
  const es = readLocale(REFERENCE);
  assert.equal(manifest.name, es.app.name, 'manifest.name y app.name deben coincidir');
  assert.equal(manifest.short_name, es.app.short, 'manifest.short_name y app.short deben coincidir');
});

test('los marcadores se detectan bien', () => {
  assert.deepEqual([...placeholders('Hola {name}, van {n}')].sort(), ['n', 'name']);
  assert.deepEqual([...placeholders(['sin marcas', 'con {una}'])], ['una']);
  assert.deepEqual([...placeholders('sin ninguna')], []);
});

test('las claves con punto dentro se encuentran igual', () => {
  const dict = readLocale(REFERENCE);
  // "calc.sistema" guarda "metodo" y "metodo.reduccion" al mismo nivel: las
  // dos se tienen que poder pedir por su camino entero.
  assert.equal(resolve(dict, 'calc.sistema.metodo'), dict.calc.sistema.metodo);
  assert.equal(resolve(dict, 'calc.sistema.metodo.reduccion'), dict.calc.sistema['metodo.reduccion']);
  assert.equal(resolve(dict, 'calc.paso.lineal.inicio'), dict.calc.paso['lineal.inicio']);
  // Y lo que no existe sigue sin existir.
  assert.equal(resolve(dict, 'app.name.nope'), undefined);
  assert.equal(resolve(dict, 'no.existe'), undefined);
});

test('la app y el comprobador buscan con el mismo modulo', async () => {
  // Si cada uno tuviera su copia, el comprobador dejaria pasar textos rotos.
  assert.equal(resolve, lookup);
  const i18n = await readFile(new URL('../src/core/i18n.js', import.meta.url), 'utf8');
  assert.match(i18n, /import \{ lookup \} from '\.\.\/lib\/lookup\.js'/);
  assert.doesNotMatch(i18n, /function lookup\s*\(/);
});

test('toda clave que el codigo pide con un texto literal existe', () => {
  const dict = readLocale(REFERENCE);
  const huerfanas = [...usedKeys()]
    .filter(([clave]) => resolve(dict, clave) === undefined)
    .map(([clave, archivo]) => `${clave} (${archivo})`);
  assert.deepEqual(huerfanas, [], `Claves que el codigo pide y no existen en ${REFERENCE}`);
});
