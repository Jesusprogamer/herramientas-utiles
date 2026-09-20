import test from 'node:test';
import assert from 'node:assert/strict';
import {
  redondear, media, notaAcumulada, pesoHecho, pesoTotal,
  notaNecesaria, revisarPesos, resumen, mediaGeneral
} from '../src/lib/grades.js';

const n = (valor, peso) => ({ valor, peso });

test('redondear no arrastra los errores de la coma flotante', () => {
  assert.equal(redondear(0.1 + 0.2), 0.3);
  assert.equal(redondear(5.005, 2), 5.01);
  assert.equal(redondear(1 / 3, 4), 0.3333);
});

test('media ponderada de lo ya evaluado', () => {
  assert.equal(media([n(8, 50), n(6, 50)]), 7);
  assert.equal(media([n(10, 70), n(5, 30)]), 8.5);
  assert.equal(media([n(7, 100)]), 7);
});

test('la media ignora lo que aun no tiene nota', () => {
  assert.equal(media([n(8, 40), n(null, 60)]), 8, 'solo cuenta lo puesto');
  assert.equal(media([n(8, 40), { peso: 60 }]), 8);
  assert.equal(media([n(9, 0), n(5, 50)]), 5, 'peso cero no cuenta');
});

test('sin ninguna nota puesta no hay media', () => {
  assert.equal(media([]), null);
  assert.equal(media([n(null, 50), n(undefined, 50)]), null);
  assert.equal(media([n(8, 0)]), null);
});

test('pesoHecho y pesoTotal se distinguen', () => {
  const notas = [n(8, 40), n(null, 60)];
  assert.equal(pesoHecho(notas), 40);
  assert.equal(pesoTotal(notas), 100);
});

test('la nota acumulada cuenta lo pendiente como un cero', () => {
  assert.equal(notaAcumulada([n(10, 40)], 100), 4, 'un 10 que solo vale el 40 %');
  assert.equal(notaAcumulada([n(10, 40), n(10, 60)], 100), 10);
  assert.equal(notaAcumulada([], 100), 0);
});

test('que nota hace falta para aprobar', () => {
  // 40 % hecho con un 4; quedan 60 puntos de peso y hacen falta 500 - 160 = 340
  const r = notaNecesaria([n(4, 40)], 5, { total: 100, maximo: 10 });
  assert.equal(r.estado, 'necesitas');
  assert.equal(r.necesaria, 5.67);
  assert.equal(r.holgada, false);
});

test('cuando ya esta conseguido, lo dice', () => {
  const r = notaNecesaria([n(9, 60)], 5, { total: 100 });
  assert.equal(r.estado, 'conseguido', '9 sobre el 60 % ya da 540 de 500');
});

test('cuando no se puede, lo dice y ensena cuanto faltaba', () => {
  const r = notaNecesaria([n(2, 70)], 5, { total: 100, maximo: 10 });
  assert.equal(r.estado, 'imposible');
  assert.ok(r.necesaria > 10);
});

test('si no queda nada por evaluar tambien lo dice', () => {
  assert.equal(notaNecesaria([n(6, 100)], 5).estado, 'nadaPendiente');
});

test('marca como holgada la nota que se consigue de sobra', () => {
  // 50 % hecho con un 7: quedan 150 puntos sobre 50 de peso -> basta un 3
  const r = notaNecesaria([n(7, 50)], 5, { total: 100, maximo: 10 });
  assert.equal(r.estado, 'necesitas');
  assert.equal(r.necesaria, 3);
  assert.equal(r.holgada, true);
  // justo por encima de la mitad ya no es holgada
  assert.equal(notaNecesaria([n(4, 40)], 5, { total: 100, maximo: 10 }).holgada, false);
});

test('la revision de pesos detecta si falta o si se pasa', () => {
  assert.deepEqual(revisarPesos([n(8, 50), n(6, 50)]), { suma: 100, estado: 'exacto', diferencia: 0 });
  assert.equal(revisarPesos([n(8, 50)]).estado, 'falta');
  assert.equal(revisarPesos([n(8, 50)]).diferencia, -50);
  assert.equal(revisarPesos([n(8, 70), n(6, 50)]).estado, 'pasa');
  assert.equal(revisarPesos([n(8, 70), n(6, 50)]).diferencia, 20);
});

test('resumen junta todo lo que ensena la pantalla', () => {
  const r = resumen([n(7, 30), n(null, 70)], { objetivo: 5, total: 100, maximo: 10 });
  assert.equal(r.media, 7);
  assert.equal(r.acumulada, 2.1);
  assert.equal(r.pesoHecho, 30);
  assert.equal(r.pesoPendiente, 70);
  assert.equal(r.pesos.estado, 'exacto');
  assert.equal(r.objetivo.estado, 'necesitas');
  assert.equal(r.objetivo.necesaria, 4.14);
  assert.equal(r.aprobada, true, 'la media de lo hecho ya aprueba');
});

test('media general de varias asignaturas', () => {
  const a = [{ notas: [n(8, 100)] }, { notas: [n(6, 100)] }];
  assert.equal(mediaGeneral(a), 7);
  assert.equal(mediaGeneral([{ notas: [n(8, 100)], peso: 3 }, { notas: [n(4, 100)], peso: 1 }]), 7);
  assert.equal(mediaGeneral([{ notas: [] }]), null, 'sin notas no hay media');
  assert.equal(mediaGeneral([{ notas: [n(8, 100)] }, { notas: [] }]), 8, 'ignora las vacias');
});
