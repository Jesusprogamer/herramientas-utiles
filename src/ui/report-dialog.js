/**
 * Diálogo de «Informar de un error» y «Sugerir una mejora».
 *
 * Recoge una descripcion, arma el informe completo y lo deja a la vista
 * para leerlo y editarlo antes de enviarlo. Nada sale de aqui solo: hay
 * que pulsar el boton, y entonces se abre GitHub en otra pestaña.
 *
 * Privacidad: el informe lleva datos del entorno (version, navegador,
 * tamaño de pantalla…), nunca contenido de notas, tareas ni cuenta.
 */
import { h, clear, copyText } from './dom.js';
import { button, field, notice, toggle } from './components.js';
import { toast, toastOk, toastError } from './toast.js';
import { t } from '../core/i18n.js';
import * as settings from '../core/settings.js';
import * as diagnostics from '../core/diagnostics.js';
import { VERSION, ISSUES_URL, issueUrl } from '../core/app-info.js';
import { navegador, sistema, formato, cuerpo, titulo } from '../lib/report.js';

/** Herramienta abierta ahora mismo, sacada de la direccion. */
function herramientaActual() {
  const m = location.hash.match(/#\/h\/([\w-]+)/);
  if (m) return t(`tools.${m[1]}.name`);
  if (location.hash.startsWith('#/ajustes')) return t('settings.title');
  return t('home.title');
}

function instalada() {
  return window.matchMedia?.('(display-mode: standalone)').matches
    || window.navigator.standalone === true;
}

function datosDelEntorno() {
  const ua = navigator.userAgent || '';
  return {
    version: VERSION,
    herramienta: herramientaActual(),
    idiomaApp: settings.get('language'),
    idiomaNavegador: navigator.language || '—',
    tema: t(`settings.appearance.theme.${settings.get('theme')}`),
    acento: t(`settings.appearance.accent.${settings.get('accent')}`),
    navegador: navegador(ua),
    sistema: sistema(ua),
    formato: t(`informe.formato.${formato(window.innerWidth)}`),
    pantalla: `${window.innerWidth}×${window.innerHeight}`,
    instalada: t(instalada() ? 'common.yes' : 'common.no'),
    conexion: t(navigator.onLine ? 'informe.conectado' : 'connection.offline')
  };
}

const ETIQUETAS = () => ({
  quePasa: t('informe.quePasa'),
  entorno: t('informe.entorno'),
  errores: t('informe.erroresTitulo'),
  sinDescripcion: t('informe.sinDescripcion'),
  version: t('settings.about.version'),
  herramienta: t('informe.herramienta'),
  idiomaApp: t('informe.idiomaApp'),
  idiomaNavegador: t('informe.idiomaNavegador'),
  tema: t('settings.appearance.theme.label'),
  navegador: t('informe.navegador'),
  sistema: t('informe.sistema'),
  formato: t('informe.formatoLabel'),
  pantalla: t('informe.pantalla'),
  instalada: t('informe.instalada'),
  conexion: t('informe.conexion')
});

/** @param tipo 'error' | 'mejora' */
export function abrirInforme(tipo) {
  const esError = tipo === 'error';
  const dlg = h('dialog.dialog.dialog--ancho', { 'aria-labelledby': 'informe-titulo' });

  const cerrar = () => {
    try { dlg.close(); } catch { /* ya cerrado */ }
    dlg.remove();
  };

  const descripcion = h('textarea.textarea', {
    rows: '4',
    id: 'informe-descripcion',
    placeholder: t(esError ? 'informe.placeholderError' : 'informe.placeholderMejora')
  });

  const hayErrores = diagnostics.hayErrores();
  let incluirErrores = hayErrores;
  const vistaPrevia = h('pre.informe__previa', { tabindex: '0', 'aria-label': t('informe.previa') });

  function texto() {
    return cuerpo({
      descripcion: descripcion.value,
      datos: datosDelEntorno(),
      errores: incluirErrores ? diagnostics.comoTexto() : '',
      etiquetas: ETIQUETAS()
    });
  }

  function refrescar() {
    // Es texto, no HTML: va por textContent aunque venga de la propia app.
    vistaPrevia.textContent = texto();
  }

  descripcion.addEventListener('input', refrescar);

  const interruptorErrores = hayErrores
    ? toggle({
      label: t('informe.incluirErrores'),
      checked: incluirErrores,
      onChange: v => { incluirErrores = v; refrescar(); }
    })
    : null;

  const enviar = button(t('informe.enviar'), {
    variant: 'primary', icon: 'upload',
    onClick: () => {
      const { url, recortado } = issueUrl({
        title: titulo(t(esError ? 'informe.prefijoError' : 'informe.prefijoMejora'), descripcion.value),
        body: texto(),
        labels: [esError ? 'bug' : 'enhancement']
      });
      if (recortado) toast(t('informe.recortado'));
      window.open(url, '_blank', 'noopener,noreferrer');
      cerrar();
    }
  });

  const copiar = button(t('informe.copiar'), {
    icon: 'download',
    onClick: async () => {
      (await copyText(texto())) ? toastOk(t('common.copied')) : toastError(t('common.copyFailed'));
    }
  });

  dlg.appendChild(h('div.dialog__body',
    h('h2#informe-titulo.card__title', { text: t(esError ? 'informe.tituloError' : 'informe.tituloMejora') }),
    h('div.field',
      h('label.field__label', { for: 'informe-descripcion', text: t('informe.quePasa') }),
      descripcion),
    interruptorErrores
      ? h('div.row', interruptorErrores, h('span.small.muted', { text: t('informe.incluirErroresDesc') }))
      : null,
    h('p.small.muted', { text: t('informe.previaDesc') }),
    vistaPrevia,
    notice(t('informe.aviso'), { kind: 'warning' }),
    h('div.dialog__actions',
      h('a.btn.btn--ghost', {
        href: ISSUES_URL, target: '_blank', rel: 'noopener noreferrer',
        text: t('informe.verAbiertos')
      }),
      button(t('common.cancel'), { onClick: cerrar }),
      copiar,
      enviar
    )
  ));

  dlg.addEventListener('cancel', e => { e.preventDefault(); cerrar(); });
  dlg.addEventListener('click', e => { if (e.target === dlg) cerrar(); });

  document.body.appendChild(dlg);
  refrescar();
  dlg.showModal();
  descripcion.focus();
}
