/**
 * Los degradados del acento y los iconos generados tienen que cuadrar entre
 * si y con lo que declara Ajustes.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GRADIENTS, ACCENT_NAMES, DEFAULT_ACCENT, markSvgSource, manifestPath, iconDir } from '../src/core/accents.js';
import { ACCENTS } from '../src/core/settings.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HEX = /^#[0-9a-f]{6}$/i;

const luminance = hex => {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

test('los acentos de accents.js son exactamente los de Ajustes', () => {
  assert.deepEqual([...ACCENT_NAMES].sort(), [...ACCENTS].sort());
  assert.ok(ACCENT_NAMES.includes(DEFAULT_ACCENT));
});

test('cada degradado tiene dos colores validos y distintos', () => {
  for (const [name, { from, to }] of Object.entries(GRADIENTS)) {
    assert.match(from, HEX, `${name}.from`);
    assert.match(to, HEX, `${name}.to`);
    assert.notEqual(from.toLowerCase(), to.toLowerCase(), `${name}: los dos tonos son iguales`);
  }
});

test('el simbolo blanco se distingue sobre los dos tonos', () => {
  // WCAG 1.4.11 pide 3:1 para elementos graficos.
  for (const [name, { from, to }] of Object.entries(GRADIENTS)) {
    for (const [lado, color] of [['from', from], ['to', to]]) {
      const ratio = contrast('#ffffff', color);
      assert.ok(ratio >= 3, `${name}.${lado}: contraste ${ratio.toFixed(2)}:1, hace falta 3:1`);
    }
  }
});

test('el SVG generado lleva los dos tonos del acento', () => {
  for (const [name, { from, to }] of Object.entries(GRADIENTS)) {
    const svg = markSvgSource({ accent: name, id: 'g' });
    assert.ok(svg.includes(from), `${name}: falta el tono inicial`);
    assert.ok(svg.includes(to), `${name}: falta el tono final`);
    assert.ok(svg.startsWith('<svg') && svg.endsWith('</svg>'));
  }
  const maskable = markSvgSource({ accent: DEFAULT_ACCENT, maskable: true, id: 'g' });
  assert.ok(!maskable.includes('rx="112"'), 'el maskable va a sangre, sin esquinas redondeadas');
  assert.ok(maskable.includes('scale(0.62)'), 'el maskable encoge el simbolo');
});

test('existen los iconos y el manifest de cada acento', () => {
  const archivos = ['icon-192.png', 'icon-512.png', 'maskable-192.png', 'maskable-512.png', 'apple-touch-icon.png'];
  for (const accent of ACCENT_NAMES) {
    for (const file of archivos) {
      const ruta = path.join(ROOT, iconDir(accent).replace('./', ''), file);
      assert.ok(fs.existsSync(ruta), `falta ${ruta} (ejecuta: npm run icons)`);
      assert.ok(fs.statSync(ruta).size > 1000, `${ruta} parece vacio`);
    }
    const manifestFile = path.join(ROOT, manifestPath(accent).replace('./', ''));
    assert.ok(fs.existsSync(manifestFile), `falta ${manifestFile}`);
    const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
    for (const icon of manifest.icons) {
      assert.ok(icon.src.includes(`/${accent}/`), `${manifestFile}: ${icon.src} no apunta a su acento`);
      assert.ok(fs.existsSync(path.join(ROOT, icon.src.replace('./', ''))), `${manifestFile}: no existe ${icon.src}`);
    }
    assert.ok(manifest.icons.some(i => i.purpose === 'maskable'), `${manifestFile}: falta un icono maskable`);
  }
});

test('todos los manifest declaran el mismo nombre que los idiomas', () => {
  const es = JSON.parse(fs.readFileSync(path.join(ROOT, 'locales', 'es.json'), 'utf8'));
  for (const accent of ACCENT_NAMES) {
    const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, manifestPath(accent).replace('./', '')), 'utf8'));
    assert.equal(manifest.name, es.app.name, `${accent}`);
    assert.equal(manifest.short_name, es.app.short, `${accent}`);
    assert.equal(manifest.start_url, './', `${accent}: start_url debe ser relativo`);
    assert.equal(manifest.scope, './', `${accent}: scope debe ser relativo`);
  }
});
