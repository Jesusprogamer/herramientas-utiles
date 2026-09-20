import test from 'node:test';
import assert from 'node:assert/strict';
import { FORMULAS, byId, resolver } from '../src/data/formulas.js';
import {
  TIPOS, conUnidad, ejercicio, filtrar, pregunta, generar
} from '../src/lib/quiz/formulas.js';

/** Azar de mentira: una secuencia fija, para que las pruebas no bailen. */
const azarFijo = (valores = [0.1, 0.5, 0.9, 0.3, 0.7]) => {
  let i = 0;
  return () => valores[i++ % valores.length];
};

const textos = {
  nombre: f => `nombre:${f.id}`,
  variable: n => ({ A: 'Área', b: 'Base', h: 'Altura', a: 'Cateto / Aceleración' }[n] || `var:${n}`),
  unidad: u => ({ m: 'm', m2: 'm²', s: 's' }[u] || u),
  numero: x => String(x),
  frase: (clave, params) => `${clave}(${Object.entries(params).map(([k, v]) => `${k}=${v}`).join('|')})`
};

const ctx = { textos, azar: azarFijo() };

test('filtrar cruza grupo y favoritas', () => {
  const planas = filtrar(FORMULAS, { grupos: ['plana'] });
  assert.ok(planas.length >= 6);
  assert.ok(planas.every(f => f.grupo === 'plana'));

  const favs = filtrar(FORMULAS, { favoritas: ['ohm', 'imc'] });
  assert.deepEqual(favs.map(f => f.id).sort(), ['imc', 'ohm']);

  // Los dos a la vez: solo lo que cumpla ambos.
  assert.equal(filtrar(FORMULAS, { grupos: ['plana'], favoritas: ['ohm'] }).length, 0);
});

test('conUnidad deja fuera las variables sin unidad', () => {
  for (const f of FORMULAS) {
    assert.ok(conUnidad(f).every(v => v.unidad));
  }
  assert.ok(conUnidad(byId('areaTriangulo')).length >= 3);
});

test('el ejercicio inventa valores y su despeje cuadra', () => {
  const azar = azarFijo([0.2, 0.4, 0.6, 0.8]);
  for (const f of FORMULAS) {
    const e = ejercicio(f, azar);
    if (!e) continue;                       // alguna puede no salir: no pasa nada
    assert.ok(Number.isFinite(e.valor));
    // El resultado es el mismo que da el despeje con esos valores.
    const r = resolver(f, e.incognita, e.valores);
    assert.equal(r.error, undefined);
    assert.equal(r.valor, e.valor);
    // Y no faltan datos: todas las demas variables tienen valor.
    for (const v of f.vars) {
      if (v.n === e.incognita) continue;
      assert.ok(Number.isFinite(e.valores[v.n]), `${f.id} sin valor para ${v.n}`);
    }
  }
});

test('los valores fijos de la formula no se inventan', () => {
  const peso = byId('peso');
  const e = ejercicio(peso, azarFijo([0.3]), { incognita: 'P' });
  assert.equal(e.valores.g, 9.81);
});

test('el ejercicio respeta la incognita pedida', () => {
  const e = ejercicio(byId('areaTriangulo'), azarFijo([0.5]), { incognita: 'h' });
  assert.equal(e.incognita, 'h');
  assert.ok(!('h' in e.valores));
});

test('la expresion se pregunta siempre con opciones', () => {
  const p = pregunta(byId('areaTriangulo'), 'expresion', { ...ctx, formato: 'escribir' });
  assert.equal(p.formato, 'opciones');
  assert.equal(p.respuesta, 'A = (b · h) / 2');
  assert.equal(p.clase, 'texto');
});

test('el nombre de la formula se pregunta por su expresion', () => {
  const p = pregunta(byId('ohm'), 'nombre', ctx);
  assert.equal(p.enunciado, 'V = I · R');
  assert.equal(p.respuesta, 'nombre:ohm');
});

test('una letra con dos significados admite cualquiera de los dos', () => {
  const p = pregunta(byId('pitagoras'), 'variable', { ...ctx, azar: () => 0.5 });
  assert.equal(p.clase, 'texto');
  assert.ok(p.aceptadas.includes(p.respuesta));
  const doble = pregunta(byId('segundaNewton'), 'variable', { ...ctx, azar: () => 0.99 });
  if (doble.respuesta.includes('/')) {
    assert.ok(doble.aceptadas.includes('Cateto'));
    assert.ok(doble.aceptadas.includes('Aceleración'));
  }
});

test('la unidad sale de una variable que tenga unidad', () => {
  const p = pregunta(byId('areaTriangulo'), 'unidad', { ...ctx, azar: () => 0 });
  assert.equal(p.clase, 'unidad');
  assert.equal(p.respuesta, 'm²');
});

test('el ejercicio de calcular lleva los datos en el enunciado', () => {
  const p = pregunta(byId('areaRectangulo'), 'calcular', { ...ctx, azar: azarFijo([0.5]) });
  assert.equal(p.clase, 'numero');
  assert.ok(Number.isFinite(p.respuesta));
  assert.ok(p.pide.startsWith('quiz.pide.calcular('));
  // Los datos que se dan no incluyen la incognita.
  const incognita = p.id.split(':').at(-1);
  assert.ok(!p.enunciado.includes(`${incognita} =`));
});

test('generar respeta los tipos activos y no repite ids', () => {
  const todas = generar(FORMULAS, { tipos: TIPOS, ...ctx });
  assert.ok(todas.length > 100);
  assert.ok(todas.every(p => TIPOS.includes(p.tipo)));
  assert.equal(new Set(todas.map(p => p.id)).size, todas.length);

  const soloNombres = generar(FORMULAS, { tipos: ['nombre'], ...ctx });
  assert.equal(soloNombres.length, FORMULAS.length);
  assert.ok(soloNombres.every(p => p.tipo === 'nombre'));

  // Un tipo que no existe se ignora, no revienta.
  assert.deepEqual(generar(FORMULAS, { tipos: ['inventado'], ...ctx }), []);
});

test('generar filtra por grupo', () => {
  const planas = generar(FORMULAS, { tipos: ['nombre'], filtros: { grupos: ['plana'] }, ...ctx });
  assert.ok(planas.every(p => p.grupo === 'plana'));
  assert.ok(planas.length >= 6);
});

test('toda pregunta generada se puede leer', () => {
  for (const p of generar(FORMULAS, { tipos: TIPOS, ...ctx })) {
    assert.ok(p.pide && typeof p.pide === 'string', `${p.id} sin frase`);
    assert.ok(p.respuesta !== undefined && p.respuesta !== '', `${p.id} sin respuesta`);
    assert.ok(p.tema, `${p.id} sin tema`);
  }
});
