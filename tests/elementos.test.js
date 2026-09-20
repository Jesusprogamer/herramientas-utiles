import test from 'node:test';
import assert from 'node:assert/strict';
import { ELEMENTS, byZ, bySymbol } from '../src/data/elements.js';
import { buscar, coincidenciaExacta, escala, rango, sinTildes } from '../src/lib/elementos.js';

/* Los nombres reales viven en los idiomas; para probar basta con uno de
   mentira que imite lo justo: tildes y coincidencias parciales. */
const NOMBRES = { H: 'Hidrógeno', B: 'Boro', C: 'Carbono', O: 'Oxígeno', P: 'Fósforo',
  Cl: 'Cloro', Fe: 'Hierro', Au: 'Oro', Ag: 'Plata' };
const nombreDe = e => NOMBRES[e.symbol] || e.symbol;

test('la tabla tiene los 118 elementos, sin huecos ni repetidos', () => {
  assert.equal(ELEMENTS.length, 118);
  ELEMENTS.forEach((e, i) => assert.equal(e.z, i + 1));
  assert.equal(new Set(ELEMENTS.map(e => e.symbol)).size, 118);
});

test('byZ y bySymbol encuentran lo mismo', () => {
  assert.equal(byZ(26).symbol, 'Fe');
  assert.equal(bySymbol('fe').z, 26);
  assert.equal(bySymbol('FE').z, 26);
  assert.equal(byZ(0), null);
  assert.equal(byZ(119), null);
  assert.equal(bySymbol('Zz'), null);
});

test('todos tienen periodo, familia y configuracion', () => {
  for (const e of ELEMENTS) {
    assert.ok(e.period >= 1 && e.period <= 7, `${e.symbol} periodo ${e.period}`);
    assert.ok(e.category, `${e.symbol} sin familia`);
    assert.ok(/^(\[\w+\])?\s*\d/.test(e.config), `${e.symbol} config "${e.config}"`);
  }
});

test('solo los lantanidos y actinidos quedan fuera de la rejilla', () => {
  const sinGrupo = ELEMENTS.filter(e => e.group === null).map(e => e.z);
  const esperados = [
    ...Array.from({ length: 15 }, (_, i) => 57 + i),
    ...Array.from({ length: 15 }, (_, i) => 89 + i)
  ];
  assert.deepEqual(sinGrupo, esperados);
});

test('los grupos van de 1 a 18 y encajan con casos conocidos', () => {
  for (const e of ELEMENTS) {
    if (e.group !== null) assert.ok(e.group >= 1 && e.group <= 18, `${e.symbol} grupo ${e.group}`);
  }
  const g = s => bySymbol(s).group;
  assert.equal(g('H'), 1); assert.equal(g('He'), 18); assert.equal(g('Li'), 1);
  assert.equal(g('C'), 14); assert.equal(g('O'), 16); assert.equal(g('Ne'), 18);
  assert.equal(g('Fe'), 8); assert.equal(g('Br'), 17); assert.equal(g('Au'), 11);
  assert.equal(g('Og'), 18);
});

test('los periodos empiezan donde deben', () => {
  const p = s => bySymbol(s).period;
  assert.equal(p('H'), 1); assert.equal(p('Li'), 2); assert.equal(p('Na'), 3);
  assert.equal(p('K'), 4); assert.equal(p('Rb'), 5); assert.equal(p('Cs'), 6);
  assert.equal(p('Fr'), 7);
});

test('datos sueltos de control, contra la fuente', () => {
  assert.equal(bySymbol('H').mass, 1.008);
  assert.equal(bySymbol('C').mass, 12.011);
  assert.equal(bySymbol('Fe').electronegativity, 1.83);
  assert.equal(bySymbol('O').config, '[He]2s2 2p4');
  assert.equal(bySymbol('Hg').state, 'liquido');
  assert.equal(bySymbol('Br').state, 'liquido');
  // los conocidos desde la Antiguedad no tienen ano: la ficha lo dice con texto
  assert.equal(bySymbol('Au').year, null);
  assert.equal(bySymbol('Fe').year, null);
  assert.equal(bySymbol('He').year, 1868);
  // correccion documentada en docs/fuentes-datos.md
  assert.equal(bySymbol('Li').mass, 6.94);
});

test('once gases y dos liquidos a temperatura ambiente', () => {
  const por = estado => ELEMENTS.filter(e => e.state === estado).map(e => e.symbol);
  assert.deepEqual(por('gas'), ['H', 'He', 'N', 'O', 'F', 'Ne', 'Cl', 'Ar', 'Kr', 'Xe', 'Rn']);
  assert.deepEqual(por('liquido'), ['Br', 'Hg']);
});

test('solo los superpesados llevan configuracion predicha', () => {
  for (const e of ELEMENTS) {
    if (e.predicha) assert.ok(e.z >= 103, `${e.symbol} (Z ${e.z}) no deberia ser predicha`);
  }
  assert.ok(ELEMENTS.some(e => e.predicha));
});

test('sinTildes quita acentos y mayusculas', () => {
  assert.equal(sinTildes('Fósforo'), 'fosforo');
  assert.equal(sinTildes('NEÓN'), 'neon');
});

test('la busqueda pone delante la coincidencia exacta', () => {
  const r = buscar(ELEMENTS, 'oro', nombreDe);
  assert.equal(r[0].symbol, 'Au', 'el oro va primero');
  assert.ok(r.some(e => e.symbol === 'B'), 'boro sigue apareciendo');
  assert.ok(r.some(e => e.symbol === 'Cl'), 'cloro tambien');
});

test('la busqueda encuentra por simbolo, por numero y sin tildes', () => {
  assert.equal(buscar(ELEMENTS, 'fe', nombreDe)[0].symbol, 'Fe');
  assert.deepEqual(buscar(ELEMENTS, '79', nombreDe).map(e => e.symbol), ['Au']);
  assert.equal(buscar(ELEMENTS, 'fosforo', nombreDe)[0].symbol, 'P');
  assert.deepEqual(buscar(ELEMENTS, 'zzz', nombreDe), []);
});

test('una busqueda vacia devuelve todo', () => {
  assert.equal(buscar(ELEMENTS, '', nombreDe).length, 118);
  assert.equal(buscar(ELEMENTS, '   ', nombreDe).length, 118);
});

test('coincidenciaExacta solo abre cuando no hay duda', () => {
  const exacta = q => coincidenciaExacta(buscar(ELEMENTS, q, nombreDe), q, nombreDe);
  assert.equal(exacta('oro').symbol, 'Au', 'nombre exacto');
  assert.equal(exacta('fe').symbol, 'Fe', 'simbolo exacto');
  assert.equal(exacta('79').symbol, 'Au', 'numero atomico');
  assert.equal(exacta('hierr').symbol, 'Fe', 'solo queda uno');
  assert.equal(exacta('c').symbol, 'C', 'una sola letra que es un simbolo');
  assert.equal(exacta('ro'), null, 'demasiados candidatos, ninguno exacto');
  assert.equal(exacta(''), null);
  assert.equal(exacta('zzz'), null);
});

test('escala recorta entre 0 y 1 y avisa de los huecos', () => {
  assert.equal(escala(5, 0, 10), 0.5);
  assert.equal(escala(-1, 0, 10), 0);
  assert.equal(escala(11, 0, 10), 1);
  assert.equal(escala(3, 3, 3), 0.5);
  assert.equal(escala(null, 0, 10), null);
  assert.equal(escala(undefined, 0, 10), null);
});

test('rango ignora los elementos sin dato', () => {
  const [min, max] = rango(ELEMENTS, 'electronegativity');
  assert.ok(min > 0 && Number.isFinite(min));
  assert.equal(max, 3.98, 'el fluor es el mas electronegativo');
  assert.ok(ELEMENTS.some(e => e.electronegativity === null), 'hay elementos sin el dato');
});
