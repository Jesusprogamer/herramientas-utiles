/**
 * Calculadora de notas.
 *
 * Trabaja sobre las asignaturas compartidas (src/core/subjects.js), asi
 * que las mismas valen para la agenda y el horario. Los calculos estan en
 * src/lib/grades.js, que se prueba aparte.
 */
import { h, clear } from '../../ui/dom.js';
import { button, iconButton, field, notice, settingRow, segmented } from '../../ui/components.js';
import { gestor, punto, conColor } from '../../ui/subjects-ui.js';
import { toastOk } from '../../ui/toast.js';
import * as storage from '../../core/storage.js';
import * as subjects from '../../core/subjects.js';
import { on } from '../../core/events.js';
import { t, formatNumber } from '../../core/i18n.js';
import { resumen, mediaGeneral } from '../../lib/grades.js';

const KEY = 'notas';
const ESCALAS = { diez: { maximo: 10, aprobado: 5 }, cien: { maximo: 100, aprobado: 50 } };

/** Acepta coma o punto; devuelve null si esta vacio o no es un numero. */
const num = texto => {
  const limpio = String(texto ?? '').trim().replace(',', '.');
  if (limpio === '') return null;
  const n = Number(limpio);
  return Number.isFinite(n) ? n : null;
};

const datos = () => {
  const guardado = storage.get(KEY, null) || {};
  return {
    escala: ESCALAS[guardado.escala] ? guardado.escala : 'diez',
    objetivo: Number.isFinite(guardado.objetivo) ? guardado.objetivo : null,
    porAsignatura: guardado.porAsignatura && typeof guardado.porAsignatura === 'object'
      ? guardado.porAsignatura
      : {}
  };
};

export default {
  id: 'notas',

  mount(container) {
    const estado = datos();
    const guardar = () => storage.set(KEY, estado);

    const escalaDe = () => ESCALAS[estado.escala];
    const objetivoDe = () => (estado.objetivo === null ? escalaDe().aprobado : estado.objetivo);

    /** Notas de una asignatura, saneadas. */
    const notasDe = id => {
      const lista = estado.porAsignatura[id];
      return Array.isArray(lista) ? lista : [];
    };
    const ponerNotas = (id, lista) => {
      estado.porAsignatura[id] = lista;
      guardar();
    };

    const tarjetas = h('div.stack');
    const general = h('div.notas__resumen');
    const asignaturasBox = h('div.stack');

    /* ---------------- resumen de una asignatura ---------------- */
    function pintarResumen(caja, notas) {
      clear(caja);
      const { maximo } = escalaDe();
      const r = resumen(notas, { objetivo: objetivoDe(), total: 100, maximo });

      const valor = h('p.notas__media', {
        text: r.media === null ? t('notas.sinNotas') : formatNumber(Number(r.media.toFixed(2)))
      });
      if (r.media !== null) {
        valor.classList.add(r.aprobada ? 'notas__media--aprobada' : 'notas__media--suspensa');
      }

      const barra = h('div.notas__barra', h('span'));
      barra.firstChild.style.width = `${Math.min(r.pesoHecho, 100)}%`;
      barra.setAttribute('role', 'img');
      barra.setAttribute('aria-label', t('notas.evaluado', { n: formatNumber(r.pesoHecho) }));

      const lineas = [
        h('p.small.muted', { text: t('notas.evaluado', { n: formatNumber(r.pesoHecho) }) })
      ];
      if (r.media !== null) {
        lineas.push(h('p.small.muted', { text: t('notas.acumulada', { n: formatNumber(Number(r.acumulada.toFixed(2))) }) }));
      }
      if (r.pesos.estado !== 'exacto') {
        lineas.push(h('p.small', {
          class: 'small nc--naranja',
          text: t(`notas.pesos.${r.pesos.estado}`, { n: formatNumber(Math.abs(r.pesos.diferencia)) })
        }));
      }

      const objetivo = r.objetivo;
      const meta = formatNumber(objetivoDe());
      if (objetivo.estado === 'conseguido') {
        lineas.push(h('p.small.nc--verde', { text: t('notas.objetivo.conseguido', { meta }) }));
      } else if (objetivo.estado === 'imposible') {
        lineas.push(h('p.small.nc--rojo', { text: t('notas.objetivo.imposible', { meta, n: formatNumber(objetivo.necesaria) }) }));
      } else if (objetivo.estado === 'necesitas') {
        lineas.push(h('p.small', {
          class: `small ${objetivo.holgada ? 'nc--verde' : 'nc--naranja'}`,
          text: t('notas.objetivo.necesitas', {
            meta, n: formatNumber(objetivo.necesaria), peso: formatNumber(r.pesoPendiente)
          })
        }));
      } else {
        lineas.push(h('p.small.muted', { text: t('notas.objetivo.nadaPendiente') }));
      }

      caja.append(valor, barra, ...lineas);
    }

    /* ---------------- tarjeta de una asignatura ---------------- */
    function tarjeta(asignatura) {
      const notas = notasDe(asignatura.id);
      const caja = conColor(h('article.asig__tarjeta'), asignatura);
      const filas = h('div.stack');
      const cajaResumen = h('div.notas__resumen');

      const refrescar = () => {
        ponerNotas(asignatura.id, notas);
        pintarResumen(cajaResumen, notas);
        pintarGeneral();
      };

      function pintarFilas() {
        clear(filas);
        if (!notas.length) {
          filas.appendChild(h('p.small.muted', { text: t('notas.sinExamenes') }));
          return;
        }
        notas.forEach((nota, i) => {
          const nombre = field({ label: t('notas.examen'), value: nota.nombre || '' });
          nombre.querySelector('.field__label')?.classList.add('visually-hidden');
          nombre.input.setAttribute('aria-label', t('notas.examen'));
          nombre.input.setAttribute('maxlength', '60');
          nombre.input.placeholder = t('notas.examenPlaceholder', { n: i + 1 });
          nombre.input.addEventListener('input', () => { nota.nombre = nombre.input.value; refrescar(); });

          const valor = field({ label: t('notas.nota.label'), type: 'text', inputmode: 'decimal', value: nota.valor ?? '' });
          valor.querySelector('.field__label')?.classList.add('visually-hidden');
          valor.input.setAttribute('aria-label', t('notas.notaDe', { n: i + 1 }));
          valor.input.classList.add('mono');
          valor.input.addEventListener('input', () => {
            const v = num(valor.input.value);
            nota.valor = v === null ? null : Math.min(Math.max(v, 0), escalaDe().maximo);
            refrescar();
          });

          const peso = field({ label: t('notas.peso'), type: 'text', inputmode: 'decimal', value: nota.peso ?? '' });
          peso.querySelector('.field__label')?.classList.add('visually-hidden');
          peso.input.setAttribute('aria-label', t('notas.pesoDe', { n: i + 1 }));
          peso.input.classList.add('mono');
          peso.input.addEventListener('input', () => {
            const v = num(peso.input.value);
            nota.peso = v === null ? 0 : Math.min(Math.max(v, 0), 100);
            refrescar();
          });

          filas.appendChild(h('div.notas__fila',
            nombre, valor, peso,
            iconButton('trash', t('notas.quitar', { n: i + 1 }), {
              onClick: () => { notas.splice(i, 1); pintarFilas(); refrescar(); }
            })
          ));
        });
      }

      const anadir = button(t('notas.anadir'), {
        icon: 'plus',
        onClick: () => {
          const restante = Math.max(100 - notas.reduce((s, n) => s + (n.peso || 0), 0), 0);
          notas.push({ nombre: '', valor: null, peso: restante || 0 });
          pintarFilas();
          refrescar();
        }
      });

      const repartir = button(t('notas.repartir'), {
        onClick: () => {
          if (!notas.length) return;
          const peso = Math.round((100 / notas.length) * 100) / 100;
          notas.forEach((n, i) => { n.peso = i === notas.length - 1 ? Math.round((100 - peso * (notas.length - 1)) * 100) / 100 : peso; });
          pintarFilas();
          refrescar();
          toastOk(t('notas.repartido'));
        }
      });

      caja.append(
        h('div.row', punto(asignatura), h('h2.asig__nombre', { text: asignatura.nombre })),
        h('div.row.small.muted',
          h('span.grow', { text: t('notas.examen') }),
          h('span', { text: t('notas.nota.label') }),
          h('span', { text: t('notas.peso') })),
        filas,
        h('div.row', anadir, repartir),
        cajaResumen
      );

      pintarFilas();
      pintarResumen(cajaResumen, notas);
      return caja;
    }

    /* ---------------- media general ---------------- */
    function pintarGeneral() {
      clear(general);
      const lista = subjects.all();
      const conNotas = lista.map(a => ({ notas: notasDe(a.id) }));
      const m = mediaGeneral(conNotas);
      general.append(
        h('p.small.muted', { text: t('notas.general') }),
        h('p.notas__media', { text: m === null ? t('notas.sinNotas') : formatNumber(Number(m.toFixed(2))) }),
        h('p.small.muted', { text: t('notas.deAsignaturas', { n: lista.filter(a => notasDe(a.id).some(x => Number.isFinite(x.valor))).length }) })
      );
    }

    /* ---------------- pintado general ---------------- */
    function pintar() {
      clear(tarjetas);
      const lista = subjects.all();
      if (!lista.length) {
        tarjetas.appendChild(notice(t('notas.creaAsignaturas'), { kind: 'info' }));
      } else {
        for (const a of lista) tarjetas.appendChild(tarjeta(a));
      }
      pintarGeneral();
    }

    const escala = settingRow({
      label: t('notas.escala.label'),
      control: segmented({
        label: t('notas.escala.label'), value: estado.escala,
        options: [
          { value: 'diez', label: t('notas.escala.diez') },
          { value: 'cien', label: t('notas.escala.cien') }
        ],
        onChange: v => {
          estado.escala = v;
          estado.objetivo = null;
          objetivoCampo.input.value = '';
          guardar();
          pintar();
        }
      })
    });

    const objetivoCampo = field({
      label: t('notas.objetivo.label'),
      type: 'text', inputmode: 'decimal',
      value: estado.objetivo === null ? '' : String(estado.objetivo),
      hint: t('notas.objetivoAyuda'),
      onInput: e => {
        const v = num(e.target.value);
        estado.objetivo = v === null ? null : Math.min(Math.max(v, 0), escalaDe().maximo);
        guardar();
        pintar();
      }
    });
    objetivoCampo.input.classList.add('mono');

    // el gestor no necesita onChange: el evento 'asignaturas:change' ya repinta todo
    const gestorAsignaturas = gestor();
    asignaturasBox.append(h('h2.form__nombre', { text: t('asig.titulo') }), gestorAsignaturas);

    container.appendChild(h('div.page',
      h('header.page__header',
        h('h1.page__title', { text: t('tools.notas.name') }),
        h('p.page__lead', { text: t('tools.notas.desc') })
      ),
      h('div.stack',
        general,
        escala,
        objetivoCampo,
        tarjetas,
        asignaturasBox,
        notice(t('notas.aviso'), { kind: 'info' })
      )
    ));

    pintar();

    const off = on('asignaturas:change', () => { gestorAsignaturas.refresh(); pintar(); });
    this._limpiar = off;
  },

  unmount() {
    this._limpiar?.();
    this._limpiar = null;
  }
};
