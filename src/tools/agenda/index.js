/**
 * Agenda de examenes.
 *
 * Usa las asignaturas compartidas y exporta a .ics para que los examenes
 * entren en el calendario del telefono. La generacion del archivo esta en
 * src/lib/ics.js y se prueba aparte.
 */
import { h, clear, downloadFile } from '../../ui/dom.js';
import { button, iconButton, field, select, notice, settingRow, toggle } from '../../ui/components.js';
import { selector, gestor, punto, conColor } from '../../ui/subjects-ui.js';
import { toastOk, toastError } from '../../ui/toast.js';
import { borrarConDeshacer } from '../../ui/delete.js';
import * as subjects from '../../core/subjects.js';
import { on } from '../../core/events.js';
import { t, formatDate } from '../../core/i18n.js';
import { aFecha, aDia, diasHasta, proximos, pasados, porDia, urgencia } from '../../lib/agenda.js';
import { calendario } from '../../lib/ics.js';
import { leer, escribir, nuevoId, KEY, AVISOS, MAX_TITULO, MAX_NOTAS, MAX_EXAMENES } from './store.js';
import { cuando } from './widget.js';

export default {
  id: 'agenda',

  mount(container) {
    const estado = leer();
    const guardar = () => escribir(estado);

    const lista = h('div.stack');
    const formulario = h('div.asig__tarjeta');
    const asignaturasBox = h('div.stack');
    let editando = null;   // id del examen que se esta editando, o null

    /* ---------------- formulario ---------------- */
    let campos = null;

    function pintarFormulario() {
      clear(formulario);
      const examen = editando ? estado.examenes.find(e => e.id === editando) : null;
      const hoyDia = aDia(new Date());

      const dia = field({
        label: t('agenda.dia'), type: 'date',
        value: examen?.dia || hoyDia
      });
      const hora = field({
        label: t('agenda.hora'), type: 'time',
        value: examen?.hora || '',
        hint: t('agenda.horaAyuda')
      });
      const titulo = field({
        label: t('agenda.titulo'),
        value: examen?.titulo || '',
        hint: t('agenda.tituloAyuda')
      });
      titulo.input.setAttribute('maxlength', String(MAX_TITULO));

      const asignatura = selector({
        label: t('agenda.asignatura'),
        value: examen?.asignaturaId || '',
        vacio: t('agenda.sinAsignatura')
      });

      const lugar = field({ label: t('agenda.lugar'), value: examen?.lugar || '' });
      lugar.input.setAttribute('maxlength', String(MAX_TITULO));

      const notas = h('textarea.textarea', {
        rows: '3', 'aria-label': t('agenda.notas'),
        maxlength: String(MAX_NOTAS),
        placeholder: t('agenda.notasPlaceholder')
      });
      notas.value = examen?.notas || '';

      campos = { dia, hora, titulo, asignatura, lugar, notas };

      const guardarBtn = button(examen ? t('agenda.guardarCambios') : t('agenda.anadir'), {
        variant: 'primary', icon: examen ? 'check' : 'plus',
        onClick: () => enviar()
      });

      formulario.append(
        h('h2.asig__nombre', { text: examen ? t('agenda.editando') : t('agenda.nuevo') }),
        h('div.row', h('div.grow', dia), h('div.grow', hora)),
        titulo,
        asignatura,
        lugar,
        h('div.field', h('label.field__label', { text: t('agenda.notas') }), notas),
        h('div.row',
          guardarBtn,
          examen ? button(t('common.cancel'), { onClick: () => { editando = null; pintarFormulario(); } }) : null
        )
      );
    }

    function enviar() {
      const dia = campos.dia.input.value;
      if (!dia) { toastError(t('agenda.faltaFecha')); return; }
      const titulo = campos.titulo.input.value.trim();
      const asignaturaId = campos.asignatura.select.value;
      if (!titulo && !asignaturaId) { toastError(t('agenda.faltaTitulo')); return; }

      const datos = {
        dia,
        hora: campos.hora.input.value || null,
        titulo,
        asignaturaId,
        lugar: campos.lugar.input.value.trim(),
        notas: campos.notas.value,
        hecho: false
      };

      if (editando) {
        const i = estado.examenes.findIndex(e => e.id === editando);
        estado.examenes[i] = { ...estado.examenes[i], ...datos };
        editando = null;
        toastOk(t('agenda.guardado'));
      } else {
        if (estado.examenes.length >= MAX_EXAMENES) { toastError(t('agenda.tope', { n: MAX_EXAMENES })); return; }
        estado.examenes.push({ id: nuevoId(), ...datos });
        toastOk(t('agenda.anadido'));
      }
      guardar();
      pintarFormulario();
      pintar();
    }

    /* ---------------- lista ---------------- */
    function tarjetaExamen(examen, { pasado = false } = {}) {
      const dias = diasHasta(examen.dia);
      const asignatura = examen.asignaturaId ? subjects.byId(examen.asignaturaId) : null;
      const fecha = aFecha(examen.dia, examen.hora);
      const caja = conColor(h('article.asig__tarjeta.agenda__examen'), asignatura);
      if (examen.hecho || pasado) caja.classList.add('agenda__examen--hecho');

      const cabecera = h('div.row',
        punto(asignatura),
        h('div.grow',
          h('h3.asig__nombre', { text: examen.titulo || asignatura?.nombre || t('agenda.sinTitulo') }),
          h('p.small.muted', {
            text: [
              asignatura && examen.titulo ? asignatura.nombre : null,
              formatDate(fecha, examen.hora ? { dateStyle: 'full', timeStyle: 'short' } : { dateStyle: 'full' }),
              examen.lugar || null
            ].filter(Boolean).join(' · ')
          })),
        h('span.widget__cuenta', {
          class: `widget__cuenta widget__cuenta--${examen.hecho ? 'lejos' : urgencia(dias)}`,
          text: cuando(dias)
        })
      );

      const acciones = h('div.row',
        iconButton(examen.hecho ? 'check' : 'checklist',
          examen.hecho ? t('agenda.desmarcar') : t('agenda.marcar'), {
            pressed: examen.hecho,
            onClick: () => { examen.hecho = !examen.hecho; guardar(); pintar(); }
          }),
        iconButton('type', t('agenda.editar'), {
          onClick: () => { editando = examen.id; pintarFormulario(); formulario.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
        }),
        iconButton('download', t('agenda.exportarUno'), {
          onClick: () => exportar([examen], `${(examen.titulo || 'examen').slice(0, 30)}.ics`)
        }),
        iconButton('trash', t('agenda.quitar'), {
          onClick: () => {
            const pos = estado.examenes.indexOf(examen);
            estado.examenes = estado.examenes.filter(e => e.id !== examen.id);
            if (editando === examen.id) { editando = null; pintarFormulario(); }
            guardar(); pintar();
            borrarConDeshacer({
              clave: KEY, ruta: ['examenes'], pos, tool: 'agenda', tipo: 'examen',
              etiqueta: examen.titulo || t('agenda.sinTitulo'), datos: examen
            }, {
              onRestore: () => {
                estado.examenes = leer().examenes;
                pintar();
              }
            });
          }
        })
      );

      caja.append(cabecera);
      if (examen.notas) caja.appendChild(h('p.small', { text: examen.notas }));
      caja.appendChild(acciones);
      return caja;
    }

    function pintar() {
      clear(lista);
      const proximosEx = proximos(estado.examenes, new Date());
      const pasadosEx = pasados(estado.examenes, new Date());

      if (!proximosEx.length && !pasadosEx.length) {
        lista.appendChild(notice(t('agenda.vacia'), { kind: 'info' }));
        return;
      }

      if (proximosEx.length) {
        for (const grupo of porDia(proximosEx)) {
          lista.appendChild(h('p.small.muted.agenda__dia', {
            text: `${formatDate(aFecha(grupo.dia), { dateStyle: 'full' })} · ${cuando(diasHasta(grupo.dia))}`
          }));
          for (const examen of grupo.examenes) lista.appendChild(tarjetaExamen(examen));
        }
      } else {
        lista.appendChild(notice(t('agenda.sinProximos'), { kind: 'info' }));
      }

      if (pasadosEx.length) {
        lista.appendChild(settingRow({
          label: t('agenda.verPasados', { n: pasadosEx.length }),
          control: toggle({
            label: t('agenda.verPasados', { n: pasadosEx.length }),
            checked: estado.verPasados,
            onChange: v => { estado.verPasados = v; guardar(); pintar(); }
          })
        }));
        if (estado.verPasados) {
          for (const examen of pasadosEx) lista.appendChild(tarjetaExamen(examen, { pasado: true }));
        }
      }
    }

    /* ---------------- exportar ---------------- */
    function exportar(examenes, nombreArchivo = 'examenes.ics') {
      const utiles = examenes.filter(e => aFecha(e.dia));
      if (!utiles.length) { toastError(t('agenda.nadaQueExportar')); return; }

      const eventos = utiles.map(examen => {
        const asignatura = examen.asignaturaId ? subjects.byId(examen.asignaturaId) : null;
        const nombre = examen.titulo || asignatura?.nombre || t('agenda.sinTitulo');
        const resumen = asignatura && examen.titulo ? `${asignatura.nombre}: ${nombre}` : nombre;
        return {
          uid: `${examen.id}@amano`,
          inicio: aFecha(examen.dia, examen.hora),
          todoElDia: !examen.hora,
          resumen,
          descripcion: examen.notas || '',
          lugar: examen.lugar || '',
          avisoMinutos: estado.aviso
        };
      });

      downloadFile(nombreArchivo, calendario(eventos, { nombre: t('tools.agenda.name') }), 'text/calendar');
      toastOk(t('agenda.exportado', { n: utiles.length }));
    }

    const avisoSelect = select({
      label: t('agenda.aviso.label'),
      value: String(estado.aviso),
      options: AVISOS.map(m => ({ value: String(m), label: t(`agenda.aviso.${m}`) })),
      hint: t('agenda.avisoAyuda'),
      onChange: e => { estado.aviso = Number(e.target.value); guardar(); }
    });

    const exportarBtn = button(t('agenda.exportarTodo'), {
      icon: 'calendar',
      onClick: () => exportar(proximos(estado.examenes, new Date()))
    });

    const gestorAsignaturas = gestor();
    asignaturasBox.append(h('h2.form__nombre', { text: t('asig.titulo') }), gestorAsignaturas);

    container.appendChild(h('div.page',
      h('header.page__header',
        h('h1.page__title', { text: t('tools.agenda.name') }),
        h('p.page__lead', { text: t('tools.agenda.desc') })
      ),
      h('div.stack',
        formulario,
        lista,
        avisoSelect,
        h('div.row', exportarBtn),
        asignaturasBox,
        notice(t('agenda.notaIcs'), { kind: 'info' })
      )
    ));

    pintarFormulario();
    pintar();

    const off = on('asignaturas:change', () => { gestorAsignaturas.refresh(); pintarFormulario(); pintar(); });
    this._limpiar = off;
  },

  unmount() {
    this._limpiar?.();
    this._limpiar = null;
  }
};
