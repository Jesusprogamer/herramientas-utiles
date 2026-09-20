/**
 * Modo test del formulario: configuracion, sesion y resultados.
 *
 * La pantalla del test es la misma que usa la tabla periodica
 * (src/ui/quiz.js); aqui solo esta lo propio del formulario.
 */
import { h, clear, append } from '../../ui/dom.js';
import { button, select, toggle, settingRow, notice, segmented } from '../../ui/components.js';
import { confirm } from '../../ui/dialog.js';
import { toastOk } from '../../ui/toast.js';
import { montarTest } from '../../ui/quiz.js';
import * as storage from '../../core/storage.js';
import { t, formatDate, formatNumber } from '../../core/i18n.js';
import { FORMULAS, GRUPOS } from '../../data/formulas.js';
import { TIPOS, generar } from '../../lib/quiz/formulas.js';
import { tomar, alHistorial, puntosFlacos } from '../../lib/quiz/session.js';

const KEY = 'quiz-formulario';
const HIST_KEY = 'quiz-formulario-historial';

/** Preajustes de fabrica: no se pueden borrar ni cambiar. */
export const PREAJUSTES = Object.freeze({
  reconocer: {
    tipos: ['expresion', 'nombre'], formato: 'opciones', cuantas: 10,
    tolerancia: { modo: 'porcentaje', valor: 1 }, texto: { erratas: true },
    comentario: 'cada', filtros: {}
  },
  normal: {
    tipos: ['expresion', 'nombre', 'variable', 'unidad'], formato: 'mezcla', cuantas: 20,
    tolerancia: { modo: 'porcentaje', valor: 1 }, texto: { erratas: true },
    comentario: 'cada', filtros: {}
  },
  ejercicios: {
    tipos: ['calcular'], formato: 'escribir', cuantas: 10,
    tolerancia: { modo: 'porcentaje', valor: 1 }, texto: { erratas: true },
    comentario: 'cada', filtros: {}
  }
});

const POR_DEFECTO = () => ({ ...PREAJUSTES.normal, nombre: 'normal' });

function leer() {
  const guardado = storage.get(KEY, null);
  const base = POR_DEFECTO();
  if (!guardado || typeof guardado !== 'object') return { config: base, propios: {} };
  return {
    config: { ...base, ...guardado.config },
    propios: guardado.propios && typeof guardado.propios === 'object' ? guardado.propios : {}
  };
}

const escribir = datos => storage.set(KEY, datos);
const historial = () => {
  const lista = storage.get(HIST_KEY, []);
  return Array.isArray(lista) ? lista : [];
};

export default function modoTest(contenedor, { favoritas = [], alSalir }) {
  let { config, propios } = leer();
  let test = null;

  const vista = h('div.stack');
  contenedor.appendChild(vista);

  const guardarConfig = () => escribir({ config, propios });

  /* Las traducciones que necesita el generador de preguntas. */
  const textos = {
    nombre: f => t(`formulas.${f.id}.nombre`),
    variable: n => t(`formulas.var.${n}`),
    unidad: u => (u ? t(`formulas.unidad.${u}`) : ''),
    numero: x => formatNumber(x),
    frase: (clave, params) => t(clave, params)
  };

  /* ---------------- configuracion ---------------- */

  function pintarConfig() {
    test?.limpiar();
    test = null;
    clear(vista);

    const preajuste = select({
      label: t('quiz.preajuste.label'),
      value: config.nombre || 'normal',
      options: [
        ...Object.keys(PREAJUSTES).map(k => ({ value: k, label: t(`quiz.form.preajuste.${k}`) })),
        ...Object.keys(propios).map(k => ({ value: `p:${k}`, label: k }))
      ],
      onChange: e => {
        const v = e.target.value;
        const base = v.startsWith('p:') ? propios[v.slice(2)] : PREAJUSTES[v];
        config = { ...POR_DEFECTO(), ...base, nombre: v };
        guardarConfig();
        pintarConfig();
      }
    });

    const tipos = h('div.quiz__tipos');
    for (const tipo of TIPOS) {
      const activo = config.tipos.includes(tipo);
      const b = h('button.btn.btn--sm', {
        type: 'button',
        'aria-pressed': String(activo),
        text: t(`quiz.form.tipo.${tipo}`),
        onClick: () => {
          const set = new Set(config.tipos);
          set.has(tipo) ? set.delete(tipo) : set.add(tipo);
          config = { ...config, tipos: [...set] };
          guardarConfig();
          pintarConfig();
        }
      });
      if (activo) b.classList.add('btn--primary');
      tipos.appendChild(b);
    }

    const formato = segmented({
      label: t('quiz.formato.label'),
      value: config.formato,
      options: ['escribir', 'opciones', 'mezcla'].map(v => ({ value: v, label: t(`quiz.formato.${v}`) })),
      onChange: v => { config = { ...config, formato: v }; guardarConfig(); }
    });

    const cuantas = select({
      label: t('quiz.cuantas'),
      value: String(config.cuantas),
      options: [10, 20, 50, 0].map(n => ({ value: String(n), label: n ? String(n) : t('quiz.sinFin') })),
      onChange: e => { config = { ...config, cuantas: Number(e.target.value) }; guardarConfig(); }
    });

    const comentario = segmented({
      label: t('quiz.comentario.label'),
      value: config.comentario,
      options: ['cada', 'final'].map(v => ({ value: v, label: t(`quiz.comentario.${v}`) })),
      onChange: v => { config = { ...config, comentario: v }; guardarConfig(); }
    });

    /* Sobre que formulas */
    const grupo = select({
      label: t('form.grupo'),
      value: config.filtros?.grupos?.[0] || 'todos',
      options: [{ value: 'todos', label: t('form.todos') },
        ...GRUPOS.map(g => ({ value: g, label: t(`formulas.grupo.${g}`) }))],
      onChange: e => {
        const v = e.target.value;
        config = { ...config, filtros: { ...config.filtros, grupos: v === 'todos' ? undefined : [v] } };
        guardarConfig();
        pintarConfig();
      }
    });

    const soloFavoritas = toggle({
      label: t('quiz.form.soloFavoritas'),
      checked: Boolean(config.filtros?.favoritas?.length),
      onChange: v => {
        config = { ...config, filtros: { ...config.filtros, favoritas: v ? favoritas : undefined } };
        guardarConfig();
        pintarConfig();
      }
    });

    const avanzadas = h('details.quiz__avanzadas',
      h('summary', { text: t('quiz.avanzadas') }),
      settingRow({
        label: t('quiz.tolerancia.label'), desc: t('quiz.form.toleranciaDesc'),
        control: select({
          label: t('quiz.tolerancia.label'),
          value: config.tolerancia.modo,
          options: ['entero', 'decimales', 'absoluta', 'porcentaje'].map(v => ({ value: v, label: t(`quiz.tolerancia.${v}`) })),
          onChange: e => {
            const modo = e.target.value;
            const valores = { entero: {}, decimales: { n: 2 }, absoluta: { valor: 0.1 }, porcentaje: { valor: 1 } };
            config = { ...config, tolerancia: { modo, ...valores[modo] } };
            guardarConfig();
          }
        })
      }),
      settingRow({
        label: t('quiz.erratas'), desc: t('quiz.erratasDesc'),
        control: toggle({
          label: t('quiz.erratas'),
          checked: config.texto?.erratas !== false,
          onChange: v => { config = { ...config, texto: { ...config.texto, erratas: v } }; guardarConfig(); }
        })
      })
    );

    const guardarPropio = button(t('quiz.guardarPreajuste'), {
      icon: 'star',
      onClick: () => {
        const nombre = window.prompt(t('quiz.nombrePreajuste'));
        if (!nombre?.trim()) return;
        propios = { ...propios, [nombre.trim()]: { ...config } };
        config = { ...config, nombre: `p:${nombre.trim()}` };
        guardarConfig();
        pintarConfig();
        toastOk(t('quiz.preajusteGuardado'));
      }
    });

    const disponibles = generar(FORMULAS, {
      tipos: config.tipos, filtros: config.filtros, textos
    }).length;

    append(vista, [
      preajuste,
      h('h3.form__nombre', { text: t('quiz.queMePregunta') }),
      tipos,
      settingRow({ label: t('quiz.formato.label'), control: formato }),
      cuantas,
      settingRow({ label: t('quiz.comentario.label'), control: comentario }),
      h('h3.form__nombre', { text: t('quiz.form.sobreQue') }),
      grupo,
      settingRow({ label: t('quiz.form.soloFavoritas'), control: soloFavoritas }),
      avanzadas,
      h('p.small.muted', { text: t('quiz.disponibles', { n: disponibles }) }),
      disponibles === 0 ? notice(t('quiz.nadaQuePreguntar'), { kind: 'warning' }) : null,
      h('div.row',
        button(t('quiz.empezar'), { variant: 'primary', icon: 'checklist', onClick: () => empezarTest() }),
        guardarPropio,
        button(t('quiz.restablecer'), { icon: 'refresh', onClick: () => { config = POR_DEFECTO(); guardarConfig(); pintarConfig(); } }),
        button(t('quiz.form.volver'), { onClick: alSalir })
      ),
      bloqueHistorial()
    ]);
  }

  /* ---------------- historial ---------------- */

  /** El historial guarda la clave; aqui se enseña el nombre que se lee. */
  const nombrePreajuste = clave => {
    if (!clave) return '—';
    if (clave.startsWith('p:')) return clave.slice(2);
    return PREAJUSTES[clave] ? t(`quiz.form.preajuste.${clave}`) : clave;
  };

  function bloqueHistorial() {
    const lista = historial();
    if (!lista.length) return null;
    const { porTipo, porTema } = puntosFlacos(lista);

    const caja = h('details.quiz__historial',
      h('summary', { text: t('quiz.historial', { n: lista.length }) })
    );
    const ul = h('ul.quiz__sesiones');
    for (const s of lista.slice(0, 10)) {
      ul.appendChild(h('li.row',
        h('span.small.muted.grow', { text: formatDate(new Date(s.cuando), { dateStyle: 'short', timeStyle: 'short' }) }),
        h('span.small', { text: nombrePreajuste(s.preajuste) }),
        h('span.quiz__pct', { text: `${s.porcentaje} %` })
      ));
    }
    caja.appendChild(ul);

    if (porTipo.length) {
      caja.appendChild(h('p.small.muted', {
        text: t('quiz.masFallas', {
          tipos: porTipo.slice(0, 3).map(x => t(`quiz.form.tipo.${x.clave}`)).join(', '),
          temas: porTema.slice(0, 5).map(x => t(`formulas.${x.clave}.nombre`)).join(', ') || '—'
        })
      }));
    }

    caja.appendChild(button(t('quiz.borrarHistorial'), {
      onClick: async () => {
        const ok = await confirm({
          title: t('quiz.borrarHistorial'),
          message: t('papelera.eliminarAviso'),
          confirmLabel: t('common.delete'), danger: true
        });
        if (!ok) return;
        storage.set(HIST_KEY, []);
        pintarConfig();
      }
    }));
    return caja;
  }

  /* ---------------- sesion ---------------- */

  function empezarTest() {
    const todas = generar(FORMULAS, {
      tipos: config.tipos, filtros: config.filtros, textos, formato: config.formato
    });
    if (!todas.length) return;

    // «Mezcla» decide pregunta a pregunta; los tipos que solo tienen
    // sentido con opciones (la expresion) ya vienen marcados.
    const preguntas = tomar(todas, config.cuantas).map(p => ({
      ...p,
      formato: p.formato === 'opciones' ? 'opciones'
        : config.formato === 'opciones' ? 'opciones'
          : config.formato === 'mezcla' ? (Math.random() < 0.5 ? 'opciones' : 'escribir')
            : 'escribir'
    }));

    clear(vista);
    test = montarTest(preguntas, {
      comentario: config.comentario,
      tolerancia: config.tolerancia,
      texto: config.texto
    }, {
      senuelos: pregunta => senuelosDe(pregunta),
      alTerminar: r => {
        storage.set(HIST_KEY, alHistorial(historial(), {
          cuando: Date.now(),
          preajuste: config.nombre,
          porcentaje: r.porcentaje,
          fallos: r.listaFallos.map(f => ({ tipo: f.pregunta.tipo, tema: f.pregunta.tema }))
        }));
      },
      alSalir: () => pintarConfig()
    });
    vista.appendChild(test.caja);
  }

  /** Señuelos para las opciones multiples: del mismo tipo de pregunta. */
  function senuelosDe(pregunta) {
    return generar(FORMULAS, { tipos: [pregunta.tipo], filtros: config.filtros, textos })
      .map(p => String(p.respuesta));
  }

  pintarConfig();
  return () => { test?.limpiar(); };
}
