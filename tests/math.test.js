/** Motores de cálculo: fracciones exactas, analizador y pasos. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { Fraction, frac, gcd, lcm, primeFactors, divisors, simplifySqrt } from '../src/lib/fraction.js';
import { calc, parse, tokenize, reduceSteps, format } from '../src/lib/expr.js';
import * as steps from '../src/lib/steps.js';
import { readFileSync } from 'node:fs';

/* ---------- fracciones ---------- */
test('las fracciones son exactas, sin errores de coma flotante', () => {
  assert.equal(frac(1n, 3n).add(frac(1n, 6n)).toString(), '1/2');
  assert.equal(Fraction.fromNumber(0.1).add(Fraction.fromNumber(0.2)).toString(), '3/10');
  assert.equal(frac(2n, 4n).toString(), '1/2', 'se normaliza sola');
  assert.equal(frac(1n, -2n).toString(), '-1/2', 'el signo va arriba');
});

test('operaciones y potencias', () => {
  assert.equal(frac(3n, 4n).mul(frac(2n, 3n)).toString(), '1/2');
  assert.equal(frac(3n, 4n).div(frac(3n, 8n)).toString(), '2');
  assert.equal(frac(2n, 3n).pow(-2).toString(), '9/4');
  assert.throws(() => frac(1n, 2n).div(frac(0n)), /cero/);
});

test('mcd, mcm, factores y divisores', () => {
  assert.equal(gcd(48, 18), 6n);
  assert.equal(lcm(4, 6), 12n);
  assert.deepEqual(primeFactors(72n).map(f => [f.primo, f.veces]), [[2n, 3n], [3n, 2n]]);
  assert.deepEqual(divisors(28n), [1n, 2n, 4n, 7n, 14n, 28n]);
  assert.deepEqual(simplifySqrt(72n), { fuera: 6n, dentro: 2n });
});

/* ---------- analizador ---------- */
test('respeta el orden de las operaciones', () => {
  assert.equal(calc('2+3*4'), 14);
  assert.equal(calc('(2+3)*4'), 20);
  assert.equal(calc('2^3^2'), 512, 'la potencia va de derecha a izquierda');
  assert.equal(calc('-3^2'), -9);
  assert.equal(calc('10-2-3'), 5, 'la resta va de izquierda a derecha');
});

test('funciones, constantes y multiplicación implícita', () => {
  assert.equal(calc('sqrt(16)+abs(-5)'), 9);
  assert.equal(calc('log(1000)'), 3);
  assert.equal(Math.round(calc('ln(e)')), 1);
  assert.equal(calc('3(4+1)'), 15);
  assert.ok(Math.abs(calc('2π') - 2 * Math.PI) < 1e-12);
  assert.equal(calc('100*15%'), 15);
});

test('grados y radianes', () => {
  assert.ok(Math.abs(calc('sin(30)', { degrees: true }) - 0.5) < 1e-9);
  assert.ok(Math.abs(calc('sin(0)') - 0) < 1e-12);
});

test('NUNCA ejecuta código: solo entiende matemáticas', () => {
  assert.throws(() => calc('alert(1)'), /alert/);
  assert.throws(() => calc('window'), /window/);
  assert.throws(() => calc('2+'), /corta/);
  assert.throws(() => calc('2$3'), /no permitido/);
  assert.throws(() => calc('(2+3'), /paréntesis/);
  assert.throws(() => calc('1/0'), /cero/);
  // Y no hay eval ni new Function en el código fuente. Se quitan antes los
  // comentarios: si no, saltaría con el propio comentario que lo advierte.
  const sinComentarios = src => src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
  for (const f of ['src/lib/expr.js', 'src/lib/steps.js', 'src/lib/fraction.js']) {
    const codigo = sinComentarios(readFileSync(f, 'utf8'));
    assert.ok(!/\beval\s*\(/.test(codigo), `${f} usa eval`);
    assert.ok(!/new\s+Function/.test(codigo), `${f} usa new Function`);
  }
});

test('los pasos siguen el orden de operaciones', () => {
  const p = reduceSteps('2+3*4-6/2');
  assert.equal(p[0].expresion, '2 + 3 × 4 - 6 ÷ 2');
  assert.equal(p[1].operacion, '3 × 4 = 12', 'primero la multiplicación');
  assert.equal(p[2].operacion, '6 ÷ 2 = 3', 'después la división');
  assert.equal(p[p.length - 1].expresion, '11');
});

test('format pone los paréntesis justos', () => {
  assert.equal(format(parse('(2+3)*4')), '(2 + 3) × 4');
  assert.equal(format(parse('2+3*4')), '2 + 3 × 4');
});

/* ---------- ecuaciones ---------- */
test('primer grado', () => {
  const r = steps.linearEquation(2, 3, 11);      // 2x + 3 = 11
  assert.equal(r.x.toString(), '4');
  assert.ok(r.pasos.length >= 3);
  assert.equal(steps.linearEquation(0, 5, 5).tipo, 'infinitas');
  assert.equal(steps.linearEquation(0, 5, 7).tipo, 'ninguna');
});

test('segundo grado: dos soluciones, doble y complejas', () => {
  const dos = steps.quadraticEquation(1, -5, 6);   // x²-5x+6 -> 2 y 3
  assert.equal(dos.tipo, 'dos');
  assert.deepEqual([dos.x1.toString(), dos.x2.toString()].sort(), ['2', '3']);
  assert.equal(dos.exacta, true);

  const doble = steps.quadraticEquation(1, -4, 4); // (x-2)²
  assert.equal(doble.tipo, 'doble');
  assert.equal(doble.x1.toString(), '2');

  const comp = steps.quadraticEquation(1, 0, 1);   // x²+1
  assert.equal(comp.tipo, 'complejas');
  assert.equal(comp.real.toString(), '0');
  assert.ok(Math.abs(comp.imag - 1) < 1e-12);

  assert.equal(steps.quadraticEquation(1, 0, -2).exacta, false, '√2 no es exacta');
});

test('sistemas 2x2 con los tres métodos', () => {
  for (const metodo of ['reduccion', 'sustitucion', 'cramer']) {
    const r = steps.system2x2(2, 1, 5, 1, -1, 1, metodo);   // x=2, y=1
    assert.equal(r.tipo, 'una', metodo);
    assert.equal(r.x.toString(), '2', metodo);
    assert.equal(r.y.toString(), '1', metodo);
    assert.ok(r.pasos.length >= 3, metodo);
  }
  assert.equal(steps.system2x2(1, 1, 2, 2, 2, 5).tipo, 'ninguna');
  assert.equal(steps.system2x2(1, 1, 2, 2, 2, 4).tipo, 'infinitas');
});

test('fracciones paso a paso', () => {
  assert.equal(steps.fractionOp(frac(1n, 3n), frac(1n, 6n), 'suma').resultado.toString(), '1/2');
  assert.equal(steps.fractionOp(frac(3n, 4n), frac(3n, 8n), 'division').resultado.toString(), '2');
  assert.equal(steps.fractionOp(frac(1n, 2n), frac(0n), 'division').ok, false);
  const s = steps.simplifyFraction(18, 24);
  assert.equal(s.resultado.toString(), '3/4');
});

test('mcd/mcm con Euclides, factorización y regla de tres', () => {
  const r = steps.gcdLcm(48, 18);
  assert.equal(r.mcd, 6n);
  assert.equal(r.mcm, 144n);
  assert.ok(r.pasos.some(p => p.clave === 'mcd.division'));

  const f = steps.factorize(360);
  assert.equal(f.expresion, '2^3 × 3^2 × 5');
  assert.equal(steps.factorize(17).esPrimo, true);

  assert.equal(steps.ruleOfThree(2, 6, 5).x.toString(), '15');       // directa
  assert.equal(steps.ruleOfThree(4, 6, 8, true).x.toString(), '3');  // inversa
});

test('porcentajes', () => {
  assert.equal(steps.percentage('deQue', 20, 150).resultado.toString(), '30');
  assert.equal(steps.percentage('queporcentaje', 30, 250).resultado.toString(), '12');
  assert.equal(steps.percentage('aumentar', 100, 21).resultado.toString(), '121');
  assert.equal(steps.percentage('descontar', 80, 25).resultado.toString(), '60');
});

test('potencias y raíces', () => {
  assert.equal(steps.powerRoot(2, 10).resultado.toString(), '1024');
  assert.equal(steps.powerRoot(frac(2n, 3n), -2).resultado.toString(), '9/4');
  assert.equal(steps.sqrtSteps(16).resultado, 4);
  assert.equal(steps.sqrtSteps(16).exacta, true);
  assert.ok(steps.sqrtSteps(72).pasos.some(p => p.clave === 'pot.raizSimplifica'));
  assert.equal(steps.sqrtSteps(-4).ok, false);
});

test('estadística: poblacional y muestral', () => {
  const datos = steps.parseData('2, 4 6\n8; 10');
  assert.deepEqual(datos, [2, 4, 6, 8, 10]);

  const p = steps.statistics(datos);
  assert.equal(p.media, 6);
  assert.equal(p.mediana, 6);
  assert.equal(p.rango, 8);
  assert.equal(p.varianza, 8, 'poblacional divide entre n');
  assert.deepEqual(p.moda, [], 'sin valores repetidos no hay moda');

  const m = steps.statistics(datos, { muestral: true });
  assert.equal(m.varianza, 10, 'muestral divide entre n−1');

  const conModa = steps.statistics([1, 2, 2, 3]);
  assert.deepEqual(conModa.moda, [2]);
  assert.equal(steps.statistics([]).ok, false);
});

test('los pasos son claves de idioma, no frases sueltas', () => {
  const todos = [
    ...steps.linearEquation(2, 3, 11).pasos,
    ...steps.quadraticEquation(1, -5, 6).pasos,
    ...steps.gcdLcm(48, 18).pasos,
    ...steps.statistics([1, 2, 3]).pasos
  ];
  for (const p of todos) {
    assert.match(p.clave, /^[a-z]+\.[a-zA-Z]+$/, `paso con clave rara: ${p.clave}`);
    assert.equal(typeof p.params, 'object');
  }
});
