/**
 * Representación de funciones.
 *
 * Las expresiones pasan por el analizador propio de src/lib/expr.js:
 * aquí no hay eval ni new Function. El lienzo se repinta al cambiar de
 * tema o de idioma, y siempre hay una tabla de valores como alternativa
 * textual a la gráfica.
 */
import { h, clear, downloadFile } from '../../ui/dom.js';
import { button, iconButton, field, notice } from '../../ui/components.js';
import { toastError, toastOk } from '../../ui/toast.js';
import * as storage from '../../core/storage.js';
import { t, formatNumber } from '../../core/i18n.js';
import { on } from '../../core/events.js';
import { parse, evaluate } from '../../lib/expr.js';
import { pasoRejilla, muestrear, rangoVisible } from '../../lib/plot.js';

const KEY = 'graficas';

/** Tres trazos como máximo: más de eso ya no se lee. */
const COLORES = ['--gr-1', '--gr-2', '--gr-3'];
const MAX = 3;

const VISTA_INICIAL = Object.freeze({ x0: -10, x1: 10, y0: -6, y1: 6 });

const estadoPorDefecto = () => ({
  funciones: [{ texto: 'x^2 - 2', visible: true }],
  vista: { ...VISTA_INICIAL }
});

export default {
  id: 'graficas',

  mount(container) {
    const guardado = storage.get(KEY, null);
    const estado = {
      ...estadoPorDefecto(),
      ...(guardado && Array.isArray(guardado.funciones) ? guardado : {})
    };
    if (!estado.funciones.length) estado.funciones = estadoPorDefecto().funciones;
    estado.vista = { ...VISTA_INICIAL, ...(estado.vista || {}) };

    const guardar = () => storage.set(KEY, estado);

    const lienzo = h('canvas.grafica__canvas', {
      role: 'img', tabindex: '0', 'aria-label': t('graf.lienzo')
    });
    const ctx = lienzo.getContext('2d');
    const lectura = h('p.grafica__lectura.mono', { 'aria-live': 'polite', text: '' });
    const listaErrores = h('div.stack');
    const tablaBox = h('div.grafica__tabla');

    /* ------------- compilación ------------- */
    /** Devuelve [{ texto, nodo, error, visible, color }] */
    function compiladas() {
      return estado.funciones.map((f, i) => {
        let nodo = null; let error = '';
        const texto = String(f.texto || '').trim();
        if (texto) {
          try { nodo = parse(texto); } catch (err) { error = err.message; }
        }
        return { ...f, texto, nodo, error, color: COLORES[i % COLORES.length] };
      });
    }

    const color = nombre => getComputedStyle(document.documentElement).getPropertyValue(nombre).trim() || '#888';

    /* ------------- pintado ------------- */
    let dibujadas = [];

    function pintar() {
      const ancho = lienzo.clientWidth || 320;
      const alto = lienzo.clientHeight || 240;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      lienzo.width = Math.round(ancho * dpr);
      lienzo.height = Math.round(alto * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, ancho, alto);

      const { x0, x1, y0, y1 } = estado.vista;
      const px = x => ((x - x0) / (x1 - x0)) * ancho;
      const py = y => alto - ((y - y0) / (y1 - y0)) * alto;

      const cSup = color('--c-surface');
      ctx.fillStyle = cSup; ctx.fillRect(0, 0, ancho, alto);

      // rejilla
      const pasoX = pasoRejilla(x1 - x0, Math.max(4, Math.round(ancho / 70)));
      const pasoY = pasoRejilla(y1 - y0, Math.max(4, Math.round(alto / 55)));
      ctx.strokeStyle = color('--c-border-soft');
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = Math.ceil(x0 / pasoX) * pasoX; x <= x1; x += pasoX) {
        const cx = Math.round(px(x)) + 0.5;
        ctx.moveTo(cx, 0); ctx.lineTo(cx, alto);
      }
      for (let y = Math.ceil(y0 / pasoY) * pasoY; y <= y1; y += pasoY) {
        const cy = Math.round(py(y)) + 0.5;
        ctx.moveTo(0, cy); ctx.lineTo(ancho, cy);
      }
      ctx.stroke();

      // ejes
      ctx.strokeStyle = color('--c-text-faint');
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      if (y0 <= 0 && y1 >= 0) { const cy = Math.round(py(0)) + 0.5; ctx.moveTo(0, cy); ctx.lineTo(ancho, cy); }
      if (x0 <= 0 && x1 >= 0) { const cx = Math.round(px(0)) + 0.5; ctx.moveTo(cx, 0); ctx.lineTo(cx, alto); }
      ctx.stroke();

      // números de los ejes
      ctx.fillStyle = color('--c-text-muted');
      ctx.font = '11px var(--font-mono, monospace)';
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      const ejeY = Math.min(Math.max(py(0), 2), alto - 14);
      for (let x = Math.ceil(x0 / pasoX) * pasoX; x <= x1; x += pasoX) {
        if (Math.abs(x) < pasoX / 1000) continue;
        ctx.fillText(formatNumber(Number(x.toPrecision(6))), px(x), ejeY + 3);
      }
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      const ejeX = Math.min(Math.max(px(0), 24), ancho - 4);
      for (let y = Math.ceil(y0 / pasoY) * pasoY; y <= y1; y += pasoY) {
        if (Math.abs(y) < pasoY / 1000) continue;
        ctx.fillText(formatNumber(Number(y.toPrecision(6))), ejeX - 4, py(y));
      }

      // trazos
      dibujadas = compiladas();
      const saltoGrande = (y1 - y0) * 2;
      ctx.lineWidth = 2.2;
      ctx.lineJoin = 'round';
      for (const f of dibujadas) {
        if (!f.nodo || !f.visible) continue;
        const puntos = muestrear(f.nodo, x0, x1, Math.max(120, Math.round(ancho)));
        ctx.strokeStyle = color(f.color);
        ctx.beginPath();
        let dibujando = false;
        let anterior = null;
        for (const p of puntos) {
          if (Number.isNaN(p.y)) { dibujando = false; anterior = null; continue; }
          // una asíntota no se une con una recta vertical falsa
          const salto = anterior && Math.abs(p.y - anterior.y) > saltoGrande;
          if (!dibujando || salto) { ctx.moveTo(px(p.x), py(p.y)); dibujando = true; }
          else ctx.lineTo(px(p.x), py(p.y));
          anterior = p;
        }
        ctx.stroke();
      }

      describir();
    }

    /** Texto alternativo del lienzo: qué se ve y en qué tramo. */
    function describir() {
      const activas = dibujadas.filter(f => f.nodo && f.visible).map(f => f.texto);
      const { x0, x1, y0, y1 } = estado.vista;
      lienzo.setAttribute('aria-label', activas.length
        ? t('graf.lienzoCon', {
          funciones: activas.join('; '),
          x0: formatNumber(Number(x0.toPrecision(4))), x1: formatNumber(Number(x1.toPrecision(4))),
          y0: formatNumber(Number(y0.toPrecision(4))), y1: formatNumber(Number(y1.toPrecision(4)))
        })
        : t('graf.lienzo'));
    }

    /* ------------- tabla de valores ------------- */
    function pintarTabla() {
      clear(tablaBox);
      const activas = compiladas().filter(f => f.nodo && f.visible);
      if (!activas.length) return;
      const { x0, x1 } = estado.vista;
      const filas = 11;
      const paso = (x1 - x0) / (filas - 1);

      const thead = h('tr', h('th', { scope: 'col', text: 'x' }));
      for (const f of activas) thead.appendChild(h('th', { scope: 'col', text: f.texto }));
      const tbody = h('tbody');
      for (let i = 0; i < filas; i++) {
        const x = x0 + i * paso;
        const tr = h('tr', h('th', { scope: 'row', text: formatNumber(Number(x.toPrecision(4))) }));
        for (const f of activas) {
          let y;
          try { y = evaluate(f.nodo, { vars: { x } }); } catch { y = NaN; }
          tr.appendChild(h('td', { text: Number.isFinite(y) ? formatNumber(Number(y.toPrecision(6))) : '—' }));
        }
        tbody.appendChild(tr);
      }
      tablaBox.append(
        h('p.small.muted', { text: t('graf.tabla') }),
        h('div.tabla-scroll', h('table.tabla', h('caption.visually-hidden', { text: t('graf.tabla') }),
          h('thead', thead), tbody))
      );
    }

    /* ------------- errores ------------- */
    function pintarErrores() {
      clear(listaErrores);
      for (const f of compiladas()) {
        if (f.error) listaErrores.appendChild(notice(t('graf.error', { f: f.texto, motivo: f.error }), { kind: 'warning' }));
      }
    }

    const refrescar = () => { pintar(); pintarTabla(); pintarErrores(); guardar(); };

    /* ------------- lista de funciones ------------- */
    const filas = h('div.stack');

    function pintarFunciones() {
      clear(filas);
      estado.funciones.forEach((f, i) => {
        const campo = field({
          label: t('graf.funcion', { n: i + 1 }),
          value: f.texto,
          onInput: e => { f.texto = e.target.value; refrescar(); }
        });
        campo.input.classList.add('mono');
        campo.input.setAttribute('spellcheck', 'false');
        campo.input.setAttribute('autocapitalize', 'off');

        const punto = h('span.grafica__color', { 'aria-hidden': 'true' });
        punto.style.background = `var(${COLORES[i % COLORES.length]})`;

        const ver = iconButton(f.visible ? 'eye' : 'eyeOff',
          f.visible ? t('graf.ocultar') : t('graf.mostrar'), {
            pressed: f.visible,
            onClick: () => { f.visible = !f.visible; pintarFunciones(); refrescar(); }
          });

        const quitar = iconButton('trash', t('graf.quitar'), {
          onClick: () => {
            if (estado.funciones.length === 1) { estado.funciones[0] = { texto: '', visible: true }; }
            else estado.funciones.splice(i, 1);
            pintarFunciones(); refrescar();
          }
        });

        filas.appendChild(h('div.row.grafica__fila', punto, h('div.grow', campo), ver, quitar));
      });

      if (estado.funciones.length < MAX) {
        filas.appendChild(button(t('graf.anadir'), {
          icon: 'plus',
          onClick: () => { estado.funciones.push({ texto: '', visible: true }); pintarFunciones(); refrescar(); }
        }));
      }
    }

    /* ------------- vista: zoom y desplazamiento ------------- */
    function zoom(factor, cx = 0.5, cy = 0.5) {
      const v = estado.vista;
      const anchoX = (v.x1 - v.x0) * factor;
      const anchoY = (v.y1 - v.y0) * factor;
      if (anchoX < 1e-6 || anchoX > 1e9) return;
      const fx = v.x0 + (v.x1 - v.x0) * cx;
      const fy = v.y1 - (v.y1 - v.y0) * cy;
      estado.vista = {
        x0: fx - anchoX * cx, x1: fx + anchoX * (1 - cx),
        y0: fy - anchoY * (1 - cy), y1: fy + anchoY * cy
      };
      refrescar();
    }

    function mover(dx, dy) {
      const v = estado.vista;
      const ux = (v.x1 - v.x0) * dx;
      const uy = (v.y1 - v.y0) * dy;
      estado.vista = { x0: v.x0 + ux, x1: v.x1 + ux, y0: v.y0 + uy, y1: v.y1 + uy };
      refrescar();
    }

    /** Ajusta el alto para que quepa lo que se ve del primer trazo visible. */
    function ajustarY() {
      const f = compiladas().find(g => g.nodo && g.visible);
      if (!f) { toastError(t('graf.nadaQueAjustar')); return; }
      const { x0, x1 } = estado.vista;
      const rango = rangoVisible(muestrear(f.nodo, x0, x1, 400));
      if (!rango) { toastError(t('graf.nadaQueAjustar')); return; }
      estado.vista = { x0, x1, ...rango };
      refrescar();
      toastOk(t('graf.ajustado'));
    }

    lienzo.addEventListener('wheel', e => {
      e.preventDefault();
      const r = lienzo.getBoundingClientRect();
      zoom(e.deltaY > 0 ? 1.15 : 1 / 1.15, (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
    }, { passive: false });

    let arrastre = null;
    lienzo.addEventListener('pointerdown', e => {
      lienzo.setPointerCapture(e.pointerId);
      arrastre = { x: e.clientX, y: e.clientY };
    });
    lienzo.addEventListener('pointermove', e => {
      const r = lienzo.getBoundingClientRect();
      if (arrastre) {
        mover(-(e.clientX - arrastre.x) / r.width, (e.clientY - arrastre.y) / r.height);
        arrastre = { x: e.clientX, y: e.clientY };
        return;
      }
      trazar((e.clientX - r.left) / r.width);
    });
    const soltar = () => { arrastre = null; };
    lienzo.addEventListener('pointerup', soltar);
    lienzo.addEventListener('pointercancel', soltar);
    lienzo.addEventListener('pointerleave', () => { soltar(); lectura.textContent = ''; });

    /** Lee el valor bajo el cursor y lo anuncia. */
    function trazar(fraccion) {
      const f = compiladas().find(g => g.nodo && g.visible);
      if (!f) { lectura.textContent = ''; return; }
      const { x0, x1 } = estado.vista;
      const x = x0 + (x1 - x0) * Math.min(Math.max(fraccion, 0), 1);
      let y;
      try { y = evaluate(f.nodo, { vars: { x } }); } catch { y = NaN; }
      lectura.textContent = Number.isFinite(y)
        ? t('graf.lectura', { f: f.texto, x: formatNumber(Number(x.toPrecision(5))), y: formatNumber(Number(y.toPrecision(6))) })
        : t('graf.lecturaSinValor', { x: formatNumber(Number(x.toPrecision(5))) });
    }

    // el teclado mueve y acerca sin necesidad de ratón
    lienzo.addEventListener('keydown', e => {
      const acciones = {
        ArrowLeft: () => mover(-0.1, 0), ArrowRight: () => mover(0.1, 0),
        ArrowUp: () => mover(0, 0.1), ArrowDown: () => mover(0, -0.1),
        '+': () => zoom(1 / 1.2), '-': () => zoom(1.2)
      };
      const accion = acciones[e.key];
      if (accion) { e.preventDefault(); accion(); }
    });

    const exportarPNG = () => {
      lienzo.toBlob(blob => {
        if (!blob) { toastError(t('common.error')); return; }
        const url = URL.createObjectURL(blob);
        const a = h('a', { href: url, download: 'grafica.png' });
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        toastOk(t('graf.descargada'));
      }, 'image/png');
    };

    const exportarCSV = () => {
      const activas = compiladas().filter(f => f.nodo && f.visible);
      if (!activas.length) { toastError(t('graf.nadaQueAjustar')); return; }
      const { x0, x1 } = estado.vista;
      const lineas = [['x', ...activas.map(f => f.texto)].join(';')];
      for (let i = 0; i <= 100; i++) {
        const x = x0 + ((x1 - x0) * i) / 100;
        const celdas = activas.map(f => {
          let y; try { y = evaluate(f.nodo, { vars: { x } }); } catch { y = NaN; }
          return Number.isFinite(y) ? y.toPrecision(8) : '';
        });
        lineas.push([x.toPrecision(8), ...celdas].join(';'));
      }
      downloadFile('grafica.csv', lineas.join('\n'), 'text/csv');
      toastOk(t('graf.descargada'));
    };

    const controles = h('div.row',
      iconButton('plus', t('graf.acercar'), { onClick: () => zoom(1 / 1.3) }),
      iconButton('minus', t('graf.alejar'), { onClick: () => zoom(1.3) }),
      button(t('graf.ajustarY'), { onClick: ajustarY }),
      button(t('graf.reiniciar'), { icon: 'refresh', onClick: () => { estado.vista = { ...VISTA_INICIAL }; refrescar(); } }),
      button(t('graf.png'), { icon: 'download', onClick: exportarPNG }),
      button(t('graf.csv'), { icon: 'download', onClick: exportarCSV })
    );

    container.appendChild(h('div.page',
      h('header.page__header',
        h('h1.page__title', { text: t('tools.graficas.name') }),
        h('p.page__lead', { text: t('tools.graficas.desc') })
      ),
      h('div.stack',
        filas,
        listaErrores,
        h('div.grafica', lienzo),
        lectura,
        controles,
        tablaBox,
        notice(t('graf.ayuda'), { kind: 'info' })
      )
    ));

    pintarFunciones();
    refrescar();

    /* El lienzo se repinta al cambiar de tamaño, de tema o de idioma. */
    const ro = new ResizeObserver(() => pintar());
    ro.observe(lienzo);
    const mo = new MutationObserver(() => pintar());
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-accent'] });
    const offIdioma = on('i18n:change', () => { pintarFunciones(); refrescar(); });

    this._limpiar = () => { ro.disconnect(); mo.disconnect(); offIdioma(); };
  },

  unmount() {
    this._limpiar?.();
    this._limpiar = null;
  }
};
