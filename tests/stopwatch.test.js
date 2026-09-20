import test from 'node:test';
import assert from 'node:assert/strict';
import { transcurrido, restante, vueltasConParcial, formatClock, formatCrono } from '../src/lib/stopwatch.js';

/* Reloj falso: el modulo recibe la hora por parametro, asi que las pruebas
   no dependen del tiempo real ni de esperas. */
const T0 = 1_700_000_000_000;

test('un cronometro en pausa devuelve lo acumulado', () => {
  assert.equal(transcurrido({ running: false, acumulado: 5000, startedAt: T0 }, T0 + 99999), 5000);
  assert.equal(transcurrido({ running: false, acumulado: 0 }, T0), 0);
});

test('un cronometro en marcha suma desde su arranque', () => {
  const crono = { running: true, startedAt: T0, acumulado: 0 };
  assert.equal(transcurrido(crono, T0), 0);
  assert.equal(transcurrido(crono, T0 + 1500), 1500);
  assert.equal(transcurrido(crono, T0 + 3600000), 3600000);
});

test('tras pausar y reanudar se sigue sumando sobre lo de antes', () => {
  const crono = { running: true, startedAt: T0 + 10000, acumulado: 5000 };
  assert.equal(transcurrido(crono, T0 + 12000), 7000, '5 s de antes + 2 s nuevos');
});

test('un cronometro nunca da tiempo negativo ni cuenta hacia atras', () => {
  const crono = { running: true, startedAt: T0, acumulado: 0 };
  assert.equal(transcurrido(crono, T0 - 5000), 0, 'si el reloj retrocede, se queda a cero');
  assert.equal(transcurrido({ running: false, acumulado: -10 }, T0), 0);
});

test('lo acumulado se mantiene aunque falte startedAt', () => {
  assert.equal(transcurrido({ running: true, acumulado: 2000 }, T0), 2000);
});

test('la cuenta atras se mide contra la hora real', () => {
  const cuenta = { running: true, endsAt: T0 + 60000, remainingMs: 60000 };
  assert.equal(restante(cuenta, T0), 60000);
  assert.equal(restante(cuenta, T0 + 59000), 1000);
});

test('la cuenta atras no pasa de cero aunque se llegue tarde', () => {
  const cuenta = { running: true, endsAt: T0, remainingMs: 60000 };
  assert.equal(restante(cuenta, T0 + 3600000), 0, 'la app estuvo cerrada una hora');
});

test('en pausa manda lo que quedaba, no la hora de fin', () => {
  assert.equal(restante({ running: false, endsAt: T0, remainingMs: 12345 }, T0 + 999999), 12345);
  assert.equal(restante({ running: false }, T0), 0);
});

test('las vueltas traen su parcial y van de la ultima a la primera', () => {
  const v = vueltasConParcial([1000, 2500, 6000]);
  assert.deepEqual(v.map(x => x.n), [3, 2, 1]);
  assert.deepEqual(v.map(x => x.parcial), [3500, 1500, 1000]);
  assert.deepEqual(v.map(x => x.total), [6000, 2500, 1000]);
});

test('una sola vuelta tiene el parcial igual al total', () => {
  assert.deepEqual(vueltasConParcial([4200]), [{ n: 1, total: 4200, parcial: 4200 }]);
});

test('sin vueltas no hay lista, y una entrada rara no rompe', () => {
  assert.deepEqual(vueltasConParcial([]), []);
  assert.deepEqual(vueltasConParcial(null), []);
  assert.deepEqual(vueltasConParcial(undefined), []);
});

test('el reloj de la cuenta atras redondea hacia arriba', () => {
  assert.equal(formatClock(0), '00:00');
  assert.equal(formatClock(1), '00:01', 'un milisegundo todavia es un segundo');
  assert.equal(formatClock(1000), '00:01');
  assert.equal(formatClock(59_000), '00:59');
  assert.equal(formatClock(60_000), '01:00');
  assert.equal(formatClock(3_600_000), '1:00:00');
  assert.equal(formatClock(3_661_000), '1:01:01');
  assert.equal(formatClock(-5000), '00:00');
});

test('el cronometro muestra centesimas', () => {
  assert.equal(formatCrono(0), '00:00,00');
  assert.equal(formatCrono(1234), '00:01,23');
  assert.equal(formatCrono(59_999), '00:59,99');
  assert.equal(formatCrono(60_000), '01:00,00');
  assert.equal(formatCrono(3_661_500), '1:01:01,50');
  assert.equal(formatCrono(-10), '00:00,00');
});

test('el cronometro trunca las centesimas, no las redondea', () => {
  assert.equal(formatCrono(1999), '00:01,99', 'no salta a 2,00 antes de tiempo');
});
