import test from 'node:test';
import assert from 'node:assert/strict';
import { escapar, plegar, fechaICS, fechaHoraICS, marcaUTC, masDias, evento, calendario } from '../src/lib/ics.js';

const CREADO = new Date(Date.UTC(2026, 0, 1, 12, 0, 0));
const lineas = texto => texto.split('\r\n');

test('escapa los caracteres con significado propio', () => {
  assert.equal(escapar('a;b'), 'a\\;b');
  assert.equal(escapar('a,b'), 'a\\,b');
  assert.equal(escapar('a\\b'), 'a\\\\b');
  assert.equal(escapar('a\nb'), 'a\\nb');
  assert.equal(escapar('a\r\nb'), 'a\\nb');
  assert.equal(escapar('Tema 3; ejercicios 1, 2 y 3'), 'Tema 3\\; ejercicios 1\\, 2 y 3');
});

test('la barra se escapa antes que lo demas, sin duplicar', () => {
  assert.equal(escapar('\\;'), '\\\\\\;');
});

test('escapar aguanta null y undefined', () => {
  assert.equal(escapar(null), '');
  assert.equal(escapar(undefined), '');
});

test('las lineas cortas no se tocan', () => {
  assert.deepEqual(plegar('SUMMARY:Examen'), ['SUMMARY:Examen']);
});

test('las lineas largas se pliegan con un espacio delante', () => {
  const larga = `DESCRIPTION:${'x'.repeat(200)}`;
  const partes = plegar(larga);
  assert.ok(partes.length > 1);
  assert.ok(partes.slice(1).every(p => p.startsWith(' ')));
  assert.equal(partes.join('').replace(/\n /g, ''), partes.join(''));
  // al deshacer el plegado vuelve el original
  assert.equal(partes[0] + partes.slice(1).map(p => p.slice(1)).join(''), larga);
});

test('se cuenta en octetos, no en caracteres', () => {
  const conTildes = `SUMMARY:${'á'.repeat(60)}`;   // 120 octetos
  for (const parte of plegar(conTildes)) {
    assert.ok(new TextEncoder().encode(parte).length <= 75, `${parte.length} caracteres se pasan`);
  }
});

test('no se parte un caracter por la mitad', () => {
  const partes = plegar(`SUMMARY:${'ñ'.repeat(80)}`);
  for (const parte of partes) assert.ok(!parte.includes('�'));
  assert.equal(partes.join('').replace(/ /g, '').length, `SUMMARY:${'ñ'.repeat(80)}`.replace(/ /g, '').length);
});

test('formatos de fecha', () => {
  assert.equal(fechaICS(new Date(2026, 2, 14)), '20260314');
  assert.equal(fechaHoraICS(new Date(2026, 2, 14, 9, 5, 0)), '20260314T090500');
  assert.equal(marcaUTC(CREADO), '20260101T120000Z');
  assert.equal(fechaICS(masDias(new Date(2026, 11, 31), 1)), '20270101', 'cruza el ano');
});

test('un evento con hora lleva DTSTART y DTEND sin zona', () => {
  const l = evento({ uid: 'x', inicio: new Date(2026, 2, 14, 9, 30), resumen: 'Examen' }, { creado: CREADO });
  assert.ok(l.includes('DTSTART:20260314T093000'));
  assert.ok(l.includes('DTEND:20260314T103000'), 'una hora por defecto');
  assert.ok(l.includes('SUMMARY:Examen'));
  assert.equal(l[0], 'BEGIN:VEVENT');
  assert.equal(l.at(-1), 'END:VEVENT');
});

test('un evento de todo el dia acaba al dia siguiente', () => {
  const l = evento({ uid: 'x', inicio: new Date(2026, 2, 14), todoElDia: true, resumen: 'Examen' }, { creado: CREADO });
  assert.ok(l.includes('DTSTART;VALUE=DATE:20260314'));
  assert.ok(l.includes('DTEND;VALUE=DATE:20260315'), 'DTEND es exclusivo');
});

test('el aviso se escribe como VALARM en minutos', () => {
  const l = evento({ uid: 'x', inicio: new Date(2026, 2, 14, 9, 0), resumen: 'E', avisoMinutos: 1440 }, { creado: CREADO });
  assert.ok(l.includes('BEGIN:VALARM'));
  assert.ok(l.includes('TRIGGER:-PT1440M'));
  assert.ok(l.includes('END:VALARM'));
});

test('sin aviso no hay VALARM', () => {
  const l = evento({ uid: 'x', inicio: new Date(2026, 2, 14, 9, 0), resumen: 'E' }, { creado: CREADO });
  assert.ok(!l.includes('BEGIN:VALARM'));
  assert.ok(!evento({ uid: 'x', inicio: new Date(2026, 2, 14), resumen: 'E', avisoMinutos: 0 }).includes('BEGIN:VALARM'));
});

test('el calendario tiene la cabecera y el cierre que toca', () => {
  const texto = calendario([{ uid: 'a', inicio: new Date(2026, 2, 14, 9, 0), resumen: 'Uno' }], { creado: CREADO });
  const l = lineas(texto);
  assert.equal(l[0], 'BEGIN:VCALENDAR');
  assert.equal(l[1], 'VERSION:2.0');
  assert.ok(l.some(x => x.startsWith('PRODID:')));
  assert.equal(l.at(-2), 'END:VCALENDAR');
  assert.equal(l.at(-1), '', 'acaba en CRLF');
});

test('termina cada linea en CRLF, nunca en un salto suelto', () => {
  const texto = calendario([{ uid: 'a', inicio: new Date(2026, 2, 14), todoElDia: true, resumen: 'Uno' }]);
  assert.equal(texto.replace(/\r\n/g, '').includes('\n'), false);
});

test('varios eventos van uno detras de otro', () => {
  const texto = calendario([
    { uid: 'a', inicio: new Date(2026, 2, 14, 9, 0), resumen: 'Uno' },
    { uid: 'b', inicio: new Date(2026, 2, 15, 9, 0), resumen: 'Dos' }
  ], { creado: CREADO });
  assert.equal((texto.match(/BEGIN:VEVENT/g) || []).length, 2);
  assert.equal((texto.match(/END:VEVENT/g) || []).length, 2);
  assert.ok(texto.indexOf('SUMMARY:Uno') < texto.indexOf('SUMMARY:Dos'));
});

test('un calendario vacio sigue siendo valido', () => {
  const l = lineas(calendario([], { creado: CREADO }));
  assert.equal(l[0], 'BEGIN:VCALENDAR');
  assert.equal(l.at(-2), 'END:VCALENDAR');
  assert.ok(!l.some(x => x === 'BEGIN:VEVENT'));
});
