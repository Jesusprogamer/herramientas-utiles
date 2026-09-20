/**
 * Pantalla de bienvenida de la primera vez.
 *
 * Seis pasos que se aplican en directo: lo que eliges se ve al momento,
 * no al final. Se guarda segun se avanza, pero la bienvenida solo se marca
 * como hecha al terminarla o al omitirla.
 *
 * El indicador de «hecha» es de este dispositivo y no se sincroniza: en un
 * movil nuevo tiene sentido volver a verla.
 */
import { h, clear } from './dom.js';
import { icon } from './icons.js';
import { button, segmented, notice } from './components.js';
import { t } from '../core/i18n.js';
import * as settings from '../core/settings.js';
import * as i18n from '../core/i18n.js';
import * as registry from '../core/registry.js';
import * as storage from '../core/storage.js';
import * as pwa from '../core/pwa.js';
import { markSvg } from '../core/accents.js';

const KEY = 'bienvenida';

/** Conjuntos de herramientas que propone cada perfil. */
export const PERFILES = {
  estudiante: ['temporizador', 'agenda', 'horario', 'notas', 'calculadora', 'tabla', 'formulario'],
  diaADia: ['listas', 'temporizador', 'unidades', 'monedas', 'porcentajes', 'qr'],
  todas: null   // todas las que haya
};

export function estaHecha() {
  return storage.get(KEY, null)?.hecha === true;
}

function marcarHecha() {
  storage.set(KEY, { hecha: true, cuando: Date.now() });
}

/**
 * Se enseña sola la primera vez, pero no si ya hay datos guardados: quien
 * lleva tiempo usando la app no tiene por que ver una bienvenida.
 */
export function deberiaMostrarse() {
  if (estaHecha()) return false;
  const claves = storage.keys().filter(k => k !== KEY);
  return claves.length === 0;
}

/** Si el sistema puede instalar la app o ya esta instalada, ese paso sobra. */
function instrucionesInstalacion() {
  const ua = navigator.userAgent || '';
  if (/iPhone|iPad|iPod/.test(ua)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  if (/Mac OS X/.test(ua) && /Safari/.test(ua) && !/Chrome/.test(ua)) return 'safariMac';
  return 'escritorio';
}

export function abrir({ alCerrar } = {}) {
  const dlg = h('dialog.bienvenida', { 'aria-labelledby': 'bienv-titulo' });
  const contenido = h('div.bienvenida__contenido');
  const puntos = h('div.bienvenida__puntos', { 'aria-hidden': 'true' });
  let paso = 0;
  let pasos = [];

  const cerrar = (hecha) => {
    if (hecha) marcarHecha();
    try { dlg.close(); } catch { /* ya cerrado */ }
    dlg.remove();
    alCerrar?.();
  };

  /* ---------------- pasos ---------------- */

  const pasoIdioma = () => {
    const caja = h('div.stack');
    const control = segmented({
      label: t('bienvenida.idioma.label'),
      value: settings.get('language'),
      options: i18n.AVAILABLE.map(c => ({ value: c, label: i18n.languageName(c) })),
      onChange: async v => {
        settings.update({ language: v });
        await i18n.setLanguage(v);
        pintar();   // la bienvenida se traduce al momento, como todo lo demas
      }
    });
    caja.append(control);
    return caja;
  };

  const pasoTema = () => segmented({
    label: t('settings.appearance.theme.label'),
    value: settings.get('theme'),
    options: settings.THEMES.map(v => ({ value: v, label: t(`settings.appearance.theme.${v}`) })),
    onChange: v => settings.update({ theme: v })
  });

  const pasoAcento = () => {
    const fila = h('div.bienvenida__acentos');
    for (const acento of settings.ACCENTS) {
      const b = h('button.acento', {
        type: 'button',
        'aria-label': t(`settings.appearance.accent.${acento}`),
        'aria-pressed': String(settings.get('accent') === acento),
        onClick: () => { settings.update({ accent: acento }); pintar(); }
      });
      b.dataset.accent = acento;
      b.appendChild(markSvg({ accent: acento }));
      fila.appendChild(b);
    }
    return fila;
  };

  const pasoFavoritas = () => {
    const caja = h('div.stack');
    const rejilla = h('div.bienvenida__rejilla');

    const pintarRejilla = () => {
      clear(rejilla);
      for (const tool of registry.list()) {
        const marcada = registry.isFavorite(tool.id);
        const b = h('button.bienvenida__tool', {
          type: 'button',
          'aria-pressed': String(marcada),
          onClick: () => { registry.toggleFavorite(tool.id); pintarRejilla(); }
        }, icon(tool.icon), h('span', { text: t(`tools.${tool.id}.name`) }));
        if (marcada) b.classList.add('bienvenida__tool--on');
        rejilla.appendChild(b);
      }
    };

    const aplicarPerfil = nombre => {
      const lista = PERFILES[nombre];
      const quiero = new Set(lista || registry.list().map(x => x.id));
      for (const tool of registry.list()) {
        const debe = quiero.has(tool.id);
        if (registry.isFavorite(tool.id) !== debe) registry.toggleFavorite(tool.id);
      }
      pintarRejilla();
    };

    caja.append(
      h('div.row',
        ...Object.keys(PERFILES).map(nombre =>
          button(t(`bienvenida.perfil.${nombre}`), { onClick: () => aplicarPerfil(nombre) }))),
      rejilla
    );
    pintarRejilla();
    return caja;
  };

  const pasoInstalar = () => {
    const caja = h('div.stack');
    caja.appendChild(h('p', { text: t('bienvenida.instalar.que') }));
    if (pwa.installAvailable()) {
      caja.appendChild(button(t('settings.about.install.action'), {
        variant: 'primary', icon: 'download',
        onClick: async () => { await pwa.promptInstall(); pintar(); }
      }));
    } else {
      caja.appendChild(notice(t(`bienvenida.instalar.${instrucionesInstalacion()}`), { kind: 'info' }));
    }
    return caja;
  };

  const pasoListo = () => h('div.stack',
    h('p.small.muted', { text: t('bienvenida.listo.ajustes') })
  );

  function construirPasos() {
    const lista = [
      { clave: 'idioma', render: pasoIdioma },
      { clave: 'tema', render: pasoTema },
      { clave: 'acento', render: pasoAcento },
      { clave: 'favoritas', render: pasoFavoritas }
    ];
    // Si ya esta instalada, ese paso no aporta nada.
    if (!pwa.isStandalone()) lista.push({ clave: 'instalar', render: pasoInstalar });
    lista.push({ clave: 'listo', render: pasoListo });
    return lista;
  }

  /* ---------------- pintado ---------------- */

  function pintar() {
    pasos = construirPasos();
    paso = Math.min(paso, pasos.length - 1);
    const actual = pasos[paso];

    clear(contenido);
    clear(puntos);

    for (let i = 0; i < pasos.length; i++) {
      const punto = h('span.bienvenida__punto');
      if (i === paso) punto.classList.add('bienvenida__punto--on');
      puntos.appendChild(punto);
    }

    const atras = button(t('common.back'), {
      onClick: () => { if (paso > 0) { paso -= 1; pintar(); } }
    });
    atras.disabled = paso === 0;

    const esUltimo = paso === pasos.length - 1;
    const siguiente = button(t(esUltimo ? 'bienvenida.empezar' : 'bienvenida.siguiente'), {
      variant: 'primary',
      onClick: () => { if (esUltimo) cerrar(true); else { paso += 1; pintar(); } }
    });

    contenido.append(
      h('p.bienvenida__paso', { text: t('bienvenida.pasoN', { n: paso + 1, total: pasos.length }) }),
      h('h2.bienvenida__titulo#bienv-titulo', { text: t(`bienvenida.${actual.clave}.titulo`) }),
      h('p.bienvenida__texto', { text: t(`bienvenida.${actual.clave}.desc`) }),
      actual.render(),
      puntos,
      h('div.row.bienvenida__botones',
        button(t('bienvenida.omitir'), { onClick: () => cerrar(true) }),
        h('span.grow'),
        atras,
        siguiente
      )
    );
    siguiente.focus();
  }

  // El foco no se escapa del dialogo: es lo primero que se ve de la app.
  dlg.addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.preventDefault(); return; }   // se sale con Omitir
    if (e.key !== 'Tab') return;
    const focos = [...dlg.querySelectorAll('button:not([disabled]), [role="radio"]')];
    if (!focos.length) return;
    const primero = focos[0];
    const ultimo = focos.at(-1);
    if (e.shiftKey && document.activeElement === primero) { e.preventDefault(); ultimo.focus(); }
    else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primero.focus(); }
  });
  dlg.addEventListener('cancel', e => e.preventDefault());

  dlg.appendChild(contenido);
  document.body.appendChild(dlg);
  pintar();
  dlg.showModal();
}

/** La abre si toca. Se llama al arrancar la app. */
export function quizaAbrir() {
  if (!deberiaMostrarse()) return;
  // Un respiro para que la app termine de pintarse por debajo.
  setTimeout(() => abrir(), 400);
}
