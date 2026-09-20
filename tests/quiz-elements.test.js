import test from 'node:test';
import assert from 'node:assert/strict';
import { ELEMENTS, bySymbol } from '../src/data/elements.js';
import {
  TIPOS, tieneDato, sinValencias, filtrar, valenciasAceptadas, pregunta, generar
} from '../src/lib/quiz/elements.js';

const nombreDe = e => ({ H: 'Hidrógeno', Fe: 'Hierro', Au: 'Oro', Na: 'Sodio' }[e.symbol] || e.symbol);
const etiquetaDe = (que, clave) => `${que}:${clave}`;
const ctx = { nombreDe, etiquetaDe };

test('los filtros se cruzan entre si', () => {
  const alcalinos = filtrar(ELEMENTS, { categorias: ['alcalino'] });
  assert.ok(alcalinos.every(e => e.category === 'alcalino'));
  assert.ok(alcalinos.length >= 6);

  const primeros20 = filtrar(ELEMENTS, { zDesde: 1, zHasta: 20 });
  assert.equal(primeros20.length, 20);
  assert.equal(primeros20.at(-1).symbol, 'Ca');

  // El hidrogeno es «no metal» en la fuente, no alcalino: por eso no sale.
  const cruce = filtrar(ELEMENTS, { categorias: ['alcalino'], zHasta: 20 });
  assert.deepEqual(cruce.map(e => e.symbol), ['Li', 'Na', 'K']);
});

test('filtrar por grupo, periodo y favoritos', () => {
  assert.ok(filtrar(ELEMENTS, { grupos: [17] }).every(e => e.group === 17));
  assert.ok(filtrar(ELEMENTS, { periodos: [2] }).every(e => e.period === 2));
  assert.deepEqual(filtrar(ELEMENTS, { favoritos: ['Au', 'Ag'] }).map(e => e.symbol), ['Ag', 'Au']);
});

test('sin filtros salen los 118', () => {
  assert.equal(filtrar(ELEMENTS, {}).length, 118);
});

test('un elemento sin el dato no se pregunta', () => {
  const he = bySymbol('He');
  assert.equal(he.electronegativity, null, 'el helio no tiene electronegatividad');
  assert.equal(tieneDato(he, 'electroneg'), false);
  assert.equal(tieneDato(he, 'z'), true);
  // los lantanidos no tienen grupo
  assert.equal(tieneDato(bySymbol('La'), 'grupo'), false);
});

test('los elementos sin valencias quedan fuera y se pueden listar', () => {
  const fuera = sinValencias(ELEMENTS);
  assert.deepEqual(fuera.map(e => e.symbol), ['Nh'], 'solo el nihonio, segun la fuente');
  assert.equal(tieneDato(bySymbol('Nh'), 'valencias'), false);
  assert.equal(tieneDato(bySymbol('Fe'), 'valencias'), true);
});

test('las valencias salen de los datos, y la personalizacion manda', () => {
  const fe = bySymbol('Fe');
  assert.deepEqual([...valenciasAceptadas(fe)].sort(), [2, 3]);
  assert.deepEqual(valenciasAceptadas(fe, { porElemento: { Fe: [2, 3, 6] } }), [2, 3, 6]);
  assert.deepEqual(valenciasAceptadas(fe, { porElemento: { Fe: [] } }), [], 'se puede dejar vacia a proposito');
  assert.deepEqual([...valenciasAceptadas(fe, { porElemento: { Cu: [1] } })].sort(), [2, 3], 'otra no le afecta');
});

test('cada tipo pregunta lo suyo', () => {
  const fe = bySymbol('Fe');
  assert.equal(pregunta(fe, 'simbolo', ctx).respuesta, 'Fe');
  assert.equal(pregunta(fe, 'nombre', ctx).respuesta, 'Hierro');
  assert.equal(pregunta(fe, 'z', ctx).respuesta, '26');
  assert.equal(pregunta(fe, 'masa', ctx).respuesta, 55.84);
  assert.equal(pregunta(fe, 'grupo', ctx).respuesta, '8');
  assert.equal(pregunta(fe, 'periodo', ctx).respuesta, '4');
  assert.equal(pregunta(fe, 'electroneg', ctx).respuesta, 1.83);
  assert.deepEqual([...pregunta(fe, 'valencias', ctx).respuesta].sort(), [2, 3]);
});

test('el enunciado del simbolo es el nombre, y al reves', () => {
  const au = bySymbol('Au');
  assert.equal(pregunta(au, 'simbolo', ctx).enunciado, 'Oro');
  assert.equal(pregunta(au, 'nombre', ctx).enunciado, 'Au');
});

test('categoria y estado se preguntan con opciones, no a ciegas', () => {
  const fe = bySymbol('Fe');
  assert.equal(pregunta(fe, 'categoria', ctx).formato, 'opciones');
  assert.equal(pregunta(fe, 'estado', ctx).formato, 'opciones');
});

test('generar respeta los tipos activos', () => {
  const ps = generar(ELEMENTS, { tipos: ['simbolo'], filtros: { zHasta: 10 }, ...ctx });
  assert.equal(ps.length, 10);
  assert.ok(ps.every(p => p.tipo === 'simbolo'));
});

test('generar cruza elementos y tipos, saltando lo que falta', () => {
  const ps = generar(ELEMENTS, { tipos: ['z', 'electroneg'], filtros: { zHasta: 2 }, ...ctx });
  // H tiene los dos; He no tiene electronegatividad
  assert.equal(ps.length, 3);
});

test('un tipo inventado se ignora', () => {
  const ps = generar(ELEMENTS, { tipos: ['z', 'inventado'], filtros: { zHasta: 3 }, ...ctx });
  assert.ok(ps.every(p => p.tipo === 'z'));
  assert.equal(ps.length, 3);
});

test('cada pregunta lleva de que elemento es, para el «lo que mas fallas»', () => {
  const ps = generar(ELEMENTS, { tipos: ['nombre'], filtros: { zHasta: 3 }, ...ctx });
  assert.deepEqual(ps.map(p => p.tema), ['H', 'He', 'Li']);
  assert.equal(new Set(ps.map(p => p.id)).size, 3, 'ids distintos');
});

test('todos los tipos del catalogo saben generar pregunta', () => {
  const fe = bySymbol('Fe');
  for (const tipo of TIPOS) {
    if (!tieneDato(fe, tipo)) continue;
    const p = pregunta(fe, tipo, ctx);
    assert.ok(p && p.enunciado, `${tipo} sin enunciado`);
    assert.ok(p.respuesta !== undefined && p.respuesta !== null, `${tipo} sin respuesta`);
  }
});
