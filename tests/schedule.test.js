import test from 'node:test';
import assert from 'node:assert/strict';
import {
  esHora, aMinutos, aHora, duracion, franjaValida, ordenarFranjas,
  sePisan, solapes, generarFranjas, celda, clasesDelDia,
  minutosPorDia, minutosPorAsignatura, queToca, DIAS_SEMANA
} from '../src/lib/schedule.js';

const f = (inicio, fin) => ({ inicio, fin });

test('reconoce las horas bien escritas', () => {
  for (const h of ['00:00', '08:05', '23:59', '12:30']) assert.equal(esHora(h), true, h);
  for (const h of ['24:00', '8:00', '12:60', '', null, '12:5', 'ab:cd']) assert.equal(esHora(h), false, String(h));
});

test('ida y vuelta entre horas y minutos', () => {
  assert.equal(aMinutos('08:30'), 510);
  assert.equal(aHora(510), '08:30');
  assert.equal(aMinutos('00:00'), 0);
  assert.equal(aHora(0), '00:00');
  assert.equal(aMinutos('no vale'), null);
});

test('aHora da la vuelta al pasar de las 24 horas', () => {
  assert.equal(aHora(1440), '00:00');
  assert.equal(aHora(1500), '01:00');
  assert.equal(aHora(-60), '23:00');
});

test('la duracion solo cuenta si el fin va despues del inicio', () => {
  assert.equal(duracion(f('08:00', '08:55')), 55);
  assert.equal(duracion(f('08:00', '08:00')), null, 'no dura nada');
  assert.equal(duracion(f('09:00', '08:00')), null, 'al reves');
  assert.equal(duracion(f('08:00', 'mal')), null);
  assert.equal(franjaValida(f('08:00', '09:00')), true);
  assert.equal(franjaValida(f('09:00', '08:00')), false);
});

test('ordena las franjas y tira las que no valen', () => {
  const lista = [f('10:00', '11:00'), f('08:00', '09:00'), f('12:00', '11:00')];
  assert.deepEqual(ordenarFranjas(lista).map(x => x.inicio), ['08:00', '10:00']);
});

test('detecta las franjas que se pisan', () => {
  assert.equal(sePisan(f('08:00', '09:00'), f('08:30', '09:30')), true);
  assert.equal(sePisan(f('08:00', '09:00'), f('09:00', '10:00')), false, 'pegadas no es pisarse');
  assert.equal(sePisan(f('08:00', '10:00'), f('08:30', '09:00')), true, 'una dentro de otra');
  assert.equal(solapes([f('08:00', '09:00'), f('09:00', '10:00')]).length, 0);
  assert.equal(solapes([f('08:00', '09:30'), f('09:00', '10:00')]).length, 1);
});

test('genera franjas seguidas', () => {
  const franjas = generarFranjas({ desde: '08:00', minutos: 55, cuantas: 3 });
  assert.deepEqual(franjas, [
    { inicio: '08:00', fin: '08:55' },
    { inicio: '08:55', fin: '09:50' },
    { inicio: '09:50', fin: '10:45' }
  ]);
});

test('el descanso se mete donde se pide', () => {
  const franjas = generarFranjas({ desde: '08:00', minutos: 60, cuantas: 4, descanso: 30, descansoTras: 2 });
  assert.equal(franjas[1].fin, '10:00');
  assert.equal(franjas[2].inicio, '10:30', 'media hora de descanso');
  assert.equal(franjas[3].inicio, '11:30');
});

test('generar franjas nunca pasa del tope ni acepta una hora mala', () => {
  assert.equal(generarFranjas({ cuantas: 100 }).length, 16);
  assert.deepEqual(generarFranjas({ desde: 'mal' }), []);
});

test('las franjas generadas no se pisan', () => {
  assert.equal(solapes(generarFranjas({ cuantas: 8, descanso: 20 })).length, 0);
});

test('la semana empieza en lunes y acaba en domingo', () => {
  assert.deepEqual(DIAS_SEMANA, [1, 2, 3, 4, 5, 6, 0]);
});

const FRANJAS = [f('08:00', '09:00'), f('09:00', '10:00'), f('10:00', '11:00')];
const CLASES = {
  [celda(1, 0)]: { asignaturaId: 'mates', aula: '12' },
  [celda(1, 1)]: { asignaturaId: 'lengua' },
  [celda(3, 0)]: { asignaturaId: 'mates' },
  [celda(5, 2)]: { asignaturaId: 'mates' },
  [celda(2, 0)]: { asignaturaId: '' }        // hueco, no cuenta
};

test('las clases de un dia salen en orden y sin huecos', () => {
  const lunes = clasesDelDia(CLASES, FRANJAS, 1);
  assert.deepEqual(lunes.map(x => x.clase.asignaturaId), ['mates', 'lengua']);
  assert.equal(lunes[0].franja.inicio, '08:00');
  assert.equal(clasesDelDia(CLASES, FRANJAS, 2).length, 0, 'la celda vacia no cuenta');
  assert.equal(clasesDelDia(CLASES, FRANJAS, 0).length, 0, 'domingo libre');
});

test('minutos de clase por dia', () => {
  const porDia = minutosPorDia(CLASES, FRANJAS);
  assert.equal(porDia.get(1), 120);
  assert.equal(porDia.get(3), 60);
  assert.equal(porDia.get(5), 60);
  assert.equal(porDia.has(2), false, 'los dias sin clase no aparecen');
  assert.equal(porDia.has(0), false);
});

test('minutos semanales por asignatura', () => {
  const porAsig = minutosPorAsignatura(CLASES, FRANJAS);
  assert.equal(porAsig.get('mates'), 180, 'tres horas');
  assert.equal(porAsig.get('lengua'), 60);
  assert.equal(porAsig.has(''), false);
});

test('que toca ahora y que toca despues', () => {
  const lunes = (h, m) => new Date(2026, 2, 16, h, m);   // lunes
  let r = queToca(CLASES, FRANJAS, lunes(8, 30));
  assert.equal(r.ahora.clase.asignaturaId, 'mates');
  assert.equal(r.siguiente.clase.asignaturaId, 'lengua');

  r = queToca(CLASES, FRANJAS, lunes(9, 0));
  assert.equal(r.ahora.clase.asignaturaId, 'lengua', 'el minuto de cambio ya es la siguiente');
  assert.equal(r.siguiente, null, 'no queda nada mas ese dia');

  r = queToca(CLASES, FRANJAS, lunes(7, 0));
  assert.equal(r.ahora, null, 'todavia no ha empezado');
  assert.equal(r.siguiente.clase.asignaturaId, 'mates');

  r = queToca(CLASES, FRANJAS, lunes(23, 0));
  assert.equal(r.ahora, null);
  assert.equal(r.siguiente, null);
});

test('un dia sin clases no tiene ni ahora ni siguiente', () => {
  const domingo = new Date(2026, 2, 15, 10, 0);
  assert.deepEqual(queToca(CLASES, FRANJAS, domingo), { ahora: null, siguiente: null });
});
