/**
 * Formulario buscable con calculadora por formula.
 *
 * El catalogo y los despejes estan en src/data/formulas.js: cada incognita
 * tiene su propia funcion, escrita a mano, asi que no se construye codigo
 * en tiempo de ejecucion. Aqui solo esta la interfaz.
 */
import { h, clear, copyText } from '../../ui/dom.js';
import { button, iconButton, field, select, notice } from '../../ui/components.js';
import { toastOk, toastError } from '../../ui/toast.js';
import * as storage from '../../core/storage.js';
import { t, formatNumber } from '../../core/i18n.js';
import { FORMULAS, GRUPOS, resolver, despejables } from '../../data/formulas.js';
import { filtrar } from './pure.js';

const KEY = 'formulario';

const nombreFormula = f => t(`formulas.${f.id}.nombre`);
const descFormula = f => t(`formulas.${f.id}.desc`);
const nombreVar = n => t(`formulas.var.${n}`);
const unidad = u => (u ? t(`formulas.unidad.${u}`) : '');

/** Acepta coma o punto decimal; devuelve NaN si no hay nada utilizable. */
const num = texto => {
  const limpio = String(texto).trim().replace(/\s/g, '').replace(',', '.');
  if (limpio === '') return NaN;
  const n = Number(limpio);
  return Number.isFinite(n) ? n : NaN;
};

export default {
  id: 'formulario',

  mount(container) {
    const guardado = storage.get(KEY, null) || {};
    const estado = {
      grupo: GRUPOS.includes(guardado.grupo) ? guardado.grupo : 'todos',
      favoritas: Array.isArray(guardado.favoritas)
        ? guardado.favoritas.filter(id => FORMULAS.some(f => f.id === id))
        : [],
      abierta: guardado.abierta || null
    };
    let consulta = '';

    const guardar = () => storage.set(KEY, estado);

    const lista = h('div.stack');
    const cuenta = h('p.small.muted', { 'aria-live': 'polite' });

    /* ---------------- calculadora de una formula ---------------- */
    function calculadora(f) {
      const caja = h('div.form__calc');
      const campos = new Map();
      const salida = h('p.form__resultado', { 'aria-live': 'polite' });
      const pasos = h('div.stack');
      const opciones = despejables(f);
      let incognita = opciones[0];

      const valores = () => {
        const v = {};
        for (const [nombre, campo] of campos) v[nombre] = num(campo.input.value);
        return v;
      };

      function calcular() {
        clear(pasos);
        const v = valores();
        const r = resolver(f, incognita, v);
        if (r.error) {
          salida.textContent = r.error === 'positiva'
            ? t('form.error.positiva', { variable: nombreVar(r.variable) })
            : t(`form.error.${r.error}`);
          salida.classList.add('form__resultado--error');
          return;
        }
        salida.classList.remove('form__resultado--error');
        const u = f.vars.find(x => x.n === incognita)?.unidad;
        salida.textContent = t('form.resultado', {
          variable: nombreVar(incognita),
          valor: formatNumber(Number(r.valor.toPrecision(8))),
          unidad: u ? ` ${unidad(u)}` : ''
        });

        const sustituido = f.vars
          .filter(x => x.n !== incognita)
          .map(x => `${x.n} = ${formatNumber(v[x.n])}`)
          .join(' · ');
        pasos.append(
          h('p.small.muted', { text: t('form.despeje', { expr: f.expr }) }),
          h('p.small.muted.mono', { text: t('form.sustitucion', { expr: sustituido }) })
        );
      }

      function pintarCampos() {
        for (const [nombre, campo] of campos) {
          campo.hidden = nombre === incognita;
          if (nombre === incognita) campo.input.value = '';
        }
        calcular();
      }

      const selIncognita = select({
        label: t('form.incognita'),
        value: incognita,
        options: opciones.map(n => ({ value: n, label: `${nombreVar(n)} (${n})` })),
        onChange: e => { incognita = e.target.value; pintarCampos(); }
      });

      const rejilla = h('div.form__campos');
      for (const v of f.vars) {
        const sugerido = f.valores?.[v.n];
        const entrada = field({
          label: `${nombreVar(v.n)} (${v.n})${v.unidad ? ` · ${unidad(v.unidad)}` : ''}`,
          type: 'text', inputmode: 'decimal',
          value: sugerido !== undefined ? String(sugerido) : '',
          hint: sugerido !== undefined ? t('form.valorSugerido') : undefined,
          onInput: calcular
        });
        entrada.input.classList.add('mono');
        campos.set(v.n, entrada);
        rejilla.appendChild(entrada);
      }

      caja.append(
        selIncognita,
        rejilla,
        salida,
        pasos,
        h('div.row',
          button(t('form.limpiar'), {
            icon: 'refresh',
            onClick: () => {
              for (const [nombre, campo] of campos) {
                campo.input.value = f.valores?.[nombre] !== undefined ? String(f.valores[nombre]) : '';
              }
              calcular();
            }
          }),
          button(t('form.copiar'), {
            icon: 'download',
            onClick: async () => {
              if (salida.classList.contains('form__resultado--error') || !salida.textContent) {
                toastError(t('form.error.faltan'));
                return;
              }
              (await copyText(salida.textContent)) ? toastOk(t('common.copied')) : toastError(t('common.copyFailed'));
            }
          })
        )
      );

      pintarCampos();
      return caja;
    }

    /* ---------------- tarjeta de una formula ---------------- */
    function tarjeta(f) {
      const abierta = estado.abierta === f.id;
      const esFavorita = estado.favoritas.includes(f.id);

      const cuerpo = h('div');
      if (abierta) cuerpo.appendChild(calculadora(f));

      const abrir = button(abierta ? t('form.cerrar') : t('form.calcular'), {
        variant: abierta ? '' : 'primary',
        onClick: () => {
          estado.abierta = abierta ? null : f.id;
          guardar();
          pintar();
        }
      });
      abrir.setAttribute('aria-expanded', String(abierta));

      const favorita = iconButton('star', esFavorita ? t('form.quitarFavorita') : t('form.favorita'), {
        pressed: esFavorita,
        onClick: () => {
          estado.favoritas = esFavorita
            ? estado.favoritas.filter(id => id !== f.id)
            : [...estado.favoritas, f.id];
          guardar();
          pintar();
        }
      });

      return h('article.form__tarjeta',
        h('div.row',
          h('div.grow',
            h('h2.form__nombre', { text: nombreFormula(f) }),
            h('p.form__expr.mono', { text: f.expr }),
            h('p.small.muted', { text: descFormula(f) })),
          favorita),
        h('div.row', h('span.form__tema', { text: t(`formulas.grupo.${f.grupo}`) }), abrir),
        cuerpo
      );
    }

    /* ---------------- pintado ---------------- */
    function pintar() {
      clear(lista);
      const encontradas = filtrar(FORMULAS, consulta, estado.grupo, nombreFormula);
      cuenta.textContent = encontradas.length === 1
        ? t('form.unaFormula')
        : t('form.resultados', { n: encontradas.length });

      if (!encontradas.length) {
        lista.appendChild(notice(t('form.sinResultados', { q: consulta }), { kind: 'warning' }));
        return;
      }

      const favoritas = encontradas.filter(f => estado.favoritas.includes(f.id));
      const resto = encontradas.filter(f => !estado.favoritas.includes(f.id));

      if (favoritas.length) {
        lista.appendChild(h('p.small.muted', { text: t('form.favoritas') }));
        for (const f of favoritas) lista.appendChild(tarjeta(f));
      }
      for (const f of resto) lista.appendChild(tarjeta(f));
    }

    const busqueda = field({
      label: t('form.buscar'), type: 'search', hint: t('form.buscarAyuda'),
      onInput: e => { consulta = e.target.value; pintar(); }
    });

    const grupo = select({
      label: t('form.grupo'), value: estado.grupo,
      options: [{ value: 'todos', label: t('form.todos') },
        ...GRUPOS.map(g => ({ value: g, label: t(`formulas.grupo.${g}`) }))],
      onChange: e => { estado.grupo = e.target.value; guardar(); pintar(); }
    });

    container.appendChild(h('div.page',
      h('header.page__header',
        h('h1.page__title', { text: t('tools.formulario.name') }),
        h('p.page__lead', { text: t('tools.formulario.desc') })
      ),
      h('div.stack',
        busqueda,
        grupo,
        cuenta,
        lista,
        notice(t('form.nota'), { kind: 'info' })
      )
    ));

    pintar();
  },

  unmount() {}
};
