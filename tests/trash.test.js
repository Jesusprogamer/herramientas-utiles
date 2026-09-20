import test from 'node:test';
import assert from 'node:assert/strict';
import {
  insertarEn, restaurarLote, caducadas, trasPurgar, recortar,
  buscar, porHerramienta, masRecientesPrimero, RETENCION_POR_DEFECTO
} from '../src/lib/trash.js';

const DIA = 24 * 60 * 60 * 1000;
const AHORA = 1_700_000_000_000;
const entrada = (id, extra = {}) => ({ id, borradoEn: AHORA, etiqueta: id, tool: 'listas', ...extra });

test('un elemento vuelve a la posicion que ocupaba', () => {
  assert.deepEqual(insertarEn(['a', 'c'], 'b', 1), ['a', 'b', 'c']);
  assert.deepEqual(insertarEn(['b', 'c'], 'a', 0), ['a', 'b', 'c']);
  assert.deepEqual(insertarEn(['a', 'b'], 'c', 2), ['a', 'b', 'c']);
});

test('una posicion imposible no rompe: va al final o al principio', () => {
  assert.deepEqual(insertarEn(['a'], 'z', 99), ['a', 'z']);
  assert.deepEqual(insertarEn(['a'], 'z', -5), ['z', 'a']);
  assert.deepEqual(insertarEn(['a'], 'z', null), ['a', 'z']);
  assert.deepEqual(insertarEn(null, 'z', 0), ['z']);
});

test('un lote entero vuelve cada uno a su sitio, no amontonado', () => {
  const lista = ['b', 'd'];
  const lote = [{ datos: 'c', pos: 2 }, { datos: 'a', pos: 0 }];
  assert.deepEqual(restaurarLote(lista, lote), ['a', 'b', 'c', 'd']);
});

test('restaurar el lote completo devuelve la lista original', () => {
  const original = ['uno', 'dos', 'tres', 'cuatro'];
  const quedan = ['uno', 'cuatro'];
  const lote = [{ datos: 'dos', pos: 1 }, { datos: 'tres', pos: 2 }];
  assert.deepEqual(restaurarLote(quedan, lote), original);
});

test('caduca lo que ha pasado del plazo, no lo de hoy', () => {
  const lista = [
    entrada('vieja', { borradoEn: AHORA - 40 * DIA }),
    entrada('justo', { borradoEn: AHORA - 29 * DIA }),
    entrada('nueva')
  ];
  assert.deepEqual(caducadas(lista, 30, AHORA).map(e => e.id), ['vieja']);
  assert.deepEqual(trasPurgar(lista, 30, AHORA).map(e => e.id), ['justo', 'nueva']);
});

test('el plazo es configurable', () => {
  const lista = [entrada('x', { borradoEn: AHORA - 10 * DIA })];
  assert.equal(trasPurgar(lista, 7, AHORA).length, 0, 'con 7 dias ya caduco');
  assert.equal(trasPurgar(lista, 30, AHORA).length, 1, 'con 30 aun no');
  assert.equal(RETENCION_POR_DEFECTO, 30);
});

test('una entrada sin fecha no se purga por si acaso', () => {
  assert.equal(trasPurgar([{ id: 'x' }], 1, AHORA).length, 1);
});

test('al pasarse del tope se tira lo mas antiguo primero', () => {
  const lista = [
    entrada('a', { borradoEn: AHORA - 3 * DIA }),
    entrada('b', { borradoEn: AHORA - 1 * DIA }),
    entrada('c', { borradoEn: AHORA })
  ];
  assert.deepEqual(recortar(lista, 2).map(e => e.id), ['b', 'c'], 'la mas vieja se va');
  assert.equal(recortar(lista, 5).length, 3, 'por debajo del tope no se toca nada');
});

test('recortar conserva el orden original de los que quedan', () => {
  const lista = [entrada('c', { borradoEn: AHORA }), entrada('a', { borradoEn: AHORA - 3 * DIA }), entrada('b', { borradoEn: AHORA - DIA })];
  assert.deepEqual(recortar(lista, 2).map(e => e.id), ['c', 'b']);
});

test('el buscador de la papelera ignora tildes y mayusculas', () => {
  const lista = [entrada('1', { etiqueta: 'Comprar café' }), entrada('2', { etiqueta: 'Repasar' })];
  assert.deepEqual(buscar(lista, 'cafe').map(e => e.id), ['1']);
  assert.deepEqual(buscar(lista, 'REPA').map(e => e.id), ['2']);
  assert.equal(buscar(lista, '').length, 2);
  assert.equal(buscar(lista, 'zzz').length, 0);
});

test('tambien se busca por herramienta', () => {
  const lista = [entrada('1', { tool: 'agenda' }), entrada('2', { tool: 'listas' })];
  assert.deepEqual(buscar(lista, 'agenda').map(e => e.id), ['1']);
});

test('se agrupa por herramienta conservando el orden', () => {
  const lista = [entrada('1', { tool: 'listas' }), entrada('2', { tool: 'agenda' }), entrada('3', { tool: 'listas' })];
  const grupos = porHerramienta(lista);
  assert.deepEqual(grupos.map(g => g.tool), ['listas', 'agenda']);
  assert.deepEqual(grupos[0].entradas.map(e => e.id), ['1', '3']);
});

test('la papelera se lee de lo mas reciente a lo mas antiguo', () => {
  const lista = [entrada('vieja', { borradoEn: AHORA - DIA }), entrada('nueva', { borradoEn: AHORA })];
  assert.deepEqual(masRecientesPrimero(lista).map(e => e.id), ['nueva', 'vieja']);
  assert.deepEqual(lista.map(e => e.id), ['vieja', 'nueva'], 'no se toca el original');
});
