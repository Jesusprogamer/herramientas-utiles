import test from 'node:test';
import assert from 'node:assert/strict';
import {
  aFecha, aDia, diasHasta, valido, ordenar, proximos, pasados,
  porDia, cuandoClave, urgencia
} from '../src/lib/agenda.js';

const AHORA = new Date(2026, 2, 14, 15, 0);           // sábado 14 de marzo de 2026
const ex = (dia, hora = null, extra = {}) => ({ dia, hora, titulo: `Examen ${dia}`, ...extra });

test('aFecha entiende dia y hora', () => {
  const f = aFecha('2026-03-14', '09:30');
  assert.equal(f.getFullYear(), 2026);
  assert.equal(f.getMonth(), 2);
  assert.equal(f.getDate(), 14);
  assert.equal(f.getHours(), 9);
  assert.equal(f.getMinutes(), 30);
});

test('sin hora se queda a medianoche local', () => {
  const f = aFecha('2026-03-14');
  assert.equal(f.getHours(), 0);
  assert.equal(f.getMinutes(), 0);
});

test('una fecha que no vale devuelve null', () => {
  assert.equal(aFecha(''), null);
  assert.equal(aFecha('no-es-fecha'), null);
  assert.equal(aFecha(null), null);
});

test('aDia y aFecha son la ida y la vuelta', () => {
  for (const dia of ['2026-01-01', '2026-03-14', '2026-12-31']) {
    assert.equal(aDia(aFecha(dia)), dia);
  }
});

test('los dias se cuentan por calendario, no por horas', () => {
  assert.equal(diasHasta('2026-03-14', AHORA), 0, 'hoy');
  assert.equal(diasHasta('2026-03-15', AHORA), 1, 'manana');
  assert.equal(diasHasta('2026-03-13', AHORA), -1, 'ayer');
  assert.equal(diasHasta('2026-03-21', AHORA), 7);
  // a las once de la noche, manana a las ocho sigue siendo manana
  assert.equal(diasHasta('2026-03-15', new Date(2026, 2, 14, 23, 0)), 1);
});

test('el cambio de hora no descuadra la cuenta', () => {
  // en España el horario de verano empieza el 29 de marzo de 2026
  assert.equal(diasHasta('2026-03-30', new Date(2026, 2, 28, 12, 0)), 2);
  assert.equal(diasHasta('2026-04-01', new Date(2026, 2, 29, 12, 0)), 3);
});

test('un examen necesita fecha y algo que lo identifique', () => {
  assert.equal(valido(ex('2026-03-14')), true);
  assert.equal(valido({ dia: '2026-03-14', asignaturaId: 'a1' }), true);
  assert.equal(valido({ dia: '2026-03-14', titulo: '   ' }), false);
  assert.equal(valido({ titulo: 'Sin fecha' }), false);
  assert.equal(valido(null), false);
});

test('ordena por dia y, dentro del dia, por hora', () => {
  const lista = [ex('2026-03-15', '12:00'), ex('2026-03-14', '16:00'), ex('2026-03-14', '09:00')];
  assert.deepEqual(ordenar(lista).map(e => `${e.dia} ${e.hora}`),
    ['2026-03-14 09:00', '2026-03-14 16:00', '2026-03-15 12:00']);
});

test('los que no tienen hora van primero ese dia', () => {
  const lista = [ex('2026-03-14', '09:00'), ex('2026-03-14', null)];
  assert.equal(ordenar(lista)[0].hora, null);
});

test('proximos incluye hoy y deja fuera lo pasado', () => {
  const lista = [ex('2026-03-13'), ex('2026-03-14'), ex('2026-03-20')];
  assert.deepEqual(proximos(lista, AHORA).map(e => e.dia), ['2026-03-14', '2026-03-20']);
});

test('proximos respeta el limite', () => {
  const lista = [ex('2026-03-14'), ex('2026-03-15'), ex('2026-03-16')];
  assert.equal(proximos(lista, AHORA, 2).length, 2);
  assert.deepEqual(proximos(lista, AHORA, 2).map(e => e.dia), ['2026-03-14', '2026-03-15']);
});

test('pasados va del mas reciente al mas antiguo', () => {
  const lista = [ex('2026-03-01'), ex('2026-03-13'), ex('2026-03-20')];
  assert.deepEqual(pasados(lista, AHORA).map(e => e.dia), ['2026-03-13', '2026-03-01']);
});

test('los examenes sin fecha no se cuelan por ningun lado', () => {
  const lista = [ex('2026-03-20'), { titulo: 'Sin fecha' }, { dia: 'nada' }];
  assert.equal(proximos(lista, AHORA).length, 1);
  assert.equal(pasados(lista, AHORA).length, 0);
});

test('porDia agrupa conservando el orden', () => {
  const grupos = porDia([ex('2026-03-15'), ex('2026-03-14', '09:00'), ex('2026-03-14', '16:00')]);
  assert.deepEqual(grupos.map(g => g.dia), ['2026-03-14', '2026-03-15']);
  assert.equal(grupos[0].examenes.length, 2);
  assert.equal(grupos[1].examenes.length, 1);
});

test('la clave del texto depende de los dias que falten', () => {
  assert.equal(cuandoClave(0), 'hoy');
  assert.equal(cuandoClave(1), 'manana');
  assert.equal(cuandoClave(5), 'enDias');
  assert.equal(cuandoClave(-2), 'pasado');
  assert.equal(cuandoClave(null), null);
});

test('la urgencia marca hoy y los tres dias siguientes', () => {
  assert.equal(urgencia(0), 'hoy');
  assert.equal(urgencia(1), 'pronto');
  assert.equal(urgencia(3), 'pronto');
  assert.equal(urgencia(4), 'lejos');
  assert.equal(urgencia(-1), 'lejos');
  assert.equal(urgencia(null), 'lejos');
});
