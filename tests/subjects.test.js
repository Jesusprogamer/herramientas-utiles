import test from 'node:test';
import assert from 'node:assert/strict';
import * as subjects from '../src/core/subjects.js';
import { on } from '../src/core/events.js';

/* Sin navegador, storage cae al respaldo en memoria: justo lo que hace
   falta para probar la logica sin depender de localStorage. */
const limpiar = () => { for (const a of subjects.all()) subjects.remove(a.id); };

test('empieza vacio y anade asignaturas', () => {
  limpiar();
  assert.deepEqual(subjects.all(), []);
  const mates = subjects.add('Matemáticas');
  assert.equal(mates.nombre, 'Matemáticas');
  assert.ok(mates.id);
  assert.ok(subjects.COLORES.includes(mates.color));
  assert.equal(subjects.all().length, 1);
});

test('los ids no se repiten', () => {
  limpiar();
  const ids = new Set();
  for (let i = 0; i < 25; i++) ids.add(subjects.add(`Asignatura ${i}`).id);
  assert.equal(ids.size, 25);
});

test('el nombre se limpia y se recorta', () => {
  limpiar();
  assert.equal(subjects.add('  Lengua   y   Literatura  ').nombre, 'Lengua y Literatura');
  const largo = subjects.add('x'.repeat(200));
  assert.equal(largo.nombre.length, subjects.MAX_NOMBRE);
});

test('un nombre vacio no crea nada', () => {
  limpiar();
  assert.equal(subjects.add(''), null);
  assert.equal(subjects.add('   '), null);
  assert.equal(subjects.add(null), null);
  assert.equal(subjects.all().length, 0);
});

test('hay un tope de asignaturas', () => {
  limpiar();
  for (let i = 0; i < subjects.MAX_ASIGNATURAS; i++) subjects.add(`A${i}`);
  assert.equal(subjects.all().length, subjects.MAX_ASIGNATURAS);
  assert.equal(subjects.add('una mas'), null);
  assert.equal(subjects.all().length, subjects.MAX_ASIGNATURAS);
});

test('el color sugerido evita repetir mientras quedan libres', () => {
  limpiar();
  const usados = new Set();
  for (let i = 0; i < subjects.COLORES.length; i++) {
    const c = subjects.colorSugerido();
    assert.ok(!usados.has(c), `${c} repetido`);
    usados.add(c);
    subjects.add(`A${i}`, c);
  }
});

test('byId y nombreDe', () => {
  limpiar();
  const fisica = subjects.add('Física');
  assert.equal(subjects.byId(fisica.id).nombre, 'Física');
  assert.equal(subjects.byId('no-existe'), null);
  assert.equal(subjects.nombreDe(fisica.id), 'Física');
  assert.equal(subjects.nombreDe('no-existe', 'Sin asignatura'), 'Sin asignatura');
});

test('all() devuelve copias: tocarlas no cambia el original', () => {
  limpiar();
  const a = subjects.add('Historia');
  const copia = subjects.all()[0];
  copia.nombre = 'Cambiado';
  assert.equal(subjects.byId(a.id).nombre, 'Historia');
});

test('update cambia nombre y color, y rechaza el nombre vacio', () => {
  limpiar();
  const a = subjects.add('Ingles', 'azul');
  subjects.update(a.id, { nombre: 'Inglés', color: 'verde' });
  assert.equal(subjects.byId(a.id).nombre, 'Inglés');
  assert.equal(subjects.byId(a.id).color, 'verde');
  assert.equal(subjects.update(a.id, { nombre: '  ' }), null);
  assert.equal(subjects.byId(a.id).nombre, 'Inglés', 'no se ha estropeado');
  assert.equal(subjects.update('no-existe', { nombre: 'X' }), null);
});

test('un color que no existe no se acepta', () => {
  limpiar();
  const a = subjects.add('Arte', 'fucsia-inventado');
  assert.ok(subjects.COLORES.includes(a.color));
  subjects.update(a.id, { color: 'otro-inventado' });
  assert.ok(subjects.COLORES.includes(subjects.byId(a.id).color));
});

test('remove quita solo la que toca', () => {
  limpiar();
  const a = subjects.add('A'); const b = subjects.add('B');
  assert.equal(subjects.remove(a.id), true);
  assert.equal(subjects.remove(a.id), false, 'ya no estaba');
  assert.deepEqual(subjects.all().map(x => x.id), [b.id]);
});

test('move reordena sin salirse de los bordes', () => {
  limpiar();
  const a = subjects.add('A'); const b = subjects.add('B'); const c = subjects.add('C');
  assert.equal(subjects.move(c.id, -1), true);
  assert.deepEqual(subjects.all().map(x => x.nombre), ['A', 'C', 'B']);
  assert.equal(subjects.move(a.id, -1), false, 'ya es la primera');
  assert.equal(subjects.move(b.id, 1), false, 'ya es la ultima');
  assert.equal(subjects.move('no-existe', 1), false);
  assert.deepEqual(subjects.all().map(x => x.nombre), ['A', 'C', 'B']);
});

test('cada cambio avisa por el bus de eventos', () => {
  limpiar();
  let avisos = 0;
  const off = on('asignaturas:change', () => { avisos += 1; });
  const a = subjects.add('Quimica');
  subjects.update(a.id, { nombre: 'Química' });
  subjects.move(a.id, 1);      // no se mueve: no avisa
  subjects.remove(a.id);
  off();
  assert.equal(avisos, 3);
});

test('lo guardado a medias se sanea al cargar', async () => {
  const storage = await import('../src/core/storage.js');
  storage.set('asignaturas', [
    { id: 'x1', nombre: 'Buena', color: 'verde' },
    { nombre: 'Sin id, pero vale' },
    { id: 'x2', nombre: '   ' },
    { id: 'x1', nombre: 'Id repetido' },
    'esto no es una asignatura',
    { id: 'x3', nombre: 'Color raro', color: 'no-existe' }
  ]);
  const cargadas = subjects.load();
  assert.deepEqual(cargadas.map(a => a.nombre), ['Buena', 'Sin id, pero vale', 'Color raro']);
  assert.ok(cargadas.every(a => a.id && subjects.COLORES.includes(a.color)));
});
