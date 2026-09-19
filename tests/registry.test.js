/**
 * El catalogo de herramientas tiene que estar completo y coherente con los
 * idiomas: si falta un nombre, en el inicio saldria la clave cruda.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TOOLS, CATEGORIES } from '../src/core/registry.js';
import { listLocales, readLocale } from '../scripts/check-locales.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('cada herramienta tiene id, icono y categoria valida', () => {
  for (const tool of TOOLS) {
    assert.match(tool.id, /^[a-z0-9-]+$/, `id raro: ${tool.id}`);
    assert.ok(tool.icon, `${tool.id}: falta el icono`);
    assert.ok(CATEGORIES.includes(tool.category), `${tool.id}: categoria "${tool.category}" desconocida`);
  }
});

test('no hay ids repetidos', () => {
  const ids = TOOLS.map(t => t.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('cada herramienta tiene nombre y descripcion en todos los idiomas', () => {
  for (const code of listLocales()) {
    const dict = readLocale(code);
    for (const tool of TOOLS) {
      const entry = dict.tools?.[tool.id];
      assert.ok(entry, `${code}: falta tools.${tool.id}`);
      assert.ok(entry.name?.trim(), `${code}: falta tools.${tool.id}.name`);
      assert.ok(entry.desc?.trim(), `${code}: falta tools.${tool.id}.desc`);
    }
  }
});

test('cada categoria tiene nombre en todos los idiomas', () => {
  for (const code of listLocales()) {
    const dict = readLocale(code);
    for (const id of CATEGORIES) {
      assert.ok(dict.categories?.[id]?.trim(), `${code}: falta categories.${id}`);
    }
  }
});

test('las herramientas listas tienen su carpeta y estan precacheadas', () => {
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  for (const tool of TOOLS.filter(t => t.ready)) {
    const file = path.join(ROOT, 'src', 'tools', tool.id, 'index.js');
    assert.ok(fs.existsSync(file), `falta ${file}`);
    assert.ok(sw.includes(`./src/tools/${tool.id}/index.js`), `${tool.id} no esta en PRECACHE de sw.js`);
  }
});

test('todo modulo de src esta en el PRECACHE del service worker', () => {
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  const walk = dir => fs.readdirSync(dir, { withFileTypes: true })
    .flatMap(e => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
  const modules = walk(path.join(ROOT, 'src'))
    .filter(f => f.endsWith('.js'))
    .map(f => `./${path.relative(ROOT, f).split(path.sep).join('/')}`);
  const faltan = modules.filter(m => !sw.includes(`'${m}'`));
  assert.deepEqual(faltan, [], 'modulos sin precachear (no funcionarian sin conexion)');
});
