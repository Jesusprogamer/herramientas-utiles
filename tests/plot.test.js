import test from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../src/lib/expr.js';
import { pasoRejilla, muestrear, rangoVisible } from '../src/lib/plot.js';

test('el paso de rejilla siempre es 1, 2 o 5 por una potencia de diez', () => {
  for (const span of [0.03, 0.5, 1, 7, 20, 137, 5000]) {
    const paso = pasoRejilla(span);
    const mantisa = paso / Math.pow(10, Math.floor(Math.log10(paso)));
    assert.ok([1, 2, 5].includes(Math.round(mantisa * 1000) / 1000),
      `${span} -> ${paso} (mantisa ${mantisa})`);
  }
});

test('el paso de rejilla deja entre 4 y 20 divisiones', () => {
  for (const span of [0.7, 3, 20, 480, 9000]) {
    const divisiones = span / pasoRejilla(span, 8);
    assert.ok(divisiones >= 4 && divisiones <= 20, `${span} -> ${divisiones}`);
  }
});

test('un span invalido no rompe la rejilla', () => {
  assert.equal(pasoRejilla(0), 1);
  assert.equal(pasoRejilla(NaN), 1);
  assert.equal(pasoRejilla(-5), 1);
});

test('muestrear devuelve los extremos exactos', () => {
  const m = muestrear(parse('x'), -3, 3, 7);
  assert.equal(m.length, 7);
  assert.equal(m[0].x, -3);
  assert.ok(Math.abs(m[6].x - 3) < 1e-12);
  assert.ok(Math.abs(m[3].y - 0) < 1e-12);
});

test('muestrear marca NaN donde la funcion no existe', () => {
  const m = muestrear(parse('1/x'), -1, 1, 3);
  assert.ok(Number.isNaN(m[1].y), 'en x = 0 no hay valor');
  assert.ok(Number.isFinite(m[0].y) && Number.isFinite(m[2].y));
});

test('muestrear con sqrt de negativo no lanza', () => {
  const m = muestrear(parse('sqrt(x)'), -4, 4, 9);
  assert.ok(m.slice(0, 4).every(p => Number.isNaN(p.y)));
  assert.ok(Math.abs(m[8].y - 2) < 1e-12);
});

test('rangoVisible cine sin(x) entre -1 y 1 con margen', () => {
  const r = rangoVisible(muestrear(parse('sin(x)'), -10, 10, 400));
  assert.ok(r.y0 < -1 && r.y0 > -1.5);
  assert.ok(r.y1 > 1 && r.y1 < 1.5);
});

test('rangoVisible de una constante abre un hueco a su alrededor', () => {
  const r = rangoVisible(muestrear(parse('3'), 0, 1, 10));
  assert.ok(r.y0 < 3 && r.y1 > 3);
});

test('rangoVisible devuelve null si nada es finito', () => {
  assert.equal(rangoVisible([{ x: 0, y: NaN }, { x: 1, y: NaN }]), null);
});
