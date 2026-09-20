import test from 'node:test';
import assert from 'node:assert/strict';
import { FORMULAS, GRUPOS, byId, despejables, resolver } from '../src/data/formulas.js';
import { filtrar } from '../src/tools/formulario/pure.js';

const nombreDe = f => f.id;
const casi = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} != ${b}`);
const calcula = (id, incognita, valores) => {
  const r = resolver(byId(id), incognita, valores);
  assert.equal(r.error, undefined, `${id}/${incognita}: ${r.error}`);
  return r.valor;
};

test('el catalogo esta bien formado', () => {
  assert.ok(FORMULAS.length >= 30);
  assert.equal(new Set(FORMULAS.map(f => f.id)).size, FORMULAS.length, 'ids repetidos');
  for (const f of FORMULAS) {
    assert.ok(GRUPOS.includes(f.grupo), `${f.id} grupo ${f.grupo}`);
    assert.ok(f.expr.length > 2, `${f.id} sin expresion`);
    assert.ok(f.vars.length >= 2, `${f.id} con menos de dos variables`);
    assert.equal(new Set(f.vars.map(v => v.n)).size, f.vars.length, `${f.id} variables repetidas`);
    for (const n of despejables(f)) {
      assert.ok(f.vars.some(v => v.n === n), `${f.id} despeja ${n}, que no es variable suya`);
    }
  }
});

test('cada despeje devuelve el valor que entro (ida y vuelta)', () => {
  // valores de prueba por variable, elegidos para que ninguna formula degenere
  const BASE = {
    A: 12, l: 3, b: 4, h: 5, r: 2, L: 10, B: 6, c: 7, a: 3, V: 30, A_b: 6,
    d: 100, v: 20, t: 5, v0: 2, x: 50, x0: 10, g: 9.81, F: 40, m: 8, P: 60,
    p: 2, rho: 1.2, Ec: 100, Ep: 90, W: 200, I: 3, R: 4, Q: 15, n: 2, M: 18,
    Mc: 0.5, T: 300, C: 1000, C_f: 1200, real: 25, plano: 5, escala: 500, IMC: 22
  };

  for (const f of FORMULAS) {
    for (const incognita of despejables(f)) {
      // 1) partimos de valores coherentes: calculamos la incognita
      const entrada = {};
      for (const v of f.vars) entrada[v.n] = f.valores?.[v.n] ?? BASE[v.n];
      const primero = resolver(f, incognita, entrada);
      if (primero.error) continue;   // combinacion imposible con estos valores de prueba
      entrada[incognita] = primero.valor;

      // 2) ahora despejamos cada una de las otras y tiene que volver su valor
      for (const otra of despejables(f)) {
        if (otra === incognita) continue;
        const r = resolver(f, otra, entrada);
        if (r.error) continue;
        casi(r.valor, entrada[otra], Math.max(1e-6, Math.abs(entrada[otra]) * 1e-9));
      }
    }
  }
});

test('geometria: casos conocidos', () => {
  casi(calcula('areaCuadrado', 'A', { l: 4 }), 16);
  casi(calcula('areaCuadrado', 'l', { A: 16 }), 4);
  casi(calcula('areaTriangulo', 'A', { b: 6, h: 4 }), 12);
  casi(calcula('areaCirculo', 'A', { r: 1 }), Math.PI);
  casi(calcula('longitudCircunferencia', 'L', { r: 1 }), 2 * Math.PI);
  casi(calcula('areaTrapecio', 'A', { B: 8, b: 4, h: 3 }), 18);
  casi(calcula('pitagoras', 'c', { a: 3, b: 4 }), 5);
  casi(calcula('pitagoras', 'a', { c: 5, b: 4 }), 3);
});

test('cuerpos: casos conocidos', () => {
  casi(calcula('volumenCubo', 'V', { a: 3 }), 27);
  casi(calcula('volumenCubo', 'a', { V: 27 }), 3);
  casi(calcula('volumenCilindro', 'V', { r: 1, h: 2 }), 2 * Math.PI);
  casi(calcula('volumenEsfera', 'V', { r: 3 }), 113.0973355, 1e-5);
  casi(calcula('areaEsfera', 'A', { r: 2 }), 50.2654824, 1e-5);
  casi(calcula('volumenCono', 'V', { r: 3, h: 4 }), 37.6991118, 1e-5);
});

test('fisica: casos conocidos', () => {
  casi(calcula('velocidadMedia', 'v', { d: 100, t: 20 }), 5);
  casi(calcula('velocidadMedia', 't', { d: 100, v: 5 }), 20);
  casi(calcula('mruv', 'v', { v0: 0, a: 9.81, t: 2 }), 19.62);
  casi(calcula('espacioMruv', 'x', { x0: 0, v0: 0, a: 10, t: 3 }), 45);
  casi(calcula('caidaLibre', 't', { h: 19.62, g: 9.81 }), 2);
  casi(calcula('segundaNewton', 'F', { m: 10, a: 2 }), 20);
  casi(calcula('peso', 'P', { m: 10, g: 9.81 }), 98.1);
  casi(calcula('energiaCinetica', 'Ec', { m: 2, v: 10 }), 100);
  casi(calcula('energiaCinetica', 'v', { Ec: 100, m: 2 }), 10);
  casi(calcula('energiaPotencial', 'Ep', { m: 2, g: 10, h: 5 }), 100);
  casi(calcula('presion', 'p', { F: 100, A: 2 }), 50);
  casi(calcula('densidad', 'rho', { m: 1000, V: 1 }), 1000);
  casi(calcula('potencia', 'P', { W: 600, t: 60 }), 10);
});

test('electricidad y quimica: casos conocidos', () => {
  casi(calcula('ohm', 'V', { I: 2, R: 6 }), 12);
  casi(calcula('ohm', 'R', { V: 12, I: 2 }), 6);
  casi(calcula('potenciaElectrica', 'P', { V: 230, I: 10 }), 2300);
  casi(calcula('carga', 'Q', { I: 2, t: 30 }), 60);
  casi(calcula('moles', 'n', { m: 36, M: 18 }), 2);
  casi(calcula('molaridad', 'Mc', { n: 0.5, V: 2 }), 0.25);
  // un mol a 0 grados y una atmosfera ocupa unos 22,4 L
  casi(calcula('gasesIdeales', 'V', { p: 1, n: 1, R: 0.082, T: 273 }), 22.386, 1e-3);
});

test('dinero y proporciones: casos conocidos', () => {
  casi(calcula('interesSimple', 'I', { C: 1000, r: 5, t: 2 }), 100);
  casi(calcula('interesSimple', 'r', { I: 100, C: 1000, t: 2 }), 5);
  casi(calcula('interesCompuesto', 'C_f', { C: 1000, r: 10, t: 2 }), 1210);
  casi(calcula('interesCompuesto', 't', { C_f: 1210, C: 1000, r: 10 }), 2, 1e-9);
  casi(calcula('escala', 'real', { plano: 5, escala: 500 }), 25);
  casi(calcula('imc', 'IMC', { m: 70, h: 1.75 }), 22.857142, 1e-5);
});

test('faltan datos, valores imposibles y variables que no se despejan', () => {
  assert.equal(resolver(byId('ohm'), 'V', { I: 2 }).error, 'faltan');
  assert.equal(resolver(byId('ohm'), 'V', { I: 2, R: NaN }).error, 'faltan');
  assert.equal(resolver(byId('areaCirculo'), 'A', { r: -1 }).error, 'positiva');
  assert.equal(resolver(byId('areaCirculo'), 'A', { r: 0 }).error, 'positiva');
  assert.equal(resolver(byId('pitagoras'), 'a', { c: 3, b: 4 }).error, 'imposible');
  assert.equal(resolver(byId('areaCuadrado'), 'z', { A: 4 }).error, 'noDespejable');
});

test('las variables marcadas como positivas se comprueban', () => {
  const r = resolver(byId('volumenCilindro'), 'V', { r: 2, h: -1 });
  assert.equal(r.error, 'positiva');
  assert.equal(r.variable, 'h');
});

test('el buscador encuentra por nombre, por formula y por variable', () => {
  assert.ok(filtrar(FORMULAS, 'pitagoras', 'todos', nombreDe).some(f => f.id === 'pitagoras'));
  assert.ok(filtrar(FORMULAS, 'π', 'todos', nombreDe).length >= 3, 'por la propia formula');
  assert.ok(filtrar(FORMULAS, 'Ec', 'todos', nombreDe).some(f => f.id === 'energiaCinetica'));
  assert.equal(filtrar(FORMULAS, 'zzz', 'todos', nombreDe).length, 0);
});

test('el filtro por tema se cruza con la busqueda', () => {
  const plana = filtrar(FORMULAS, '', 'plana', nombreDe);
  assert.ok(plana.length >= 5);
  assert.ok(plana.every(f => f.grupo === 'plana'));
  assert.equal(filtrar(FORMULAS, 'ohm', 'plana', nombreDe).length, 0);
  assert.equal(filtrar(FORMULAS, '', 'todos', nombreDe).length, FORMULAS.length);
});
