/** El modelo de formato de las notas: puro, sin DOM. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { toFragments, fromPlain, plainText, compact, applyStyle, textLength, styleAt, COLORS } from '../src/tools/listas/rich.js';

test('las notas antiguas de texto plano se migran sin perder nada', () => {
  const nota = 'Primera linea\nSegunda con <script>alert(1)</script>';
  const frags = toFragments(nota);
  assert.equal(plainText(frags), nota);
  assert.deepEqual(frags, [{ t: nota }]);
});

test('descarta fragmentos y colores invalidos', () => {
  const sucio = [{ t: 'ok', b: true, c: 'inventado' }, { t: 5 }, null, { t: 'mas', c: 'rojo' }];
  assert.deepEqual(toFragments(sucio), [{ t: 'ok', b: true }, { t: 'mas', c: 'rojo' }]);
});

test('compact une lo que tiene el mismo estilo', () => {
  assert.deepEqual(compact([{ t: 'a' }, { t: 'b' }, { t: 'c', b: true }]), [{ t: 'ab' }, { t: 'c', b: true }]);
  assert.deepEqual(compact([{ t: '' }, { t: 'x' }]), [{ t: 'x' }]);
});

test('poner negrita a un tramo parte el fragmento en tres', () => {
  const r = applyStyle(fromPlain('abcdef'), 2, 4, { b: true });
  assert.deepEqual(r, [{ t: 'ab' }, { t: 'cd', b: true }, { t: 'ef' }]);
  assert.equal(plainText(r), 'abcdef');
});

test('quitar un estilo tambien funciona', () => {
  const negrita = applyStyle(fromPlain('abcdef'), 0, 6, { b: true });
  const quitado = applyStyle(negrita, 2, 4, { b: false });
  assert.deepEqual(quitado, [{ t: 'ab', b: true }, { t: 'cd' }, { t: 'ef', b: true }]);
});

test('los estilos se acumulan sin pisarse', () => {
  let f = fromPlain('hola mundo');
  f = applyStyle(f, 0, 4, { b: true });
  f = applyStyle(f, 2, 7, { i: true });
  f = applyStyle(f, 5, 10, { c: 'rojo' });
  assert.equal(plainText(f), 'hola mundo');
  assert.deepEqual(f, [
    { t: 'ho', b: true }, { t: 'la', b: true, i: true },
    { t: ' ', i: true }, { t: 'mu', i: true, c: 'rojo' }, { t: 'ndo', c: 'rojo' }
  ]);
});

test('el texto nunca se pierde ni se duplica', () => {
  const original = 'uno dos tres cuatro';
  let f = fromPlain(original);
  for (const [a, b, p] of [[0, 3, { b: true }], [4, 7, { i: true }], [2, 12, { s: true }], [8, 19, { c: 'azul' }], [0, 19, { b: false }]]) {
    f = applyStyle(f, a, b, p);
    assert.equal(plainText(f), original, `tras aplicar ${JSON.stringify(p)}`);
    assert.equal(textLength(f), original.length);
  }
});

test('un tramo vacio no cambia nada', () => {
  const f = fromPlain('abc');
  assert.deepEqual(applyStyle(f, 2, 2, { b: true }), [{ t: 'abc' }]);
});

test('styleAt dice si todo el tramo lleva ese estilo', () => {
  const f = applyStyle(fromPlain('abcdef'), 2, 4, { b: true });
  assert.equal(styleAt(f, 2, 4, 'b'), true);
  assert.equal(styleAt(f, 1, 4, 'b'), false);
  assert.equal(styleAt(f, 0, 2, 'b'), false);
});

test('los colores permitidos son ocho', () => {
  assert.equal(COLORS.length, 8);
  assert.ok(COLORS.every(c => /^[a-z]+$/.test(c)));
});

test('pegar sustituye solo el tramo y conserva el formato del resto', async () => {
  const { replaceRange } = await import('../src/tools/listas/rich.js');
  let f = applyStyle(fromPlain('hola mundo'), 0, 4, { b: true });
  f = applyStyle(f, 5, 10, { c: 'azul' });
  const r = replaceRange(f, 5, 10, 'gente');
  assert.equal(plainText(r), 'hola gente');
  assert.deepEqual(r[0], { t: 'hola', b: true }, 'la negrita del principio sigue');
  // compact() fusiona lo pegado con el espacio anterior, que tampoco tiene estilo.
  const conTexto = r.filter(x => x.t.includes('gente'));
  assert.equal(conTexto.length, 1);
  assert.ok(!conTexto[0].c && !conTexto[0].b && !conTexto[0].i && !conTexto[0].s,
    'lo pegado entra sin formato');
});

test('pegar con el cursor sin seleccion inserta sin borrar', async () => {
  const { replaceRange } = await import('../src/tools/listas/rich.js');
  const f = applyStyle(fromPlain('abcdef'), 0, 6, { b: true });
  const r = replaceRange(f, 3, 3, 'XY');
  assert.equal(plainText(r), 'abcXYdef');
  assert.equal(plainText(r).length, 8);
});

test('pegar al final funciona', async () => {
  const { replaceRange } = await import('../src/tools/listas/rich.js');
  assert.equal(plainText(replaceRange(fromPlain('abc'), 3, 3, '!')), 'abc!');
  assert.equal(plainText(replaceRange([], 0, 0, 'nuevo')), 'nuevo');
});
