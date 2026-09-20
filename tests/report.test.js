import test from 'node:test';
import assert from 'node:assert/strict';
import { navegador, sistema, formato, cuerpo, titulo } from '../src/lib/report.js';
import { issueUrl, MAX_URL, REPO } from '../src/core/app-info.js';

const UA = {
  chrome: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  edge: 'Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0',
  safari: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
  firefox: 'Mozilla/5.0 (X11; Linux x86_64; rv:124.0) Gecko/20100101 Firefox/124.0',
  android: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36'
};

test('reconoce el navegador, y Edge no se confunde con Chrome', () => {
  assert.equal(navegador(UA.chrome), 'Chrome 131');
  assert.equal(navegador(UA.edge), 'Edge 131', 'Edge tambien dice Chrome en su UA');
  assert.equal(navegador(UA.safari), 'Safari 17');
  assert.equal(navegador(UA.firefox), 'Firefox 124');
  assert.equal(navegador(''), 'desconocido');
});

test('reconoce el sistema', () => {
  assert.equal(sistema(UA.iphone), 'iOS');
  assert.equal(sistema(UA.android), 'Android');
  assert.equal(sistema(UA.safari), 'macOS');
  assert.equal(sistema(UA.chrome), 'Windows');
  assert.equal(sistema(UA.firefox), 'Linux');
  assert.equal(sistema(''), 'desconocido');
});

test('movil o escritorio por el ancho', () => {
  assert.equal(formato(390), 'movil');
  assert.equal(formato(767), 'movil');
  assert.equal(formato(768), 'escritorio');
  assert.equal(formato(1440), 'escritorio');
});

const ETIQUETAS = {
  quePasa: 'Qué pasa', entorno: 'Entorno', errores: 'Errores', sinDescripcion: 'sin descripción',
  version: 'Versión', herramienta: 'Herramienta', idiomaApp: 'Idioma de la app',
  idiomaNavegador: 'Idioma del navegador', tema: 'Tema', navegador: 'Navegador',
  sistema: 'Sistema', formato: 'Formato', pantalla: 'Pantalla', instalada: 'Instalada', conexion: 'Conexión'
};
const DATOS = {
  version: '2.10.0', herramienta: 'Temporizador', idiomaApp: 'es', idiomaNavegador: 'es-ES',
  tema: 'oscuro', acento: 'azul', navegador: 'Chrome 131', sistema: 'Android',
  formato: 'movil', pantalla: '412×915', instalada: 'sí', conexion: 'con conexión'
};

test('el cuerpo lleva la descripcion y el entorno', () => {
  const texto = cuerpo({ descripcion: 'La alarma no suena', datos: DATOS, etiquetas: ETIQUETAS });
  assert.ok(texto.includes('La alarma no suena'));
  assert.ok(texto.includes('**Versión:** 2.10.0'));
  assert.ok(texto.includes('**Herramienta:** Temporizador'));
  assert.ok(texto.includes('oscuro · azul'));
});

test('sin descripcion lo dice, no deja el hueco vacio', () => {
  const texto = cuerpo({ descripcion: '   ', datos: DATOS, etiquetas: ETIQUETAS });
  assert.ok(texto.includes('_sin descripción_'));
});

test('los errores solo aparecen si los hay', () => {
  const sin = cuerpo({ descripcion: 'x', datos: DATOS, etiquetas: ETIQUETAS });
  assert.ok(!sin.includes('## Errores'));
  const con = cuerpo({ descripcion: 'x', datos: DATOS, errores: '- fallo (a.js:1:2)', etiquetas: ETIQUETAS });
  assert.ok(con.includes('## Errores'));
  assert.ok(con.includes('a.js:1:2'));
});

test('el titulo lleva su prefijo y se queda con la primera frase', () => {
  assert.equal(titulo('[Error]', 'La alarma no suena. Pasa siempre.'), '[Error] La alarma no suena');
  assert.equal(titulo('[Sugerencia]', 'Añadir modo oscuro'), '[Sugerencia] Añadir modo oscuro');
  assert.ok(titulo('[Error]', 'x'.repeat(200)).length < 90, 'no se desborda');
  assert.equal(titulo('[Error]', ''), '[Error]');
  assert.equal(titulo('[Error]', '  varias   palabras  '), '[Error] varias palabras');
});

test('la direccion del aviso apunta al repositorio y lleva las etiquetas', () => {
  const { url, recortado } = issueUrl({ title: '[Error] x', body: 'hola', labels: ['bug'] });
  assert.ok(url.startsWith(`https://github.com/${REPO}/issues/new?`));
  assert.ok(url.includes('labels=bug'));
  assert.equal(recortado, false);
});

test('un cuerpo enorme se recorta y lo avisa', () => {
  const { url, recortado } = issueUrl({ title: '[Error] x', body: 'y'.repeat(20000), labels: ['bug'] });
  assert.equal(recortado, true);
  assert.ok(url.length <= MAX_URL, `${url.length} deberia caber en ${MAX_URL}`);
  assert.ok(decodeURIComponent(url).includes('…'), 'se ve que esta cortado');
});
