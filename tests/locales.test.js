/**
 * Los idiomas tienen que cuadrar entre si.
 * Se ejecuta con: node --test tests/
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { checkAll, listLocales, flatten, placeholders, readLocale, REFERENCE } from '../scripts/check-locales.js';

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
