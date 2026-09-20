/**
 * Horario de clase.
 *
 * Una rejilla de dias por franjas. En pantalla estrecha se ve un dia
 * cada vez; en ancha, la semana entera. Usa las asignaturas compartidas
 * y los calculos de src/lib/schedule.js.
 */
import { h, clear, downloadFile } from '../../ui/dom.js';
import { button, iconButton, field, select, notice, segmented, settingRow } from '../../ui/components.js';
import { gestor, punto, conColor } from '../../ui/subjects-ui.js';
import { toastOk, toastError } from '../../ui/toast.js';
import * as storage from '../../core/storage.js';
import * as subjects from '../../core/subjects.js';
import { on } from '../../core/events.js';
import { t, formatNumber } from '../../core/i18n.js';
import {
  DIAS_SEMANA, MAX_FRANJAS, ordenarFranjas, franjaValida, solapes,
  generarFranjas, celda, clasesDelDia, minutosPorAsignatura, queToca, duracion
} from '../../lib/schedule.js';

const KEY = 'horario';
const HOY = new Date().getDay();

const porDefecto = () => ({
  franjas: generarFranjas({ desde: '08:00', minutos: 55, cuantas: 6, descanso: 20, descansoTras: 3 }),
  clases: {},
  dias: 5,               // 5 = de lunes a viernes, 6 = con sabado, 7 = semana entera
  vista: 'dia'
});

function leer() {
  const guardado = storage.get(KEY, null) || {};
  const base = porDefecto();
  const franjas = Array.isArray(guardado.franjas)
    ? guardado.franjas.filter(franjaValida).slice(0, MAX_FRANJAS)
    : base.franjas;
  return {
    franjas: franjas.length ? ordenarFranjas(franjas) : base.franjas,
    clases: guardado.clases && typeof guardado.clases === 'object' ? guardado.clases : {},
    dias: [5, 6, 7].includes(guardado.dias) ? guardado.dias : 5,
    vista: guardado.vista === 'semana' ? 'semana' : 'dia'
  };
}

export default {
  id: 'horario',

  mount(container) {
    const estado = leer();
    const guardar = () => storage.set(KEY, estado);
    let diaElegido = DIAS_SEMANA.slice(0, estado.dias).includes(HOY) ? HOY : 1;

    const rejilla = h('div');
    const ahoraBox = h('div.stack');
    const franjasBox = h('div.stack');
    const resumenBox = h('div.stack');
    const avisos = h('div.stack');
    const asignaturasBox = h('div.stack');

    const diasVisibles = () => DIAS_SEMANA.slice(0, estado.dias);
    const nombreDia = dia => t(`horario.dia.${dia}`);

    /* ---------------- una celda ---------------- */
    function celdaClase(dia, indice) {
      const clave = celda(dia, indice);
      const clase = estado.clases[clave] || { asignaturaId: '', aula: '' };
      const asignatura = clase.asignaturaId ? subjects.byId(clase.asignaturaId) : null;

      const caja = conColor(h('div.horario__celda'), asignatura);
      if (!asignatura) caja.classList.add('horario__celda--libre');

      const sel = select({
        label: t('horario.claseEn', { dia: nombreDia(dia), franja: indice + 1 }),
        value: clase.asignaturaId,
        options: [
          { value: '', label: t('horario.libre') },
          ...subjects.all().map(a => ({ value: a.id, label: a.nombre }))
        ],
        onChange: e => {
          const id = e.target.value;
          if (id) estado.clases[clave] = { ...clase, asignaturaId: id };
          else delete estado.clases[clave];
          guardar();
          pintar();
        }
      });
      sel.querySelector('.field__label')?.classList.add('visually-hidden');

      caja.appendChild(sel);

      if (asignatura) {
        const aula = field({ label: t('horario.aula'), value: clase.aula || '' });
        aula.querySelector('.field__label')?.classList.add('visually-hidden');
        aula.input.setAttribute('aria-label', t('horario.aulaEn', { dia: nombreDia(dia), franja: indice + 1 }));
        aula.input.setAttribute('maxlength', '20');
        aula.input.placeholder = t('horario.aula');
        aula.input.addEventListener('input', () => {
          estado.clases[clave] = { ...estado.clases[clave], aula: aula.input.value };
          guardar();
        });
        caja.appendChild(aula);
      }
      return caja;
    }

    /* ---------------- rejilla ---------------- */
    function pintarRejilla() {
      clear(rejilla);
      const franjas = ordenarFranjas(estado.franjas);
      if (!franjas.length) {
        rejilla.appendChild(notice(t('horario.sinFranjas'), { kind: 'warning' }));
        return;
      }
      if (!subjects.all().length) {
        rejilla.appendChild(notice(t('horario.creaAsignaturas'), { kind: 'info' }));
        return;
      }

      const dias = estado.vista === 'semana' ? diasVisibles() : [diaElegido];
      const tabla = h('div.horario');
      tabla.style.setProperty('--dias', String(dias.length));

      tabla.appendChild(h('div.horario__esquina', { text: t('horario.hora') }));
      for (const dia of dias) {
        const cabecera = h('div.horario__cabecera', { text: nombreDia(dia) });
        if (dia === HOY) cabecera.classList.add('horario__cabecera--hoy');
        tabla.appendChild(cabecera);
      }

      franjas.forEach((franja, i) => {
        tabla.appendChild(h('div.horario__franja',
          h('span.mono', { text: franja.inicio }),
          h('span.small.muted.mono', { text: franja.fin })));
        for (const dia of dias) tabla.appendChild(celdaClase(dia, i));
      });

      rejilla.appendChild(h('div.horario__scroll', tabla));
    }

    /* ---------------- que toca ahora ---------------- */
    function pintarAhora() {
      clear(ahoraBox);
      const { ahora, siguiente } = queToca(estado.clases, estado.franjas, new Date());
      if (!ahora && !siguiente) return;

      const linea = (clave, x) => {
        const asignatura = subjects.byId(x.clase.asignaturaId);
        if (!asignatura) return null;
        return h('p.horario__ahora-linea',
          punto(asignatura),
          h('span', {
            text: t(clave, {
              asignatura: asignatura.nombre,
              desde: x.franja.inicio,
              hasta: x.franja.fin,
              aula: x.clase.aula || ''
            })
          })
        );
      };

      const caja = h('div.widget',
        h('h2.widget__titulo', { text: t('horario.ahoraTitulo') }),
        ahora ? linea('horario.ahora', ahora) : h('p.small.muted', { text: t('horario.nadaAhora') }),
        siguiente ? linea('horario.luego', siguiente) : null
      );
      ahoraBox.appendChild(caja);
    }

    /* ---------------- franjas ---------------- */
    function pintarFranjas() {
      clear(franjasBox);
      franjasBox.appendChild(h('h2.form__nombre', { text: t('horario.franjas') }));

      estado.franjas.forEach((franja, i) => {
        const inicio = field({ label: t('horario.desde'), type: 'time', value: franja.inicio });
        inicio.querySelector('.field__label')?.classList.add('visually-hidden');
        inicio.input.setAttribute('aria-label', t('horario.desdeN', { n: i + 1 }));
        const fin = field({ label: t('horario.hasta'), type: 'time', value: franja.fin });
        fin.querySelector('.field__label')?.classList.add('visually-hidden');
        fin.input.setAttribute('aria-label', t('horario.hastaN', { n: i + 1 }));

        const cambiar = () => {
          estado.franjas[i] = { inicio: inicio.input.value, fin: fin.input.value };
          guardar();
          pintar();
        };
        inicio.input.addEventListener('change', cambiar);
        fin.input.addEventListener('change', cambiar);

        franjasBox.appendChild(h('div.row',
          h('span.small.muted', { text: String(i + 1) }),
          h('div.grow', inicio),
          h('span.small.muted', { text: '→' }),
          h('div.grow', fin),
          iconButton('trash', t('horario.quitarFranja', { n: i + 1 }), {
            onClick: () => {
              estado.franjas.splice(i, 1);
              // las clases se recolocan: se van las de la franja borrada
              const nuevas = {};
              for (const [clave, clase] of Object.entries(estado.clases)) {
                const [dia, indice] = clave.split(':').map(Number);
                if (indice === i) continue;
                nuevas[celda(dia, indice > i ? indice - 1 : indice)] = clase;
              }
              estado.clases = nuevas;
              guardar();
              pintar();
            }
          })
        ));
      });

      franjasBox.appendChild(h('div.row',
        button(t('horario.anadirFranja'), {
          icon: 'plus',
          onClick: () => {
            if (estado.franjas.length >= MAX_FRANJAS) { toastError(t('horario.topeFranjas', { n: MAX_FRANJAS })); return; }
            const ultima = ordenarFranjas(estado.franjas).at(-1);
            const siguiente = ultima
              ? generarFranjas({ desde: ultima.fin, minutos: duracion(ultima) || 55, cuantas: 1 })[0]
              : { inicio: '08:00', fin: '08:55' };
            estado.franjas.push(siguiente);
            guardar();
            pintar();
          }
        }),
        button(t('horario.rehacerFranjas'), {
          icon: 'refresh',
          onClick: () => {
            estado.franjas = porDefecto().franjas;
            guardar();
            pintar();
            toastOk(t('horario.franjasRehechas'));
          }
        })
      ));
    }

    /* ---------------- resumen y avisos ---------------- */
    function pintarResumen() {
      clear(resumenBox);
      const porAsig = minutosPorAsignatura(estado.clases, estado.franjas);
      if (!porAsig.size) return;

      resumenBox.appendChild(h('h2.form__nombre', { text: t('horario.resumen') }));
      const dl = h('dl.datos');
      for (const asignatura of subjects.all()) {
        const minutos = porAsig.get(asignatura.id);
        if (!minutos) continue;
        dl.append(
          h('dt', h('span.row', punto(asignatura), h('span', { text: asignatura.nombre }))),
          h('dd', { text: t('horario.horasSemana', { h: formatNumber(Math.round((minutos / 60) * 10) / 10) }) })
        );
      }
      resumenBox.appendChild(dl);
    }

    function pintarAvisos() {
      clear(avisos);
      for (const [a, b] of solapes(estado.franjas)) {
        avisos.appendChild(notice(
          t('horario.solape', { a: `${a.inicio}–${a.fin}`, b: `${b.inicio}–${b.fin}` }),
          { kind: 'warning' }
        ));
      }
    }

    /* ---------------- exportar ---------------- */
    function exportarCSV() {
      const franjas = ordenarFranjas(estado.franjas);
      if (!franjas.length) { toastError(t('horario.sinFranjas')); return; }
      const dias = diasVisibles();
      const lineas = [[t('horario.hora'), ...dias.map(nombreDia)].join(';')];
      franjas.forEach((franja, i) => {
        const celdas = dias.map(dia => {
          const clase = estado.clases[celda(dia, i)];
          const asignatura = clase?.asignaturaId ? subjects.byId(clase.asignaturaId) : null;
          if (!asignatura) return '';
          return clase.aula ? `${asignatura.nombre} (${clase.aula})` : asignatura.nombre;
        });
        lineas.push([`${franja.inicio}-${franja.fin}`, ...celdas].join(';'));
      });
      downloadFile('horario.csv', lineas.join('\n'), 'text/csv');
      toastOk(t('horario.exportado'));
    }

    /* ---------------- controles ---------------- */
    const vista = settingRow({
      label: t('horario.vista.label'),
      control: segmented({
        label: t('horario.vista.label'), value: estado.vista,
        options: [
          { value: 'dia', label: t('horario.vista.dia') },
          { value: 'semana', label: t('horario.vista.semana') }
        ],
        onChange: v => { estado.vista = v; guardar(); pintar(); }
      })
    });

    const diasControl = settingRow({
      label: t('horario.dias.label'),
      control: segmented({
        label: t('horario.dias.label'), value: String(estado.dias),
        options: [
          { value: '5', label: t('horario.dias.cinco') },
          { value: '6', label: t('horario.dias.seis') },
          { value: '7', label: t('horario.dias.siete') }
        ],
        onChange: v => {
          estado.dias = Number(v);
          if (!diasVisibles().includes(diaElegido)) diaElegido = 1;
          guardar();
          pintar();
        }
      })
    });

    const selectorDia = h('div');
    function pintarSelectorDia() {
      clear(selectorDia);
      if (estado.vista !== 'dia') return;
      const chips = segmented({
        label: t('horario.queDia'),
        value: String(diaElegido),
        options: diasVisibles().map(dia => ({ value: String(dia), label: nombreDia(dia) })),
        onChange: v => { diaElegido = Number(v); pintar(); }
      });
      chips.classList.add('segmented--chips');
      selectorDia.appendChild(chips);
    }

    function pintar() {
      pintarSelectorDia();
      pintarRejilla();
      pintarAhora();
      pintarFranjas();
      pintarResumen();
      pintarAvisos();
    }

    const gestorAsignaturas = gestor();
    asignaturasBox.append(h('h2.form__nombre', { text: t('asig.titulo') }), gestorAsignaturas);

    container.appendChild(h('div.page.page--ancha',
      h('header.page__header',
        h('h1.page__title', { text: t('tools.horario.name') }),
        h('p.page__lead', { text: t('tools.horario.desc') })
      ),
      h('div.stack',
        ahoraBox,
        vista,
        diasControl,
        selectorDia,
        avisos,
        rejilla,
        h('div.row', button(t('horario.exportar'), { icon: 'download', onClick: exportarCSV })),
        resumenBox,
        franjasBox,
        asignaturasBox,
        notice(t('horario.nota'), { kind: 'info' })
      )
    ));

    pintar();

    /* «Qué toca ahora» se refresca cada minuto, no en cada segundo. */
    const reloj = setInterval(pintarAhora, 60 * 1000);
    /** Si se borra una asignatura, sus celdas quedan libres de verdad. */
    function limpiarHuerfanas() {
      const vivas = new Set(subjects.all().map(a => a.id));
      let cambiado = false;
      for (const [clave, clase] of Object.entries(estado.clases)) {
        if (clase?.asignaturaId && !vivas.has(clase.asignaturaId)) {
          delete estado.clases[clave];
          cambiado = true;
        }
      }
      if (cambiado) guardar();
    }

    const off = on('asignaturas:change', () => {
      limpiarHuerfanas();
      gestorAsignaturas.refresh();
      pintar();
    });

    this._limpiar = () => { clearInterval(reloj); off(); };
  },

  unmount() {
    this._limpiar?.();
    this._limpiar = null;
  }
};
