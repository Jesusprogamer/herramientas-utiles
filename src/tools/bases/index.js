/**
 * Conversor de bases numericas.
 *
 * Cuatro casillas encadenadas (binario, octal, decimal, hexadecimal) mas
 * una base libre de 2 a 36. Al escribir en cualquiera se rellenan las
 * demas; la que se esta escribiendo no se toca para no pelear con el
 * cursor. Los calculos viven en src/lib/bases.js.
 */
import { h, clear, copyText } from '../../ui/dom.js';
import { button, iconButton, field, select, toggle, settingRow, notice } from '../../ui/components.js';
import { toastOk, toastError } from '../../ui/toast.js';
import * as storage from '../../core/storage.js';
import { t } from '../../core/i18n.js';
import * as bases from '../../lib/bases.js';

const KEY = 'bases';
const FIJAS = [
  { base: 2, labelKey: 'bases.binario' },
  { base: 8, labelKey: 'bases.octal' },
  { base: 10, labelKey: 'bases.decimal' },
  { base: 16, labelKey: 'bases.hexadecimal' }
];
const BITS = [8, 16, 32, 64];

const prefs = () => ({ libre: 3, explicar: true, bits: 8, agrupar: true, ...(storage.get(KEY, null) || {}) });

export default {
  id: 'bases',

  mount(container) {
    const opciones = prefs();
    const guardar = () => storage.set(KEY, opciones);

    /** Base que se esta editando ahora mismo; null si ninguna. */
    let editando = null;
    let valor = { texto: '1010', base: 2 };

    const casillas = new Map();
    const aviso = h('div.stack');
    const extras = h('div.stack');
    const pasosBox = h('div.steps');

    function crearCasilla(base, etiqueta) {
      const f = field({
        label: etiqueta,
        value: '',
        onInput: e => {
          editando = base;
          valor = { texto: e.target.value, base };
          refrescar();
          editando = null;
        }
      });
      f.input.classList.add('mono');
      f.input.setAttribute('spellcheck', 'false');
      f.input.setAttribute('autocapitalize', 'off');
      f.input.setAttribute('autocomplete', 'off');
      const copiar = iconButton('download', t('bases.copiar', { base }), {
        onClick: async () => {
          if (!f.input.value) return;
          (await copyText(f.input.value)) ? toastOk(t('common.copied')) : toastError(t('common.copyFailed'));
        }
      });
      casillas.set(base, f);
      return h('div.row.bases__fila', h('div.grow', f), copiar);
    }

    const fijasBox = h('div.stack');
    for (const { base, labelKey } of FIJAS) fijasBox.appendChild(crearCasilla(base, t(labelKey)));

    /* --------- base libre --------- */
    const libreBox = h('div.stack');

    function pintarLibre() {
      clear(libreBox);
      const selBase = select({
        label: t('bases.baseLibre'),
        value: String(opciones.libre),
        // las cuatro fijas ya tienen su casilla: aqui solo van las demas
        options: Array.from({ length: bases.BASE_MAX - bases.BASE_MIN + 1 }, (_, i) => bases.BASE_MIN + i)
          .filter(b => !FIJAS.some(f => f.base === b))
          .map(b => ({ value: String(b), label: t('bases.baseN', { n: b }) })),
        onChange: e => {
          const anterior = opciones.libre;
          opciones.libre = Number(e.target.value);
          casillas.delete(anterior);
          guardar();
          pintarLibre();
          refrescar();
        }
      });
      libreBox.append(selBase, crearCasilla(opciones.libre, t('bases.enBase', { n: opciones.libre })));
    }

    /* --------- pasos --------- */
    function pintarPasos(lista) {
      clear(pasosBox);
      if (!opciones.explicar || !lista?.length) { pasosBox.hidden = true; return; }
      pasosBox.hidden = false;
      const ol = h('ol.steps__list');
      for (const p of lista) ol.appendChild(h('li.steps__item', { text: t(`calc.paso.${p.clave}`, p.params) }));
      pasosBox.append(h('p.steps__title', { text: t('calc.pasos') }), ol);
    }

    /* --------- extras: bits, complemento a dos, tamaño --------- */
    function pintarExtras(entero, hayFraccion) {
      clear(extras);
      if (hayFraccion) {
        extras.appendChild(h('p.small.muted', { text: t('bases.sinBitsConDecimales') }));
        return;
      }
      const binario = bases.bigIntATexto(entero < 0n ? -entero : entero, 2);
      const filas = [
        [t('bases.bits'), String(binario.length)],
        [t('bases.digitosHex'), String(bases.bigIntATexto(entero < 0n ? -entero : entero, 16).length)]
      ];
      const c2 = bases.complementoDos(entero, opciones.bits);
      filas.push([
        t('bases.complemento', { bits: opciones.bits }),
        c2 ? (opciones.agrupar ? bases.agrupar(c2) : c2) : t('bases.noCabe', { bits: opciones.bits })
      ]);

      const dl = h('dl.datos');
      for (const [k, v] of filas) {
        dl.append(h('dt', { text: k }), h('dd.mono', { text: v }));
      }
      extras.appendChild(dl);
    }

    /* --------- refresco --------- */
    function refrescar() {
      clear(aviso);
      let resultado;
      try {
        resultado = bases.analizar(valor.texto, valor.base);
      } catch (err) {
        for (const [base, f] of casillas) if (base !== editando) f.input.value = '';
        pintarPasos(null);
        clear(extras);
        const motivo = String(err.message);
        if (motivo !== 'vacio') {
          aviso.appendChild(notice(
            motivo.startsWith('digito:')
              ? t('bases.error.digito', { c: motivo.slice(7), base: valor.base })
              : t(`bases.error.${motivo}`) || t('common.error'),
            { kind: 'warning' }
          ));
        }
        return;
      }

      const entero = resultado.signo * bases.enteraABigInt(resultado.entera, valor.base);
      const fraccion = bases.fraccionExacta(resultado.fraccion, valor.base);
      let cortado = false;

      for (const [base, f] of casillas) {
        if (base === editando) continue;
        const conv = bases.convertir(valor.texto, valor.base, base);
        cortado = cortado || conv.cortado;
        if (opciones.agrupar && base === 2 && !conv.texto.includes('.')) {
          const negativo = conv.texto.startsWith('-');
          f.input.value = (negativo ? '-' : '') + bases.agrupar(negativo ? conv.texto.slice(1) : conv.texto);
        } else {
          f.input.value = conv.texto;
        }
      }

      if (cortado) aviso.appendChild(notice(t('bases.cortado', { n: bases.MAX_DECIMALES }), { kind: 'info' }));

      // los pasos explican la conversion a la base que NO se esta editando
      const destino = valor.base === 10 ? 2 : 10;
      pintarPasos([
        ...bases.pasosEntera(entero, destino),
        ...bases.pasosFraccion(fraccion, destino)
      ]);
      pintarExtras(entero, fraccion.numerador !== 0n);
    }

    /* --------- montaje --------- */
    const ejemplos = h('div.row',
      ...[['255', 10], ['ff', 16], ['1010.101', 2], ['0.1', 10]].map(([texto, base]) =>
        button(t('bases.ejemplo', { v: texto, b: base }), {
          onClick: () => { valor = { texto, base }; editando = null; refrescar(); }
        }))
    );

    container.appendChild(h('div.page',
      h('header.page__header',
        h('h1.page__title', { text: t('tools.bases.name') }),
        h('p.page__lead', { text: t('tools.bases.desc') })
      ),
      h('div.stack',
        fijasBox,
        libreBox,
        aviso,
        ejemplos,
        settingRow({
          label: t('bases.agrupar'), desc: t('bases.agruparDesc'),
          control: toggle({
            label: t('bases.agrupar'), checked: opciones.agrupar,
            onChange: v => { opciones.agrupar = v; guardar(); refrescar(); }
          })
        }),
        settingRow({
          label: t('bases.tamano'),
          control: select({
            label: t('bases.tamano'), value: String(opciones.bits),
            options: BITS.map(b => ({ value: String(b), label: t('bases.nBits', { n: b }) })),
            onChange: e => { opciones.bits = Number(e.target.value); guardar(); refrescar(); }
          })
        }),
        extras,
        settingRow({
          label: t('calc.explicar'), desc: t('bases.explicarDesc'),
          control: toggle({
            label: t('calc.explicar'), checked: opciones.explicar,
            onChange: v => { opciones.explicar = v; guardar(); refrescar(); }
          })
        }),
        pasosBox,
        notice(t('bases.nota'), { kind: 'info' })
      )
    ));

    pintarLibre();
    refrescar();
  },

  unmount() {}
};
