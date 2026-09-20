/**
 * Calculadora paso a paso.
 *
 * Los cálculos viven en src/lib (módulos puros y probados); aquí solo está
 * la interfaz. Las explicaciones son plantillas de los archivos de idioma:
 * cada paso llega como { clave, params } y se traduce con t().
 */
import { h, clear, copyText } from '../../ui/dom.js';
import { button, iconButton, tabs, field, select, toggle, segmented, settingRow, notice } from '../../ui/components.js';
import { toastOk, toastError, toast } from '../../ui/toast.js';
import * as storage from '../../core/storage.js';
import { t, formatNumber } from '../../core/i18n.js';
import { calc, reduceSteps } from '../../lib/expr.js';
import { Fraction } from '../../lib/fraction.js';
import * as steps from '../../lib/steps.js';

const KEY = 'calculadora';

/** Acepta coma o punto decimal. */
const num = value => {
  const raw = String(value).replace(/\s/g, '').replace(',', '.');
  if (raw === '') return NaN;
  const n = Number(raw);
  return Number.isFinite(n) ? n : NaN;
};

/** Convierte a fracción exacta lo que se escriba: "3", "1/2", "0,25". */
const toFrac = value => Fraction.parse(String(value).trim().replace(',', '.'));

const prefs = () => ({
  explicar: true, nivel: 'detallado', grados: false,
  ...(storage.get(KEY, null) || {})
});
const savePrefs = patch => storage.set(KEY, { ...prefs(), ...patch });

export default {
  id: 'calculadora',

  mount(container) {
    let opciones = prefs();

    /* ---------------- Pasos ---------------- */
    const stepsBox = h('div.steps');
    let ultimaExplicacion = '';

    function pintarPasos(lista) {
      clear(stepsBox);
      ultimaExplicacion = '';
      if (!opciones.explicar || !lista?.length) { stepsBox.hidden = true; return; }
      stepsBox.hidden = false;

      const mostrados = opciones.nivel === 'breve' && lista.length > 2
        ? [lista[0], lista[lista.length - 1]]
        : lista;

      const lineas = [];
      const ol = h('ol.steps__list');
      mostrados.forEach((p, i) => {
        const texto = typeof p === 'string' ? p : t(`calc.paso.${p.clave}`, p.params);
        lineas.push(`${i + 1}. ${texto}`);
        ol.appendChild(h('li.steps__item', { text: texto }));
      });
      if (opciones.nivel === 'breve' && lista.length > 2) {
        ol.insertBefore(h('li.steps__item.faint', { text: t('calc.pasosOcultos', { n: lista.length - 2 }) }), ol.children[1]);
      }
      ultimaExplicacion = lineas.join('\n');
      stepsBox.append(h('p.steps__title', { text: t('calc.pasos') }), ol);
    }

    /* ---------------- Resultado ---------------- */
    const resultValue = h('p.conv__result-value', { 'aria-live': 'polite', text: '—' });
    const resultNote = h('p.small.muted');
    const resultBox = h('div.conv__result',
      h('div.row',
        h('div.grow', resultValue, resultNote),
        iconButton('download', t('calc.copyResult'), {
          onClick: async () => {
            (await copyText(resultValue.textContent)) ? toastOk(t('common.copied')) : toastError(t('common.copyFailed'));
          }
        }),
        iconButton('type', t('calc.copySteps'), {
          onClick: async () => {
            if (!ultimaExplicacion) { toast(t('calc.sinPasos')); return; }
            (await copyText(ultimaExplicacion)) ? toastOk(t('common.copied')) : toastError(t('common.copyFailed'));
          }
        })
      )
    );

    const mostrar = (valor, nota = '') => {
      resultValue.textContent = valor;
      resultNote.textContent = nota;
    };
    const fallo = clave => { mostrar('—', t(`calc.error.${clave}`) || t('common.error')); pintarPasos(null); };

    /* ---------------- Constructor de paneles ---------------- */
    /**
     * campos: [{ name, labelKey, tipo, opciones, valor }]
     * resolver(valores) -> { valor, nota, pasos } o { error }
     */
    function panel(config) {
      return contenedor => {
        const entradas = new Map();
        const form = h('div.stack');

        for (const campo of config.campos) {
          if (campo.tipo === 'select') {
            const sel = select({
              label: t(campo.labelKey), value: campo.valor,
              options: campo.opciones.map(o => ({ value: o, label: t(`${campo.labelKey}.${o}`) })),
              onChange: () => resolver()
            });
            entradas.set(campo.name, () => sel.select.value);
            form.appendChild(sel);
          } else if (campo.tipo === 'textarea') {
            const area = h('textarea.textarea', {
              rows: '4', 'aria-label': t(campo.labelKey),
              placeholder: campo.placeholderKey ? t(campo.placeholderKey) : ''
            });
            area.addEventListener('input', resolver);
            entradas.set(campo.name, () => area.value);
            entradas.set(`${campo.name}__set`, v => { area.value = v; });
            form.appendChild(h('div.field', h('label.field__label', { text: t(campo.labelKey) }), area));
          } else {
            const f = field({
              label: t(campo.labelKey), type: 'text', inputmode: 'decimal',
              value: campo.valor ?? '', hint: campo.hintKey ? t(campo.hintKey) : undefined,
              onInput: resolver
            });
            entradas.set(campo.name, () => f.input.value);
            entradas.set(`${campo.name}__set`, v => { f.input.value = v; });
            form.appendChild(f);
          }
        }

        function valores() {
          const salida = {};
          for (const campo of config.campos) salida[campo.name] = entradas.get(campo.name)();
          return salida;
        }

        function resolver() {
          const datos = valores();
          if (config.campos.some(c => c.tipo !== 'select' && !String(datos[c.name]).trim())) {
            mostrar('—', '');
            pintarPasos(null);
            return;
          }
          try {
            const r = config.resolver(datos, opciones);
            if (!r || r.error) { fallo(r?.error || 'general'); return; }
            mostrar(r.valor, r.nota || '');
            pintarPasos(r.pasos);
          } catch (err) {
            mostrar('—', err.message);
            pintarPasos(null);
          }
        }

        const ejemplo = button(t('calc.ejemplo'), {
          icon: 'refresh',
          onClick: () => {
            for (const [name, valor] of Object.entries(config.ejemplo || {})) {
              entradas.get(`${name}__set`)?.(valor);
            }
            resolver();
          }
        });

        contenedor.append(form, h('div.row', ejemplo));
        recalcular = resolver;
        resolver();
      };
    }

    /* ---------------- Definición de cada pestaña ---------------- */

    const cientifica = contenedor => {
      const entrada = h('input.input.mono', {
        type: 'text', 'aria-label': t('calc.cientifica.label'),
        placeholder: t('calc.cientifica.placeholder'), spellcheck: 'false'
      });
      const teclas = ['7', '8', '9', '÷', '4', '5', '6', '×', '1', '2', '3', '-', '0', '.', '(', ')',
        '+', '^', 'π', 'e', 'sqrt(', 'sin(', 'cos(', 'tan(', 'log(', 'ln(', '%'];
      const historial = h('div.stack');
      let historia = storage.get('calculadora-historial', []);
      if (!Array.isArray(historia)) historia = [];

      const resolver = () => {
        const texto = entrada.value.trim();
        if (!texto) { mostrar('—'); pintarPasos(null); return; }
        try {
          const valor = calc(texto, { degrees: opciones.grados });
          mostrar(formatNumber(Number(valor.toFixed(10))), texto);
          pintarPasos(reduceSteps(texto, { degrees: opciones.grados })
            .filter(p => p.operacion)
            .map(p => ({ clave: 'expr', params: { paso: p.operacion, resto: p.expresion } })));
        } catch (err) {
          mostrar('—', err.message);
          pintarPasos(null);
        }
      };
      entrada.addEventListener('input', resolver);
      entrada.addEventListener('keydown', e => { if (e.key === 'Enter') guardar(); });

      function guardar() {
        const texto = entrada.value.trim();
        if (!texto) return;
        try {
          const valor = calc(texto, { degrees: opciones.grados });
          historia = [{ e: texto, r: Number(valor.toFixed(10)) }, ...historia].slice(0, 12);
          storage.set('calculadora-historial', historia);
          pintarHistorial();
        } catch { /* si no calcula, no se guarda */ }
      }

      function pintarHistorial() {
        clear(historial);
        if (!historia.length) return;
        historial.append(h('p.small.muted', { text: t('calc.historial') }));
        for (const item of historia) {
          historial.appendChild(h('button.btn.btn--sm.btn--block', {
            type: 'button',
            text: `${item.e} = ${formatNumber(item.r)}`,
            onClick: () => { entrada.value = item.e; resolver(); }
          }));
        }
      }

      const pad = h('div.keypad');
      for (const tecla of teclas) {
        pad.appendChild(h('button.keypad__key', {
          type: 'button', text: tecla,
          onClick: () => { entrada.value += tecla; entrada.focus(); resolver(); }
        }));
      }
      pad.appendChild(h('button.keypad__key.keypad__key--wide', {
        type: 'button', text: t('calc.cientifica.borrar'),
        onClick: () => { entrada.value = entrada.value.slice(0, -1); resolver(); }
      }));
      pad.appendChild(h('button.keypad__key.keypad__key--wide', {
        type: 'button', text: t('calc.cientifica.limpiar'),
        onClick: () => { entrada.value = ''; resolver(); }
      }));

      contenedor.append(h('div.stack',
        entrada,
        settingRow({
          label: t('calc.cientifica.angulo'),
          control: segmented({
            label: t('calc.cientifica.angulo'),
            value: opciones.grados ? 'grados' : 'radianes',
            options: [
              { value: 'radianes', label: t('calc.cientifica.radianes') },
              { value: 'grados', label: t('calc.cientifica.grados') }
            ],
            onChange: v => { opciones.grados = v === 'grados'; savePrefs({ grados: opciones.grados }); resolver(); }
          })
        }),
        pad,
        h('div.row', button(t('calc.cientifica.guardar'), { variant: 'primary', onClick: guardar })),
        historial
      ));
      pintarHistorial();
      recalcular = resolver;
      resolver();
    };

    const fmt = v => (v instanceof Fraction ? v.toString() : formatNumber(Number(Number(v).toFixed(8))));

    const PESTANAS = [
      { id: 'cientifica', labelKey: 'calc.tab.cientifica', render: cientifica },

      { id: 'lineal', labelKey: 'calc.tab.lineal', render: panel({
        campos: [
          { name: 'a', labelKey: 'calc.lineal.a' },
          { name: 'b', labelKey: 'calc.lineal.b' },
          { name: 'c', labelKey: 'calc.lineal.c' }
        ],
        ejemplo: { a: '2', b: '3', c: '11' },
        resolver: d => {
          const r = steps.linearEquation(toFrac(d.a), toFrac(d.b), toFrac(d.c));
          if (r.tipo === 'infinitas') return { valor: t('calc.lineal.infinitas'), pasos: r.pasos };
          if (r.tipo === 'ninguna') return { valor: t('calc.lineal.ninguna'), pasos: r.pasos };
          return { valor: `x = ${fmt(r.x)}`, nota: r.x.isInteger() ? '' : `≈ ${fmt(r.decimal)}`, pasos: r.pasos };
        }
      }) },

      { id: 'cuadratica', labelKey: 'calc.tab.cuadratica', render: panel({
        campos: [
          { name: 'a', labelKey: 'calc.cuadratica.a' },
          { name: 'b', labelKey: 'calc.cuadratica.b' },
          { name: 'c', labelKey: 'calc.cuadratica.c' }
        ],
        ejemplo: { a: '1', b: '-5', c: '6' },
        resolver: d => {
          const r = steps.quadraticEquation(toFrac(d.a), toFrac(d.b), toFrac(d.c));
          if (r.tipo === 'complejas') {
            return { valor: `x = ${fmt(r.real)} ± ${fmt(r.imag)}i`, nota: t('calc.cuadratica.sinReales'), pasos: r.pasos };
          }
          if (r.tipo === 'doble') return { valor: `x = ${fmt(r.x1)}`, nota: t('calc.cuadratica.unaDoble'), pasos: r.pasos };
          if (r.tipo === 'dos') return { valor: `x₁ = ${fmt(r.x1)} · x₂ = ${fmt(r.x2)}`, pasos: r.pasos };
          return { valor: r.x ? `x = ${fmt(r.x)}` : t('calc.lineal.ninguna'), pasos: r.pasos };
        }
      }) },

      { id: 'sistema', labelKey: 'calc.tab.sistema', render: panel({
        campos: [
          { name: 'a1', labelKey: 'calc.sistema.a1' }, { name: 'b1', labelKey: 'calc.sistema.b1' }, { name: 'c1', labelKey: 'calc.sistema.c1' },
          { name: 'a2', labelKey: 'calc.sistema.a2' }, { name: 'b2', labelKey: 'calc.sistema.b2' }, { name: 'c2', labelKey: 'calc.sistema.c2' },
          { name: 'metodo', labelKey: 'calc.sistema.metodo', tipo: 'select', opciones: ['reduccion', 'sustitucion', 'cramer'], valor: 'reduccion' }
        ],
        ejemplo: { a1: '2', b1: '1', c1: '5', a2: '1', b2: '-1', c2: '1' },
        resolver: d => {
          const r = steps.system2x2(toFrac(d.a1), toFrac(d.b1), toFrac(d.c1),
            toFrac(d.a2), toFrac(d.b2), toFrac(d.c2), d.metodo);
          if (r.tipo !== 'una') return { valor: t(`calc.sistema.${r.tipo}`), pasos: r.pasos };
          return { valor: `x = ${fmt(r.x)} · y = ${fmt(r.y)}`, pasos: r.pasos };
        }
      }) },

      { id: 'fracciones', labelKey: 'calc.tab.fracciones', render: panel({
        campos: [
          { name: 'a', labelKey: 'calc.fracciones.a', hintKey: 'calc.fracciones.formato' },
          { name: 'op', labelKey: 'calc.fracciones.op', tipo: 'select', opciones: ['suma', 'resta', 'multiplicacion', 'division'], valor: 'suma' },
          { name: 'b', labelKey: 'calc.fracciones.b' }
        ],
        ejemplo: { a: '1/3', b: '1/6' },
        resolver: d => {
          const r = steps.fractionOp(toFrac(d.a), toFrac(d.b), d.op);
          if (!r.ok) return { error: 'entreCero' };
          return { valor: fmt(r.resultado), nota: `≈ ${fmt(r.decimal)}`, pasos: r.pasos };
        }
      }) },

      { id: 'mcd', labelKey: 'calc.tab.mcd', render: panel({
        campos: [{ name: 'a', labelKey: 'calc.mcd.a' }, { name: 'b', labelKey: 'calc.mcd.b' }],
        ejemplo: { a: '48', b: '18' },
        resolver: d => {
          const r = steps.gcdLcm(num(d.a), num(d.b));
          if (!r.ok) return { error: 'ceros' };
          return { valor: `MCD = ${r.mcd} · mcm = ${r.mcm}`, pasos: r.pasos };
        }
      }) },

      { id: 'factorizar', labelKey: 'calc.tab.factorizar', render: panel({
        campos: [{ name: 'n', labelKey: 'calc.factor.n' }],
        ejemplo: { n: '360' },
        resolver: d => {
          const r = steps.factorize(num(d.n));
          if (!r.ok) return { error: 'cero' };
          return {
            valor: r.expresion || '1',
            nota: t('calc.factor.divisores', { n: r.divisores.length, lista: r.divisores.slice(0, 24).join(', ') }),
            pasos: r.pasos
          };
        }
      }) },

      { id: 'regla', labelKey: 'calc.tab.regla', render: panel({
        campos: [
          { name: 'a', labelKey: 'calc.regla.a' }, { name: 'b', labelKey: 'calc.regla.b' },
          { name: 'c', labelKey: 'calc.regla.c' },
          { name: 'tipo', labelKey: 'calc.regla.tipo', tipo: 'select', opciones: ['directa', 'inversa'], valor: 'directa' }
        ],
        ejemplo: { a: '2', b: '6', c: '5' },
        resolver: d => {
          const r = steps.ruleOfThree(toFrac(d.a), toFrac(d.b), toFrac(d.c), d.tipo === 'inversa');
          if (!r.ok) return { error: 'cero' };
          return { valor: `x = ${fmt(r.x)}`, nota: r.x.isInteger() ? '' : `≈ ${fmt(r.decimal)}`, pasos: r.pasos };
        }
      }) },

      { id: 'porcentajes', labelKey: 'calc.tab.porcentajes', render: panel({
        campos: [
          { name: 'tipo', labelKey: 'calc.pct.tipo', tipo: 'select', opciones: ['deQue', 'queporcentaje', 'aumentar', 'descontar'], valor: 'deQue' },
          { name: 'a', labelKey: 'calc.pct.a' }, { name: 'b', labelKey: 'calc.pct.b' }
        ],
        ejemplo: { a: '20', b: '150' },
        resolver: d => {
          const r = steps.percentage(d.tipo, toFrac(d.a), toFrac(d.b));
          if (!r.ok) return { error: 'totalCero' };
          return { valor: fmt(r.resultado), pasos: r.pasos };
        }
      }) },

      { id: 'potencias', labelKey: 'calc.tab.potencias', render: panel({
        campos: [
          { name: 'b', labelKey: 'calc.pot.base' },
          { name: 'e', labelKey: 'calc.pot.exp', hintKey: 'calc.pot.expHint' }
        ],
        ejemplo: { b: '2', e: '10' },
        resolver: d => {
          if (String(d.e).trim() === 'sqrt' || String(d.e).trim() === '√') {
            const r = steps.sqrtSteps(num(d.b));
            if (!r.ok) return { error: 'raizNegativa' };
            return { valor: fmt(r.resultado), pasos: r.pasos };
          }
          const r = steps.powerRoot(toFrac(d.b), num(d.e));
          if (!r.ok) return { error: 'general' };
          return { valor: r.resultado ? fmt(r.resultado) : fmt(r.decimal), nota: `≈ ${fmt(r.decimal)}`, pasos: r.pasos };
        }
      }) },

      { id: 'estadistica', labelKey: 'calc.tab.estadistica', render: panel({
        campos: [
          { name: 'datos', labelKey: 'calc.est.datos', tipo: 'textarea', placeholderKey: 'calc.est.placeholder' },
          { name: 'tipo', labelKey: 'calc.est.tipo', tipo: 'select', opciones: ['poblacional', 'muestral'], valor: 'poblacional' }
        ],
        ejemplo: { datos: '4, 8, 15, 16, 23, 42' },
        resolver: d => {
          const datos = steps.parseData(d.datos);
          const r = steps.statistics(datos, { muestral: d.tipo === 'muestral' });
          if (!r.ok) return { error: 'sinDatos' };
          return {
            valor: t('calc.est.resumen', { media: fmt(r.media), mediana: fmt(r.mediana), desviacion: fmt(r.desviacion) }),
            nota: t('calc.est.detalle', {
              n: r.n, min: fmt(r.min), max: fmt(r.max), rango: fmt(r.rango),
              moda: r.moda.length ? r.moda.map(fmt).join(', ') : t('calc.est.sinModa'),
              q1: fmt(r.q1), q3: fmt(r.q3), varianza: fmt(r.varianza)
            }),
            pasos: r.pasos
          };
        }
      }) }
    ];

    /* ---------------- Montaje ---------------- */
    const explicarToggle = toggle({
      label: t('calc.explicar'),
      checked: opciones.explicar,
      onChange: value => { opciones.explicar = value; savePrefs({ explicar: value }); nivelRow.hidden = !value; refrescar(); }
    });

    const nivelRow = settingRow({
      label: t('calc.nivel.label'),
      control: segmented({
        label: t('calc.nivel.label'),
        value: opciones.nivel,
        options: ['breve', 'detallado'].map(v => ({ value: v, label: t(`calc.nivel.${v}`) })),
        onChange: v => { opciones.nivel = v; savePrefs({ nivel: v }); refrescar(); }
      })
    });
    nivelRow.hidden = !opciones.explicar;

    let recalcular = null;
    const refrescar = () => recalcular?.();

    const tabsEl = tabs({
      label: t('tools.calculadora.name'),
      items: PESTANAS.map(p => ({
        id: p.id,
        label: t(p.labelKey),
        render: contenedor => p.render(contenedor)
      })),
      onChange: () => { mostrar('—'); pintarPasos(null); }
    });

    container.appendChild(h('div.page',
      h('header.page__header',
        h('h1.page__title', { text: t('tools.calculadora.name') }),
        h('p.page__lead', { text: t('tools.calculadora.desc') })
      ),
      h('div.stack',
        resultBox,
        stepsBox,
        settingRow({
          label: t('calc.explicar'), desc: t('calc.explicarDesc'),
          control: explicarToggle
        }),
        nivelRow,
        tabsEl,
        notice(t('calc.nota'), { kind: 'info' })
      )
    ));
  },

  unmount() {}
};
