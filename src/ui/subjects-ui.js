/**
 * Trozos de interfaz compartidos por las tres herramientas de estudio.
 *
 * Los nombres de las asignaturas los escribe la persona: siempre entran
 * por textContent, nunca por innerHTML.
 */
import { h, clear } from './dom.js';
import { button, iconButton, field, select } from './components.js';
import { t } from '../core/i18n.js';
import * as subjects from '../core/subjects.js';
import { loteDeBorrado, quitarVinculados } from '../core/subject-delete.js';
import { borrarConDeshacer } from './delete.js';

/** Punto de color de una asignatura. */
export function punto(asignatura) {
  const p = h('span.asig__punto', { 'aria-hidden': 'true' });
  if (asignatura) p.classList.add(`asig--${asignatura.color}`);
  return p;
}

/** Aplica la clase de color de la asignatura a un elemento. */
export function conColor(el, asignatura) {
  for (const c of subjects.COLORES) el.classList.remove(`asig--${c}`);
  if (asignatura) el.classList.add(`asig--${asignatura.color}`);
  return el;
}

/** Desplegable de asignaturas, con una opcion vacia opcional. */
export function selector({ label, value, onChange, vacio = null }) {
  const lista = subjects.all();
  return select({
    label,
    value: value || (vacio !== null ? '' : lista[0]?.id || ''),
    options: [
      ...(vacio !== null ? [{ value: '', label: vacio }] : []),
      ...lista.map(a => ({ value: a.id, label: a.nombre }))
    ],
    onChange
  });
}

/**
 * Gestor de asignaturas: anadir, renombrar, recolorear, mover y quitar.
 * `onChange` se llama despues de cada cambio.
 */
export function gestor({ onChange } = {}) {
  const caja = h('div.stack');
  const lista = h('div.stack');
  const aviso = h('p.small.muted', { 'aria-live': 'polite' });

  const avisar = () => { pintar(); onChange?.(); };

  const nueva = field({ label: t('asig.nueva'), hint: t('asig.nuevaAyuda') });
  nueva.input.setAttribute('maxlength', String(subjects.MAX_NOMBRE));
  nueva.input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); crear(); }
  });

  function crear() {
    const nombre = nueva.input.value;
    if (!nombre.trim()) return;
    const creada = subjects.add(nombre, subjects.colorSugerido());
    nueva.input.value = '';
    aviso.textContent = creada ? '' : t('asig.tope', { n: subjects.MAX_ASIGNATURAS });
    if (creada) avisar();
  }

  function pintar() {
    clear(lista);
    const todas = subjects.all();
    if (!todas.length) {
      lista.appendChild(h('p.small.muted', { text: t('asig.ninguna') }));
      return;
    }
    todas.forEach((a, i) => {
      const nombre = field({ label: t('asig.nombreDe'), value: a.nombre });
      nombre.classList.add('grow');
      nombre.querySelector('.field__label')?.classList.add('visually-hidden');
      nombre.input.setAttribute('maxlength', String(subjects.MAX_NOMBRE));
      nombre.input.setAttribute('aria-label', t('asig.nombreDe'));
      nombre.input.addEventListener('change', () => {
        if (!subjects.update(a.id, { nombre: nombre.input.value })) nombre.input.value = a.nombre;
        avisar();
      });

      const color = select({
        label: t('asig.color.label'), value: a.color,
        options: subjects.COLORES.map(c => ({ value: c, label: t(`asig.color.${c}`) })),
        onChange: e => { subjects.update(a.id, { color: e.target.value }); avisar(); }
      });
      color.querySelector('.field__label')?.classList.add('visually-hidden');
      color.select.setAttribute('aria-label', t('asig.colorDe', { nombre: a.nombre }));

      lista.appendChild(h('div.row',
        punto(a),
        nombre,
        color,
        iconButton('chevronUp', t('asig.subir', { nombre: a.nombre }), {
          disabled: i === 0,
          onClick: () => { subjects.move(a.id, -1); avisar(); }
        }),
        iconButton('chevronDown', t('asig.bajar', { nombre: a.nombre }), {
          disabled: i === todas.length - 1,
          onClick: () => { subjects.move(a.id, 1); avisar(); }
        }),
        iconButton('trash', t('asig.quitar', { nombre: a.nombre }), {
          onClick: () => {
            // La asignatura y todo lo que colgaba de ella van juntos:
            // un solo «Deshacer» lo devuelve entero.
            const lote = loteDeBorrado(a.id);
            quitarVinculados(a.id);
            subjects.remove(a.id);
            avisar();
            borrarConDeshacer(lote, { onRestore: () => { subjects.load(); avisar(); } });
          }
        })
      ));
    });
  }

  caja.append(
    lista,
    h('div.row', h('div.grow', nueva), button(t('asig.anadir'), { icon: 'plus', variant: 'primary', onClick: crear })),
    aviso
  );
  pintar();
  caja.refresh = pintar;
  return caja;
}
