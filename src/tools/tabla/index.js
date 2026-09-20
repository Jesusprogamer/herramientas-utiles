/**
 * Tabla periodica interactiva.
 *
 * La rejilla es un CSS grid de 18 columnas con los lantanidos y actinidos
 * en dos filas aparte, como en la tabla estandar. Los datos vienen de
 * src/data/elements.js (origen y comprobaciones en docs/fuentes-datos.md);
 * los nombres, de los archivos de idioma.
 */
import { h, clear } from '../../ui/dom.js';
import { button, iconButton, field, select, notice } from '../../ui/components.js';
import * as storage from '../../core/storage.js';
import { t, formatNumber } from '../../core/i18n.js';
import { ELEMENTS } from '../../data/elements.js';
import { buscar, coincidenciaExacta, escala, rango } from '../../lib/elementos.js';

const KEY = 'tabla';
const MODOS = ['categoria', 'estado', 'electroneg', 'masa'];
const LANTANIDOS = ELEMENTS.filter(e => e.z >= 57 && e.z <= 71);
const ACTINIDOS = ELEMENTS.filter(e => e.z >= 89 && e.z <= 103);

const nombre = e => t(`elementos.nombre.${e.symbol}`);

const RANGOS = {
  electroneg: rango(ELEMENTS, 'electronegativity'),
  masa: rango(ELEMENTS, 'mass')
};

export default {
  id: 'tabla',

  mount(container) {
    const opciones = { modo: 'categoria', ...(storage.get(KEY, null) || {}) };
    if (!MODOS.includes(opciones.modo)) opciones.modo = 'categoria';

    let consulta = '';
    let seleccionado = null;

    const rejilla = h('div.pt');
    const bloques = h('div.pt__bloques');
    const leyenda = h('div.pt__leyenda');
    const ficha = h('div.pt__ficha', { hidden: true });
    const aviso = h('div');
    const celdas = new Map();

    /* ---------------- celdas ---------------- */
    function colorDe(e) {
      if (opciones.modo === 'categoria') return { clase: `pt__celda--${e.category}` };
      if (opciones.modo === 'estado') return { clase: `pt__celda--${e.state}` };
      const valor = opciones.modo === 'electroneg' ? e.electronegativity : e.mass;
      const p = escala(valor, ...RANGOS[opciones.modo]);
      if (p === null) return { clase: 'pt__celda--sindato' };
      return { grad: p };
    }

    function crearCelda(e) {
      const celda = h('button.pt__celda', {
        type: 'button',
        'aria-label': t('tabla.celda', { nombre: nombre(e), simbolo: e.symbol, z: e.z }),
        onClick: () => abrir(e.z)
      });
      celda.append(
        h('span.pt__z', { text: String(e.z) }),
        h('span.pt__simbolo', { text: e.symbol }),
        h('span.pt__nombre', { text: nombre(e) })
      );
      const { clase, grad } = colorDe(e);
      if (clase) celda.classList.add(clase);
      if (grad !== undefined) {
        celda.classList.add('pt__celda--escala');
        celda.style.setProperty('--p', String(grad));
      }
      celdas.set(e.z, celda);
      return celda;
    }

    function pintarRejilla() {
      clear(rejilla); clear(bloques); celdas.clear();
      const visibles = new Set(buscar(ELEMENTS, consulta, nombre).map(e => e.z));

      for (const e of ELEMENTS) {
        if (e.group === null) continue;
        const celda = crearCelda(e);
        celda.style.gridColumn = String(e.group);
        celda.style.gridRow = String(e.period);
        if (!visibles.has(e.z)) celda.classList.add('pt__celda--apagada');
        rejilla.appendChild(celda);
      }

      // los huecos de los lantanidos y actinidos remiten a las filas de abajo
      for (const [fila, periodo, etiqueta] of [[LANTANIDOS, 6, 'tabla.lantanidos'], [ACTINIDOS, 7, 'tabla.actinidos']]) {
        const hueco = h('span.pt__hueco', { text: `${fila[0].z}–${fila.at(-1).z}`, 'aria-hidden': 'true' });
        hueco.style.gridColumn = '3';
        hueco.style.gridRow = String(periodo);
        rejilla.appendChild(hueco);

        const banda = h('div.pt__banda', h('p.pt__banda-titulo', { text: t(etiqueta) }));
        const linea = h('div.pt__linea');
        for (const e of fila) {
          const celda = crearCelda(e);
          if (!visibles.has(e.z)) celda.classList.add('pt__celda--apagada');
          linea.appendChild(celda);
        }
        banda.appendChild(linea);
        bloques.appendChild(banda);
      }

      clear(aviso);
      if (consulta && !visibles.size) {
        aviso.appendChild(notice(t('tabla.sinResultados', { q: consulta }), { kind: 'warning' }));
      }
    }

    /* ---------------- leyenda ---------------- */
    function pintarLeyenda() {
      clear(leyenda);
      leyenda.appendChild(h('p.small.muted', { text: t('tabla.leyenda') }));
      const lista = h('ul.pt__leyenda-lista');
      if (opciones.modo === 'categoria' || opciones.modo === 'estado') {
        const claves = opciones.modo === 'categoria'
          ? [...new Set(ELEMENTS.map(e => e.category))]
          : [...new Set(ELEMENTS.map(e => e.state))];
        const raiz = opciones.modo === 'categoria' ? 'elementos.cat' : 'elementos.estado';
        for (const c of claves) {
          lista.appendChild(h('li.pt__leyenda-item',
            h('span.pt__muestra', { class: `pt__muestra pt__celda--${c}`, 'aria-hidden': 'true' }),
            h('span', { text: t(`${raiz}.${c}`) })));
        }
      } else {
        const [min, max] = RANGOS[opciones.modo];
        const unidad = opciones.modo === 'masa' ? ` ${t('tabla.unidad.u')}` : '';
        lista.appendChild(h('li.pt__leyenda-item',
          h('span.pt__barra', { 'aria-hidden': 'true' }),
          h('span', { text: `${formatNumber(Number(min.toPrecision(4)))}${unidad} → ${formatNumber(Number(max.toPrecision(4)))}${unidad}` })));
        lista.appendChild(h('li.pt__leyenda-item',
          h('span.pt__muestra.pt__celda--sindato', { 'aria-hidden': 'true' }),
          h('span', { text: t('tabla.sinDato') })));
      }
      leyenda.appendChild(lista);
    }

    /* ---------------- ficha ---------------- */
    const kelvinAC = k => (k === null ? null : Math.round((k - 273.15) * 10) / 10);

    function abrir(z) {
      const e = ELEMENTS[z - 1];
      if (!e) return;
      seleccionado = z;
      clear(ficha);
      ficha.hidden = false;

      const dato = (clave, valor) => (valor === null || valor === undefined || valor === ''
        ? null
        : [t(clave), valor]);

      const temperatura = (clave, k) => dato(clave, k === null ? null
        : `${formatNumber(k)} ${t('tabla.unidad.K')} · ${t('tabla.enC', { v: formatNumber(kelvinAC(k)) })}`);

      const filas = [
        dato('tabla.z', String(e.z)),
        dato('tabla.masa', e.mass === null ? null : `${formatNumber(e.mass)} ${t('tabla.unidad.u')}`),
        dato('tabla.familia', t(`elementos.cat.${e.category}`)),
        dato('tabla.grupoPeriodo', `${e.group ? t('tabla.grupo', { g: e.group }) : t('tabla.sinGrupo')} · ${t('tabla.periodo', { p: e.period })}`),
        dato('tabla.config', e.config + (e.predicha ? ` (${t('tabla.configPredicha')})` : '')),
        dato('tabla.electroneg', e.electronegativity === null ? null : formatNumber(e.electronegativity)),
        dato('tabla.ionizacion', e.ionization === null ? null : `${formatNumber(e.ionization)} ${t('tabla.unidad.eV')}`),
        dato('tabla.afinidad', e.affinity === null ? null : `${formatNumber(e.affinity)} ${t('tabla.unidad.eV')}`),
        dato('tabla.radio', e.radius === null ? null : `${formatNumber(e.radius)} ${t('tabla.unidad.pm')}`),
        temperatura('tabla.fusion', e.melting),
        temperatura('tabla.ebullicion', e.boiling),
        dato('tabla.densidad', e.density === null ? null : `${formatNumber(e.density)} ${t('tabla.unidad.gcm3')}`),
        dato('tabla.oxidacion', e.oxidation.length
          ? e.oxidation.map(v => (v > 0 ? `+${v}` : String(v))).join(', ')
          : null),
        dato('tabla.estado', t(`elementos.estado.${e.state}`)),
        dato('tabla.anio', e.year === null ? t('tabla.anioAntiguo') : String(e.year))
      ].filter(Boolean);

      const dl = h('dl.datos');
      for (const [k, v] of filas) dl.append(h('dt', { text: k }), h('dd', { text: v }));

      const anterior = ELEMENTS[z - 2];
      const siguiente = ELEMENTS[z];

      ficha.append(
        h('div.row',
          h('span.pt__ficha-simbolo', { class: `pt__ficha-simbolo pt__celda--${e.category}`, text: e.symbol }),
          h('div.grow',
            h('h2.pt__ficha-nombre', { text: nombre(e) }),
            h('p.small.muted', { text: `${t('tabla.z')} ${e.z} · ${t(`elementos.cat.${e.category}`)}` })),
          iconButton('x', t('tabla.cerrar'), { onClick: cerrar })
        ),
        dl,
        h('div.row',
          anterior ? button(`← ${nombre(anterior)}`, { onClick: () => abrir(z - 1) }) : h('span'),
          siguiente ? button(`${nombre(siguiente)} →`, { onClick: () => abrir(z + 1) }) : h('span')
        )
      );

      celdas.get(z)?.classList.add('pt__celda--activa');
      for (const [otra, celda] of celdas) if (otra !== z) celda.classList.remove('pt__celda--activa');
      ficha.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }

    function cerrar() {
      seleccionado = null;
      ficha.hidden = true;
      clear(ficha);
      for (const celda of celdas.values()) celda.classList.remove('pt__celda--activa');
    }

    /* ---------------- teclado ---------------- */
    rejilla.addEventListener('keydown', e => {
      if (!seleccionado) return;
      if (e.key === 'ArrowRight' && seleccionado < 118) { e.preventDefault(); abrir(seleccionado + 1); celdas.get(seleccionado)?.focus(); }
      if (e.key === 'ArrowLeft' && seleccionado > 1) { e.preventDefault(); abrir(seleccionado - 1); celdas.get(seleccionado)?.focus(); }
      if (e.key === 'Escape') { e.preventDefault(); cerrar(); }
    });

    /* ---------------- montaje ---------------- */
    const busqueda = field({
      label: t('tabla.buscar'), type: 'search', hint: t('tabla.buscarAyuda'),
      onInput: e => {
        consulta = e.target.value;
        pintarRejilla();
        const elegido = coincidenciaExacta(buscar(ELEMENTS, consulta, nombre), consulta, nombre);
        if (elegido) abrir(elegido.z);
      }
    });

    const modo = select({
      label: t('tabla.colorear'), value: opciones.modo,
      options: MODOS.map(m => ({ value: m, label: t(`tabla.color.${m}`) })),
      onChange: e => {
        opciones.modo = e.target.value;
        storage.set(KEY, opciones);
        pintarRejilla(); pintarLeyenda();
        if (seleccionado) celdas.get(seleccionado)?.classList.add('pt__celda--activa');
      }
    });

    container.appendChild(h('div.page.page--ancha',
      h('header.page__header',
        h('h1.page__title', { text: t('tools.tabla.name') }),
        h('p.page__lead', { text: t('tools.tabla.desc') })
      ),
      h('div.stack',
        busqueda,
        modo,
        aviso,
        ficha,
        h('div.pt__scroll', h('div.pt__envoltorio', rejilla, bloques)),
        leyenda,
        notice(t('tabla.fuenteTexto'), { kind: 'info', title: t('tabla.fuente') })
      )
    ));

    pintarRejilla();
    pintarLeyenda();
  },

  unmount() {}
};
