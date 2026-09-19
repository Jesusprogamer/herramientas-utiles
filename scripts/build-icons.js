/**
 * Genera los iconos de instalación y los manifest, uno por color de acento.
 *
 *   node scripts/build-icons.js
 *
 * Produce, para cada acento:
 *   assets/icons/<acento>/icon-192.png
 *   assets/icons/<acento>/icon-512.png
 *   assets/icons/<acento>/maskable-192.png
 *   assets/icons/<acento>/maskable-512.png
 *   assets/icons/<acento>/apple-touch-icon.png
 *   manifest-<acento>.json           (el del acento por defecto es manifest.json)
 *
 * Los PNG resultantes están en el repositorio, así que NO hace falta ejecutar
 * esto para usar la app: solo al cambiar el diseño o los degradados.
 *
 * Necesita Playwright con Chromium para rasterizar el SVG. Si no lo tienes:
 *   npm i -D playwright && npx playwright install chromium
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ACCENT_NAMES, DEFAULT_ACCENT, markSvgSource } from '../src/core/accents.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');

const SIZES = [
  { file: 'icon-192.png', size: 192, maskable: false },
  { file: 'icon-512.png', size: 512, maskable: false },
  { file: 'maskable-192.png', size: 192, maskable: true },
  { file: 'maskable-512.png', size: 512, maskable: true },
  { file: 'apple-touch-icon.png', size: 180, maskable: false }
];

/** El nombre de la app sale de los idiomas: no se repite aquí. */
function appStrings() {
  const es = JSON.parse(fs.readFileSync(path.join(ROOT, 'locales', 'es.json'), 'utf8'));
  return { name: es.app.name, short: es.app.short, description: es.app.description };
}

function manifestFor(accent, { name, short, description }) {
  const dir = `./assets/icons/${accent}/`;
  return {
    name,
    short_name: short,
    description,
    id: './',
    start_url: './',
    scope: './',
    display: 'standalone',
    display_override: ['standalone', 'minimal-ui', 'browser'],
    orientation: 'any',
    background_color: '#0f1115',
    theme_color: '#0f1115',
    dir: 'ltr',
    lang: 'es',
    categories: ['utilities', 'productivity'],
    icons: [
      { src: `${dir}icon-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: `${dir}icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: `${dir}maskable-192.png`, sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: `${dir}maskable-512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' }
    ],
    screenshots: [
      { src: './assets/screenshots/movil-inicio.png', sizes: '412x915', type: 'image/png', form_factor: 'narrow' },
      { src: './assets/screenshots/escritorio-inicio.png', sizes: '1280x800', type: 'image/png', form_factor: 'wide' }
    ]
  };
}

async function loadChromium() {
  for (const specifier of ['playwright', '/opt/node22/lib/node_modules/playwright/index.mjs']) {
    try { return (await import(specifier)).chromium; } catch { /* probamos el siguiente */ }
  }
  throw new Error(
    'No se encontró Playwright. Instálalo con:\n'
    + '  npm i -D playwright && npx playwright install chromium\n'
    + 'Los PNG ya están en el repositorio: esto solo hace falta si cambias el diseño.'
  );
}

async function main() {
  const strings = appStrings();
  const chromium = await loadChromium();
  const browser = await chromium.launch();
  let written = 0;

  for (const accent of ACCENT_NAMES) {
    const dir = path.join(ROOT, 'assets', 'icons', accent);
    fs.mkdirSync(dir, { recursive: true });

    for (const { file, size, maskable } of SIZES) {
      const svg = markSvgSource({ accent, maskable, id: 'g' });
      const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
      await page.setContent(
        `<style>html,body{margin:0;padding:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`,
        { waitUntil: 'load' }
      );
      fs.writeFileSync(path.join(dir, file), await page.screenshot({ omitBackground: true }));
      await page.close();
      written++;
    }

    const manifestName = accent === DEFAULT_ACCENT ? 'manifest.json' : `manifest-${accent}.json`;
    fs.writeFileSync(
      path.join(ROOT, manifestName),
      `${JSON.stringify(manifestFor(accent, strings), null, 2)}\n`
    );
    console.log(`  ${accent}: ${SIZES.length} iconos + ${manifestName}`);
  }

  // El favicon de arranque (antes de que el JS lea el acento guardado).
  fs.writeFileSync(
    path.join(ROOT, 'assets', 'icons', 'favicon.svg'),
    `${markSvgSource({ accent: DEFAULT_ACCENT, id: 'g' })}\n`
  );

  await browser.close();
  console.log(`\nListo: ${written} PNG y ${ACCENT_NAMES.length} manifest.`);
}

main().catch(err => { console.error(err.message); process.exit(1); });
