import test from 'node:test';
import assert from 'node:assert/strict';
import * as b from '../src/lib/bases.js';

const conv = (texto, origen, destino) => b.convertir(texto, origen, destino).texto;

test('conversiones basicas entre las cuatro bases habituales', () => {
  assert.equal(conv('255', 10, 16), 'ff');
  assert.equal(conv('ff', 16, 2), '11111111');
  assert.equal(conv('11111111', 2, 8), '377');
  assert.equal(conv('377', 8, 10), '255');
  assert.equal(conv('0', 10, 2), '0');
});

test('acepta mayusculas, espacios y guiones bajos', () => {
  assert.equal(conv('FF', 16, 10), '255');
  assert.equal(conv('1111 0000', 2, 16), 'f0');
  assert.equal(conv('1_000_000', 10, 16), 'f4240');
});

test('la parte entera no pierde precision por grande que sea', () => {
  const enorme = '123456789012345678901234567890';
  assert.equal(conv(conv(enorme, 10, 16), 16, 10), enorme);
});

test('la parte fraccionaria es exacta cuando puede serlo', () => {
  assert.equal(conv('0.5', 10, 2), '0.1');
  assert.equal(conv('1010.101', 2, 10), '10.625');
  assert.equal(conv('0.625', 10, 2), '0.101');
});

test('una fraccion periodica se corta y lo avisa', () => {
  const r = b.convertir('0.1', 10, 2);
  assert.equal(r.cortado, true);
  assert.ok(r.texto.startsWith('0.0001100110011'));
  assert.equal(r.texto.length - 2, b.MAX_DECIMALES);
});

test('una fraccion exacta no se marca como cortada', () => {
  assert.equal(b.convertir('0.25', 10, 2).cortado, false);
});

test('los negativos conservan el signo, y el cero no lo lleva', () => {
  assert.equal(conv('-255', 10, 16), '-ff');
  assert.equal(conv('-0', 10, 2), '0');
});

test('los digitos fuera de la base se rechazan con su motivo', () => {
  assert.throws(() => b.convertir('2', 2, 10), /digito:2/);
  assert.throws(() => b.convertir('g', 16, 10), /digito:g/);
  assert.throws(() => b.convertir('', 10, 2), /vacio/);
  assert.throws(() => b.convertir('1.2.3', 10, 2), /separadores/);
});

test('bases validas solo de 2 a 36', () => {
  assert.equal(b.esBaseValida(2), true);
  assert.equal(b.esBaseValida(36), true);
  assert.equal(b.esBaseValida(1), false);
  assert.equal(b.esBaseValida(37), false);
  assert.equal(b.esBaseValida(2.5), false);
});

test('ida y vuelta por todas las bases para varios numeros', () => {
  for (let base = 2; base <= 36; base++) {
    for (const n of ['0', '1', '42', '1000', '987654321']) {
      assert.equal(conv(conv(n, 10, base), base, 10), n, `base ${base}, n ${n}`);
    }
  }
});

test('los pasos de la parte entera terminan leyendo los restos al reves', () => {
  const pasos = b.pasosEntera(13n, 2);
  assert.equal(pasos.at(-1).clave, 'bases.leerAlReves');
  assert.equal(pasos.at(-1).params.digitos, '1 1 0 1');
  assert.equal(pasos.length, 5);
});

test('el cero tiene su propio paso', () => {
  assert.deepEqual(b.pasosEntera(0n, 2), [{ clave: 'bases.cero', params: {} }]);
});

test('los pasos de la fraccion se paran al agotarse', () => {
  const pasos = b.pasosFraccion(b.fraccionExacta('5', 10), 2);
  assert.equal(pasos.length, 1);
  assert.equal(pasos[0].params.digito, '1');
});

test('complemento a dos', () => {
  assert.equal(b.complementoDos(5n, 8), '00000101');
  assert.equal(b.complementoDos(-5n, 8), '11111011');
  assert.equal(b.complementoDos(-128n, 8), '10000000');
  assert.equal(b.complementoDos(127n, 8), '01111111');
  assert.equal(b.complementoDos(128n, 8), null);
  assert.equal(b.complementoDos(-129n, 8), null);
});

test('agrupar de cuatro en cuatro desde la derecha', () => {
  assert.equal(b.agrupar('11110000'), '1111 0000');
  assert.equal(b.agrupar('110000'), '11 0000');
  assert.equal(b.agrupar('1'), '1');
});
