import test from 'node:test';
import assert from 'node:assert/strict';
import {
  barajar, tomar, opciones, crear, actual, responder,
  resultado, soloFallos, puntosFlacos, alHistorial, MAX_HISTORIAL
} from '../src/lib/quiz/session.js';

/* Azar fijo: siempre 0, asi el barajado es predecible en las pruebas. */
const cero = () => 0;
const P = n => ({ id: `p${n}`, tipo: 'nombre', tema: `e${n}` });

test('barajar no pierde ni inventa elementos', () => {
  const lista = [1, 2, 3, 4, 5];
  const mezclada = barajar(lista, cero);
  assert.equal(mezclada.length, 5);
  assert.deepEqual([...mezclada].sort(), [...lista].sort());
  assert.deepEqual(lista, [1, 2, 3, 4, 5], 'no toca el original');
});

test('tomar coge como mucho los que hay', () => {
  assert.equal(tomar([1, 2, 3], 2, cero).length, 2);
  assert.equal(tomar([1, 2, 3], 10, cero).length, 3);
  assert.equal(tomar([1, 2, 3], 0, cero).length, 3, 'sin limite, todas');
});

test('las opciones multiples llevan la correcta y no repiten', () => {
  const ops = opciones('Oro', ['Oro', 'Plata', 'Cobre', 'Hierro', 'Plomo'], 4, cero);
  assert.equal(ops.length, 4);
  assert.ok(ops.includes('Oro'));
  assert.equal(new Set(ops).size, 4, 'sin repetidas');
});

test('si no hay senuelos suficientes, no se inventan', () => {
  const ops = opciones('Oro', ['Oro', 'Plata'], 4, cero);
  assert.deepEqual([...ops].sort(), ['Oro', 'Plata']);
});

test('una sesion empieza en la primera pregunta', () => {
  const s = crear([P(1), P(2)], { ahora: 1000 });
  assert.equal(actual(s).id, 'p1');
  assert.equal(s.terminada, false);
});

test('responder avanza y anota el tiempo', () => {
  let s = crear([P(1), P(2)], { ahora: 1000 });
  s = responder(s, { dada: 'Oro', acierto: true, ahora: 3500 });
  assert.equal(s.respuestas.length, 1);
  assert.equal(s.respuestas[0].ms, 2500);
  assert.equal(actual(s).id, 'p2');
  assert.equal(s.terminada, false);
});

test('al responder la ultima, la sesion termina', () => {
  let s = crear([P(1)], { ahora: 0 });
  s = responder(s, { dada: 'x', acierto: false, ahora: 100 });
  assert.equal(s.terminada, true);
  assert.equal(actual(s), null);
});

test('saltar cuenta como fallo', () => {
  let s = crear([P(1)], { ahora: 0 });
  s = responder(s, { dada: '', acierto: true, saltada: true, ahora: 100 });
  assert.equal(s.respuestas[0].acierto, false, 'aunque venga acierto true');
  assert.equal(s.respuestas[0].saltada, true);
});

test('responder en una sesion terminada no hace nada', () => {
  let s = crear([P(1)], { ahora: 0 });
  s = responder(s, { dada: 'x', acierto: true, ahora: 10 });
  const igual = responder(s, { dada: 'y', acierto: true, ahora: 20 });
  assert.equal(igual.respuestas.length, 1);
});

test('el resultado cuenta aciertos, fallos y porcentaje', () => {
  let s = crear([P(1), P(2), P(3), P(4)], { ahora: 0 });
  s = responder(s, { dada: 'a', acierto: true, ahora: 1000 });
  s = responder(s, { dada: 'b', acierto: false, ahora: 3000 });
  s = responder(s, { dada: 'c', acierto: true, ahora: 4000 });
  s = responder(s, { dada: '', acierto: false, saltada: true, ahora: 5000 });
  const r = resultado(s);
  assert.equal(r.total, 4);
  assert.equal(r.aciertos, 2);
  assert.equal(r.fallos, 2);
  assert.equal(r.saltadas, 1);
  assert.equal(r.porcentaje, 50);
  assert.equal(r.mediaMs, 1250);
});

test('una sesion sin responder nada no divide entre cero', () => {
  const r = resultado(crear([P(1)], { ahora: 0 }));
  assert.equal(r.porcentaje, 0);
  assert.equal(r.mediaMs, 0);
});

test('soloFallos devuelve las preguntas falladas, para repasarlas', () => {
  let s = crear([P(1), P(2)], { ahora: 0 });
  s = responder(s, { dada: 'a', acierto: true, ahora: 10 });
  s = responder(s, { dada: 'b', acierto: false, ahora: 20 });
  assert.deepEqual(soloFallos(s).map(p => p.id), ['p2']);
});

test('«lo que mas fallas» ordena de mas a menos', () => {
  const historial = [
    { fallos: [{ tipo: 'valencias', tema: 'Fe' }, { tipo: 'valencias', tema: 'Cu' }] },
    { fallos: [{ tipo: 'valencias', tema: 'Fe' }, { tipo: 'masa', tema: 'Au' }] }
  ];
  const { porTipo, porTema } = puntosFlacos(historial);
  assert.deepEqual(porTipo[0], { clave: 'valencias', veces: 3 });
  assert.deepEqual(porTema[0], { clave: 'Fe', veces: 2 });
});

test('el historial se queda con las ultimas 50', () => {
  let historial = [];
  for (let i = 0; i < 60; i++) historial = alHistorial(historial, { n: i });
  assert.equal(historial.length, MAX_HISTORIAL);
  assert.equal(historial[0].n, 59, 'la mas reciente va primera');
  assert.equal(historial.at(-1).n, 10);
});
