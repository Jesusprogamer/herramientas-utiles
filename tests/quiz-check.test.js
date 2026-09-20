import test from 'node:test';
import assert from 'node:assert/strict';
import {
  plano, distancia, comprobarTexto, aNumero, comprobarNumero,
  normalizarUnidad, comprobarUnidad, normalizarConfig, comprobarConfig,
  leerValencias, comprobarValencias
} from '../src/lib/quiz/check.js';

test('plano quita tildes y mayusculas', () => {
  assert.equal(plano('Fósforo'), 'fosforo');
  assert.equal(plano('  NEÓN '), 'neon');
});

test('la distancia de edicion se corta pronto', () => {
  assert.equal(distancia('casa', 'casa'), 0);
  assert.equal(distancia('casa', 'caza'), 1);
  assert.equal(distancia('casa', 'cazo'), 2);
  assert.ok(distancia('casa', 'elefante', 2) > 2, 'no pierde tiempo con lo muy distinto');
});

test('los nombres valen sin tildes y con una errata', () => {
  assert.equal(comprobarTexto('hidrogeno', ['Hidrógeno']), true);
  assert.equal(comprobarTexto('Hidrógeno', ['Hidrógeno']), true);
  assert.equal(comprobarTexto('hidrogino', ['Hidrógeno']), true, 'una letra cambiada');
  assert.equal(comprobarTexto('helio', ['Hidrógeno']), false);
  assert.equal(comprobarTexto('', ['Hidrógeno']), false);
});

test('en palabras cortas una errata NO vale: seria otro elemento', () => {
  assert.equal(comprobarTexto('oso', ['Oro']), false, 'Oro tiene 3 letras');
  assert.equal(comprobarTexto('boro', ['Bario']), false);
});

test('se puede exigir las tildes', () => {
  assert.equal(comprobarTexto('fosforo', ['Fósforo'], { tildes: true, erratas: false }), false);
  assert.equal(comprobarTexto('Fósforo', ['Fósforo'], { tildes: true }), true);
});

test('los simbolos pueden exigir las mayusculas correctas', () => {
  assert.equal(comprobarTexto('na', ['Na']), true, 'por defecto da igual');
  assert.equal(comprobarTexto('na', ['Na'], { mayusculas: true }), false);
  assert.equal(comprobarTexto('Na', ['Na'], { mayusculas: true }), true);
  assert.equal(comprobarTexto('NA', ['Na'], { mayusculas: true }), false);
});

test('vale el nombre en cualquiera de los idiomas aceptados', () => {
  assert.equal(comprobarTexto('gold', ['Oro', 'Gold']), true);
  assert.equal(comprobarTexto('oro', ['Oro', 'Gold']), true);
  assert.equal(comprobarTexto('gold', ['Oro']), false, 'si solo se acepta el actual');
});

test('los numeros admiten coma o punto', () => {
  assert.equal(aNumero('1,5'), 1.5);
  assert.equal(aNumero('1.5'), 1.5);
  assert.equal(aNumero(' -2,25 '), -2.25);
  assert.equal(aNumero('1e3'), 1000);
  assert.equal(aNumero('hola'), null);
  assert.equal(aNumero(''), null);
  assert.equal(aNumero('1,5,2'), null);
});

test('tolerancia por decimales', () => {
  const tol = { modo: 'decimales', n: 1 };
  assert.equal(comprobarNumero('1,0', 1.04, tol), true);
  assert.equal(comprobarNumero('1,0', 1.06, tol), false);
  assert.equal(comprobarNumero('12,01', 12.01, { modo: 'decimales', n: 2 }), true);
});

test('tolerancia de entero redondeado', () => {
  const tol = { modo: 'entero' };
  assert.equal(comprobarNumero('12', 12.4, tol), true);
  assert.equal(comprobarNumero('12', 11.6, tol), true);
  assert.equal(comprobarNumero('12', 12.6, tol), false);
});

test('tolerancia absoluta y por porcentaje', () => {
  assert.equal(comprobarNumero('9,8', 9.81, { modo: 'absoluta', valor: 0.05 }), true);
  assert.equal(comprobarNumero('9,5', 9.81, { modo: 'absoluta', valor: 0.05 }), false);
  assert.equal(comprobarNumero('102', 100, { modo: 'porcentaje', valor: 5 }), true);
  assert.equal(comprobarNumero('110', 100, { modo: 'porcentaje', valor: 5 }), false);
});

test('una respuesta que no es un numero nunca acierta', () => {
  assert.equal(comprobarNumero('bastante', 10), false);
  assert.equal(comprobarNumero('', 10), false);
});

test('las unidades equivalentes se normalizan igual', () => {
  const canon = normalizarUnidad('m/s');
  assert.equal(normalizarUnidad('m·s⁻¹'), canon);
  assert.equal(normalizarUnidad('m s^-1'), canon);
  assert.equal(normalizarUnidad('M/S'), canon);
  assert.equal(normalizarUnidad(' m / s '), canon);
});

test('unidades con exponentes y varias bases', () => {
  assert.equal(normalizarUnidad('kg·m/s²'), normalizarUnidad('kg m s^-2'));
  assert.equal(normalizarUnidad('m/s²'), normalizarUnidad('m·s⁻²'));
  assert.equal(normalizarUnidad('J/(kg·K)'), normalizarUnidad('J/(kg·K)'));
});

test('el orden en que se escriben las bases no importa', () => {
  assert.equal(normalizarUnidad('m kg'), normalizarUnidad('kg m'));
});

test('comprobarUnidad acepta las formas equivalentes y rechaza otra unidad', () => {
  assert.equal(comprobarUnidad('m·s⁻¹', 'm/s'), true);
  assert.equal(comprobarUnidad('km/h', 'm/s'), false);
  assert.equal(comprobarUnidad('', 'm/s'), false);
});

test('la configuracion electronica tolera el formato', () => {
  const canon = normalizarConfig('1s2 2s2');
  assert.equal(normalizarConfig('1s²2s²'), canon);
  assert.equal(normalizarConfig('1s^2 2s^2'), canon);
  assert.equal(normalizarConfig('  1S2   2S2 '), canon);
});

test('da igual el orden de los subniveles', () => {
  assert.equal(normalizarConfig('[Ar]4s2 3d1'), normalizarConfig('[Ar] 3d1 4s2'));
});

test('se puede exigir la forma completa, la abreviada o aceptar ambas', () => {
  const formas = { completa: '1s2 2s2 2p6 3s1', abreviada: '[Ne]3s1' };
  assert.equal(comprobarConfig('[Ne]3s1', formas, 'ambas'), true);
  assert.equal(comprobarConfig('1s2 2s2 2p6 3s1', formas, 'ambas'), true);
  assert.equal(comprobarConfig('[Ne]3s1', formas, 'completa'), false);
  assert.equal(comprobarConfig('1s2 2s2 2p6 3s1', formas, 'abreviada'), false);
  assert.equal(comprobarConfig('', formas), false);
});

test('las valencias se leen con o sin signo y con cualquier separador', () => {
  assert.deepEqual(leerValencias('2, 3'), [2, 3]);
  assert.deepEqual(leerValencias('+2 +3'), [2, 3]);
  assert.deepEqual(leerValencias('-1'), [-1]);
  assert.deepEqual(leerValencias('2;3'), [2, 3]);
  assert.deepEqual(leerValencias('nada'), []);
});

test('modo «una valencia»: basta con acertar una', () => {
  const o = { modo: 'una' };
  assert.equal(comprobarValencias('2', [2, 3], o), true);
  assert.equal(comprobarValencias('3', [2, 3], o), true);
  assert.equal(comprobarValencias('4', [2, 3], o), false);
  assert.equal(comprobarValencias('', [2, 3], o), false);
});

test('modo «todas»: hay que darlas todas y ninguna de mas', () => {
  const o = { modo: 'todas' };
  assert.equal(comprobarValencias('2, 3', [2, 3], o), true);
  assert.equal(comprobarValencias('3, 2', [2, 3], o), true, 'el orden da igual');
  assert.equal(comprobarValencias('2', [2, 3], o), false, 'falta una');
  assert.equal(comprobarValencias('2, 3, 4', [2, 3], o), false, 'sobra una');
});

test('repetir una valencia no cuela como si fueran dos', () => {
  assert.equal(comprobarValencias('2, 2', [2, 3], { modo: 'todas' }), false);
});

test('penalizar invalida la respuesta si se cuela una no aceptada', () => {
  assert.equal(comprobarValencias('2, 4', [2, 3], { modo: 'una' }), true, 'sin penalizar, basta el 2');
  assert.equal(comprobarValencias('2, 4', [2, 3], { modo: 'una', penalizar: true }), false);
});

test('sin valencias aceptadas no se puede acertar', () => {
  assert.equal(comprobarValencias('2', [], { modo: 'una' }), false);
  assert.equal(comprobarValencias('2', null, { modo: 'una' }), false);
});
