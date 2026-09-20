/**
 * Modo test de la tabla periodica: configuracion, sesion y resultados.
 *
 * La configuracion se guarda sola: la ultima usada se carga al abrir, para
 * no tener que ponerla otra vez. Los preajustes propios se guardan aparte.
 */
import { h, clear, append } from '../../ui/dom.js';
import { button, field, select, toggle, settingRow, notice, segmented } from '../../ui/components.js';
import { confirm } from '../../ui/dialog.js';
import { toastOk } from '../../ui/toast.js';
import { montarTest } from '../../ui/quiz.js';
import * as storage from '../../core/storage.js';
import { t, formatDate } from '../../core/i18n.js';
import { ELEMENTS } from '../../data/elements.js';
import { TIPOS, generar, sinValencias, valenciasAceptadas } from '../../lib/quiz/elements.js';
import { tomar, alHistorial, puntosFlacos } from '../../lib/quiz/session.js';

const KEY = 'quiz-tabla';
const HIST_KEY = 'quiz-tabla-historial';

/** Preajustes de fabrica: no se pueden borrar ni cambiar. */
export const PREAJUSTES = Object.freeze({
  facil: {
    tipos: ['simbolo', 'nombre'], formato: 'opciones', cuantas: 10,
    tolerancia: { modo: 'entero' }, texto: { erratas: true },
    valencias: { modo: 'una' }, comentario: 'cada', filtros: { zHasta: 20 }
  },
  normal: {
    tipos: ['simbolo', 'nombre', 'z', 'grupo', 'periodo', 'categoria'],
    formato: 'mezcla', cuantas: 20, tolerancia: { modo: 'decimales', n: 1 },
    texto: { erratas: true }, valencias: { modo: 'una' }, comentario: 'cada', filtros: {}
  },
  estricto: {
    tipos: [...TIPOS], formato: 'escribir', cuantas: 20,
    tolerancia: { modo: 'decimales', n: 2 },
    texto: { erratas: false, tildes: true, mayusculas: true },
    valencias: { modo: 'todas', penalizar: true }, comentario: 'final', filtros: {}
  }
});

const POR_DEFECTO = () => ({ ...PREAJUSTES.normal, nombre: 'normal', porElemento: {} });

function leer() {
  const guardado = storage.get(KEY, null);
  const base = POR_DEFECTO();
  if (!guardado || typeof guardado !== 'object') return { config: base, propios: {} };
  return {
    config: { ...base, ...guardado.config, porElemento: guardado.config?.porElemento || {} },
    propios: guardado.propios && typeof guardado.propios === 'object' ? guardado.propios : {}
  };
}

const escribir = datos => storage.set(KEY, datos);
const historial = () => {
  const h2 = storage.get(HIST_KEY, []);
  return Array.isArray(h2) ? h2 : [];
};

export default function modoTest(contenedor, { nombreDe, etiquetaDe, favoritos = [], alSalir }) {
  let { config, propios } = leer();
  let test = null;

  const vista = h('div.stack');
  contenedor.appendChild(vista);

  const guardarConfig = () => escribir({ config, propios });

  /* ---------------- configuracion ---------------- */

  function pintarConfig() {
    test?.limpiar();
    test = null;
    clear(vista);

    const nombresPreajustes = [
      ...Object.keys(PREAJUSTES).map(k => ({ value: k, label: t(`quiz.preajuste.${k}`) })),
      ...Object.keys(propios).map(k => ({ value: `p:${k}`, label: k }))
    ];

    const preajuste = select({
      label: t('quiz.preajuste.label'),
      value: config.nombre || 'normal',
      options: nombresPreajustes,
      onChange: e => {
        const v = e.target.value;
        const base = v.startsWith('p:') ? propios[v.slice(2)] : PREAJUSTES[v];
        config = { ...POR_DEFECTO(), ...base, nombre: v, porElemento: config.porElemento };
        guardarConfig();
        pintarConfig();
      }
    });

    /* Qué me pregunta */
    const tipos = h('div.quiz__tipos');
    for (const tipo of TIPOS) {
      const activo = config.tipos.includes(tipo);
      const b = h('button.btn.btn--sm', {
        type: 'button',
        'aria-pressed': String(activo),
        text: t(`quiz.tipo.${tipo}`),
        onClick: () => {
          const set = new Set(config.tipos);
          set.has(tipo) ? set.delete(tipo) : set.add(tipo);
          config = { ...config, tipos: [...set], nombre: config.nombre };
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

    /* Sobre qué elementos */
    const zDesde = field({
      label: t('quiz.zDesde'), type: 'number',
      value: config.filtros?.zDesde ?? '',
      onInput: e => {
        const v = Number(e.target.value);
        config = { ...config, filtros: { ...config.filtros, zDesde: Number.isFinite(v) && v > 0 ? v : undefined } };
        guardarConfig();
      }
    });
    const zHasta = field({
      label: t('quiz.zHasta'), type: 'number',
      value: config.filtros?.zHasta ?? '',
      onInput: e => {
        const v = Number(e.target.value);
        config = { ...config, filtros: { ...config.filtros, zHasta: Number.isFinite(v) && v > 0 ? v : undefined } };
        guardarConfig();
      }
    });
    const soloFavoritos = toggle({
      label: t('quiz.soloFavoritos'),
      checked: Boolean(config.filtros?.favoritos?.length),
      onChange: v => {
        config = { ...config, filtros: { ...config.filtros, favoritos: v ? favoritos : undefined } };
        guardarConfig();
      }
    });

    /* Cómo se corrige */
    const avanzadas = h('details.quiz__avanzadas',
      h('summary', { text: t('quiz.avanzadas') }),
      settingRow({
        label: t('quiz.tolerancia.label'),
        control: select({
          label: t('quiz.tolerancia.label'),
          value: config.tolerancia.modo,
          options: ['entero', 'decimales', 'absoluta', 'porcentaje'].map(v => ({ value: v, label: t(`quiz.tolerancia.${v}`) })),
          onChange: e => {
            const modo = e.target.value;
            const valores = { entero: {}, decimales: { n: 1 }, absoluta: { valor: 0.1 }, porcentaje: { valor: 5 } };
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
      }),
      settingRow({
        label: t('quiz.mayusculas'), desc: t('quiz.mayusculasDesc'),
        control: toggle({
          label: t('quiz.mayusculas'),
          checked: config.texto?.mayusculas === true,
          onChange: v => { config = { ...config, texto: { ...config.texto, mayusculas: v } }; guardarConfig(); }
        })
      }),
      settingRow({
        label: t('quiz.valenciasModo'), desc: t('quiz.valenciasDesc'),
        control: select({
          label: t('quiz.valenciasModo'),
          value: config.valencias?.modo || 'una',
          options: ['una', 'todas'].map(v => ({ value: v, label: t(`quiz.valencias.${v}`) })),
          onChange: e => { config = { ...config, valencias: { ...config.valencias, modo: e.target.value } }; guardarConfig(); }
        })
      }),
      settingRow({
        label: t('quiz.penalizar'), desc: t('quiz.penalizarDesc'),
        control: toggle({
          label: t('quiz.penalizar'),
          checked: config.valencias?.penalizar === true,
          onChange: v => { config = { ...config, valencias: { ...config.valencias, penalizar: v } }; guardarConfig(); }
        })
      }),
      valenciasPorElemento()
    );

    const guardarPropio = button(t('quiz.guardarPreajuste'), {
      icon: 'star',
      onClick: async () => {
        const nombre = window.prompt(t('quiz.nombrePreajuste'));
        if (!nombre?.trim()) return;
        propios = { ...propios, [nombre.trim()]: { ...config } };
        config = { ...config, nombre: `p:${nombre.trim()}` };
        guardarConfig();
        pintarConfig();
        toastOk(t('quiz.preajusteGuardado'));
      }
    });

    const restablecer = button(t('quiz.restablecer'), {
      icon: 'refresh',
      onClick: () => { config = POR_DEFECTO(); guardarConfig(); pintarConfig(); }
    });

    const empezar = button(t('quiz.empezar'), {
      variant: 'primary', icon: 'checklist',
      onClick: () => empezarTest()
    });

    const disponibles = generar(ELEMENTS, {
      tipos: config.tipos, filtros: config.filtros, nombreDe, etiquetaDe
    }).length;

    const fuera = sinValencias(ELEMENTS).map(e => e.symbol);

    // `append` propio: el del DOM convertiria los null en el texto "null".
    append(vista, [
      preajuste,
      h('h3.form__nombre', { text: t('quiz.queMePregunta') }),
      tipos,
      settingRow({ label: t('quiz.formato.label'), control: formato }),
      cuantas,
      settingRow({ label: t('quiz.comentario.label'), control: comentario }),
      h('h3.form__nombre', { text: t('quiz.sobreQue') }),
      h('div.row', h('div.grow', zDesde), h('div.grow', zHasta)),
      settingRow({ label: t('quiz.soloFavoritos'), control: soloFavoritos }),
      avanzadas,
      h('p.small.muted', { text: t('quiz.disponibles', { n: disponibles }) }),
      config.tipos.includes('valencias') && fuera.length
        ? notice(t('quiz.sinValencias', { lista: fuera.join(', ') }), { kind: 'info' })
        : null,
      disponibles === 0 ? notice(t('quiz.nadaQuePreguntar'), { kind: 'warning' }) : null,
      h('div.row', empezar, guardarPropio, restablecer, button(t('quiz.volver'), { onClick: alSalir })),
      bloqueHistorial()
    ]);
  }

  /** Casillas por elemento: que valencias cuentan como acierto. */
  function valenciasPorElemento() {
    const caja = h('details.quiz__valencias',
      h('summary', { text: t('quiz.porElemento') }),
      h('p.small.muted', { text: t('quiz.porElementoDesc') })
    );
    const lista = h('div.stack');

    const pintar = () => {
      clear(lista);
      const candidatos = ELEMENTS
        .filter(e => e.oxidation?.length)
        .filter(e => !config.filtros?.zHasta || e.z <= config.filtros.zHasta)
        .slice(0, 40);
      for (const elemento of candidatos) {
        const aceptadas = valenciasAceptadas(elemento, config);
        const fila = h('div.row', h('span.small.grow', { text: `${elemento.symbol} · ${nombreDe(elemento)}` }));
        for (const v of elemento.oxidation) {
          const on = aceptadas.includes(v);
          const b = h('button.btn.btn--sm', {
            type: 'button',
            'aria-pressed': String(on),
            'aria-label': t('quiz.valenciaDe', { v: v > 0 ? `+${v}` : v, e: nombreDe(elemento) }),
            text: `${v > 0 ? '+' : ''}${v} ${on ? '✓' : '✗'}`,
            onClick: () => {
              const actuales = new Set(valenciasAceptadas(elemento, config));
              actuales.has(v) ? actuales.delete(v) : actuales.add(v);
              config = {
                ...config,
                porElemento: { ...config.porElemento, [elemento.symbol]: [...actuales] }
              };
              guardarConfig();
              pintar();
            }
          });
          if (on) b.classList.add('btn--primary');
          fila.appendChild(b);
        }
        lista.appendChild(fila);
      }
    };

    pintar();
    caja.append(lista, button(t('quiz.restablecerValencias'), {
      onClick: () => { config = { ...config, porElemento: {} }; guardarConfig(); pintar(); }
    }));
    return caja;
  }

  /* ---------------- historial ---------------- */

  /** El historial guarda la clave; aqui se enseña el nombre que se lee. */
  const nombrePreajuste = clave => {
    if (!clave) return '—';
    if (clave.startsWith('p:')) return clave.slice(2);
    return PREAJUSTES[clave] ? t(`quiz.preajuste.${clave}`) : clave;
  };

  function bloqueHistorial() {
    const h2 = historial();
    if (!h2.length) return h('div');
    const { porTipo, porTema } = puntosFlacos(h2);
    const caja = h('details.quiz__historial',
      h('summary', { text: t('quiz.historial', { n: h2.length }) })
    );
    const ul = h('ul.quiz__sesiones');
    for (const s of h2.slice(0, 10)) {
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
          tipos: porTipo.slice(0, 3).map(x => t(`quiz.tipo.${x.clave}`)).join(', '),
          temas: porTema.slice(0, 5).map(x => x.clave).join(', ') || '—'
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

  function empezarTest(soloEstas = null) {
    const todas = soloEstas || generar(ELEMENTS, {
      tipos: config.tipos,
      filtros: config.filtros,
      nombreDe,
      etiquetaDe,
      formato: config.formato,
      config
    });
    if (!todas.length) return;

    // «Mezcla» decide pregunta a pregunta; los tipos que solo tienen
    // sentido con opciones (categoria, estado) ya vienen marcados.
    const preguntas = tomar(todas, config.cuantas).map(p => ({
      ...p,
      formato: p.formato === 'opciones' ? 'opciones'
        : config.formato === 'opciones' ? 'opciones'
          : config.formato === 'mezcla' ? (Math.random() < 0.5 ? 'opciones' : 'escribir')
            : 'escribir'
    }));

    clear(vista);
    test = montarTest(vista, preguntas, {
      comentario: config.comentario,
      tolerancia: config.tolerancia,
      texto: config.texto,
      valencias: config.valencias,
      formaConfig: 'ambas'
    }, {
      senuelos: pregunta => senuelosDe(pregunta),
      alTerminar: (r) => {
        storage.set(HIST_KEY, alHistorial(historial(), {
          cuando: Date.now(),
          preajuste: config.nombre,
          porcentaje: r.porcentaje,
          fallos: r.listaFallos.map(f => ({ tipo: f.pregunta.tipo, tema: f.pregunta.tema }))
        }));
      },
      alSalir: () => pintarConfig()
    });
  }

  /** Señuelos para las opciones multiples: del mismo tipo de pregunta. */
  function senuelosDe(pregunta) {
    const mismas = generar(ELEMENTS, {
      tipos: [pregunta.tipo], filtros: config.filtros, nombreDe, etiquetaDe
    });
    return mismas.map(p => (Array.isArray(p.respuesta) ? p.respuesta.join(', ') : String(p.respuesta)));
  }

  pintarConfig();
  return () => { test?.limpiar(); };
}
