/**
 * Temporizador, pomodoro y cronometro.
 *
 * Aqui solo esta la vista: la logica vive en src/core/timers.js, que sigue
 * corriendo aunque salgas de esta pantalla o recargues la pagina. Esta
 * herramienta se suscribe al servicio y se da de baja al desmontarse.
 */
import { h, clear } from '../../ui/dom.js';
import { icon } from '../../ui/icons.js';
import { button, tabs, notice, iconButton } from '../../ui/components.js';
import { toast } from '../../ui/toast.js';
import * as settings from '../../core/settings.js';
import { on } from '../../core/events.js';
import * as audio from '../../core/audio.js';
import { t, formatTime } from '../../core/i18n.js';
import * as timers from '../../core/timers.js';
import { formatCrono } from '../../lib/stopwatch.js';
import { silenciar } from '../../ui/minibar.js';

const {
  PRESETS, state, crono, leftMs, cronoMs, start, pause, reset, setDuration,
  switchMode, formatClock, restore, restoreCrono, stopAlarm, isRinging,
  listenToServiceWorker, phaseMinutes, cronoToggle, cronoReset, cronoLap,
  vueltasConParcial, MAX_VUELTAS, subscribe
} = timers;

export const testAlarm = timers.testAlarm;

let ticker = 0;
let desuscribir = null;
let pintarPanel = null;   // repintado del panel visible (cuenta o pomodoro)
let pintarCrono = null;   // repintado del cronometro


const RADIUS = 46;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function ringSvg() {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('aria-hidden', 'true');
  for (const cls of ['timer__ring-bg', 'timer__ring-fg']) {
    const c = document.createElementNS(NS, 'circle');
    c.setAttribute('cx', '50'); c.setAttribute('cy', '50'); c.setAttribute('r', String(RADIUS));
    c.setAttribute('class', cls);
    svg.appendChild(c);
  }
  return svg;
}

function buildPanel(panel) {
  const ring = ringSvg();
  const progress = ring.querySelector('.timer__ring-fg');
  progress.setAttribute('stroke-dasharray', String(CIRCUMFERENCE));

  const time = h('p.timer__time.tnum', { role: 'timer', 'aria-live': 'off' });
  const phaseLabel = h('p.timer__phase');
  const rounds = h('div.timer__rounds');
  const endsAtLabel = h('p.small.faint');

  const display = h('div.timer__display',
    h('div.timer__ring', ring, h('div.timer__inner', time, phaseLabel)),
    rounds, endsAtLabel
  );

  const startBtn = button('', { variant: 'primary', icon: 'timer', onClick: () => (state.running ? pause() : start()) });
  const resetBtn = button('', { icon: 'refresh', onClick: reset });
  const stopAlarmBtn = button(t('temporizador.alarm.stop'), { variant: 'danger', icon: 'x', onClick: stopAlarm });
  const controls = h('div.row', { style: { justifyContent: 'center' } }, stopAlarmBtn, startBtn, resetBtn);

  const presets = h('div.timer__presets');

  /* Tiempo a medida: minutos Y segundos, no solo atajos redondos. */
  const totalSeconds = Math.round(state.totalMs / 1000);
  const minInput = h('input.input.tnum', {
    type: 'number', min: '0', max: '599', step: '1', inputmode: 'numeric',
    id: 'timer-min', value: String(Math.floor(totalSeconds / 60)),
    style: { maxWidth: '6rem' }
  });
  const secInput = h('input.input.tnum', {
    type: 'number', min: '0', max: '59', step: '1', inputmode: 'numeric',
    id: 'timer-sec', value: String(totalSeconds % 60),
    style: { maxWidth: '6rem' }
  });
  const customError = h('p.field__error', { hidden: true, role: 'alert' });

  const applyCustom = () => {
    const minutes = Number(minInput.value);
    const seconds = Number(secInput.value);
    const valid = Number.isInteger(minutes) && minutes >= 0 && minutes <= 599
      && Number.isInteger(seconds) && seconds >= 0 && seconds <= 59
      && (minutes * 60 + seconds) >= 1;
    if (!valid) {
      customError.hidden = false;
      customError.textContent = t('temporizador.custom.invalid');
      return;
    }
    customError.hidden = true;
    setDuration((minutes * 60 + seconds) * 1000);
  };

  for (const input of [minInput, secInput]) {
    input.addEventListener('keydown', e => { if (e.key === 'Enter') applyCustom(); });
  }

  const customRow = h('div.stack',
    h('p.field__label', { text: t('temporizador.custom.title') }),
    h('div.row', { style: { justifyContent: 'center' } },
      h('div.field', h('label.field__label', { for: 'timer-min', text: t('temporizador.custom.minutes') }), minInput),
      h('div.field', h('label.field__label', { for: 'timer-sec', text: t('temporizador.custom.seconds') }), secInput),
      button(t('temporizador.custom.action'), { variant: 'primary', onClick: applyCustom })
    ),
    customError
  );

  const configNote = h('p.small.muted');

  panel.appendChild(h('div.stack',
    display,
    controls,
    state.mode === 'cuenta' ? h('div.stack', presets, customRow) : configNote
  ));

  if (state.mode === 'cuenta') {
    for (const min of PRESETS) {
      // Sin variante "ghost": estos atajos tienen que verse pulsables.
      presets.appendChild(button(t('temporizador.preset', { n: min }), {
        class: 'btn--sm',
        onClick: () => setDuration(min * 60000)
      }));
    }
  }

  pintarPanel = () => {
    const ms = leftMs();
    const total = Math.max(1, state.totalMs);
    time.textContent = formatClock(ms);
    time.setAttribute('aria-label', t('temporizador.remaining', { time: formatClock(ms) }));

    const ratio = Math.min(1, Math.max(0, ms / total));
    progress.setAttribute('stroke-dashoffset', String(CIRCUMFERENCE * (1 - ratio)));

    phaseLabel.textContent = state.mode === 'pomodoro'
      ? t(`temporizador.phase.${state.phase}`)
      : t(state.finished ? 'temporizador.state.finished' : state.running ? 'temporizador.state.running' : 'temporizador.state.paused');

    display.parentElement?.classList.toggle('timer--over', ms === 0);

    startBtn.lastChild.textContent = state.running ? t('temporizador.pause') : t('temporizador.start');
    startBtn.disabled = ms <= 0 && !state.running;
    resetBtn.lastChild.textContent = t('temporizador.reset');
    stopAlarmBtn.hidden = !isRinging();

    // Los campos a medida siguen al temporizador salvo mientras se escriben.
    if (state.mode === 'cuenta' && document.activeElement !== minInput && document.activeElement !== secInput) {
      const secs = Math.round(state.totalMs / 1000);
      minInput.value = String(Math.floor(secs / 60));
      secInput.value = String(secs % 60);
    }

    endsAtLabel.textContent = state.running
      ? t('temporizador.endsAt', { time: formatTime(new Date(state.endsAt)) })
      : '';

    clear(rounds);
    if (state.mode === 'pomodoro') {
      const cfg = settings.get('timer');
      const done = (state.round - 1) % cfg.roundsBeforeLongBreak;
      for (let i = 0; i < cfg.roundsBeforeLongBreak; i++) {
        rounds.appendChild(h(`span.timer__round${i < done ? '.timer__round--done' : ''}`));
      }
      rounds.setAttribute('aria-label', t('temporizador.round', { n: state.round }));
      configNote.textContent = t('temporizador.pomodoro.config', {
        focus: cfg.focusMinutes, short: cfg.shortBreakMinutes,
        long: cfg.longBreakMinutes, rounds: cfg.roundsBeforeLongBreak
      });
    }
  };

  pintarPanel();
}

/* ---------------- Aviso sobre las notificaciones ----------------
   Sin esto la notificacion del sistema queda escondida en Ajustes y no
   llega nunca. Aqui se ve su estado y se activa de un toque. */

function supportsNotifications() {
  return 'Notification' in window;
}

/** Envia una notificacion de prueba para que se vea que funciona. */
function sendTestNotification() {
  const options = {
    body: t('temporizador.notify.testBody'),
    tag: 'amano-prueba',
    icon: './assets/icons/icon-192.png',
    badge: './assets/icons/icon-192.png'
  };
  const fallback = () => {
    try { new Notification(t('temporizador.notify.testTitle'), options); } catch { /* sin permiso */ }
  };
  if (navigator.serviceWorker?.ready) {
    navigator.serviceWorker.ready
      .then(reg => reg.showNotification(t('temporizador.notify.testTitle'), options))
      .catch(fallback);
  } else {
    fallback();
  }
}

function buildNotificationBox() {
  const box = h('div');

  function paint() {
    clear(box);

    if (!supportsNotifications()) {
      box.appendChild(notice(t('temporizador.notify.unsupported'), { kind: 'warning' }));
      return;
    }

    const permission = Notification.permission;
    const wanted = settings.get('timer').notify;

    if (permission === 'denied') {
      box.appendChild(notice(t('temporizador.notify.denied'), {
        kind: 'warning', title: t('temporizador.notify.title')
      }));
      return;
    }

    if (permission === 'granted' && wanted) {
      const row = notice(t('temporizador.notify.on'), {
        kind: 'success', title: t('temporizador.notify.title')
      });
      row.appendChild(button(t('temporizador.notify.test'), {
        class: 'btn--sm',
        onClick: () => { sendTestNotification(); toast(t('temporizador.notify.tested')); }
      }));
      box.appendChild(row);
      return;
    }

    const row = notice(t('temporizador.notify.ask'), {
      kind: 'info', title: t('temporizador.notify.title')
    });
    row.appendChild(button(t('temporizador.notify.enable'), {
      variant: 'primary', class: 'btn--sm',
      onClick: async () => {
        let result = Notification.permission;
        if (result === 'default') {
          try { result = await Notification.requestPermission(); } catch { result = 'denied'; }
        }
        if (result === 'granted') {
          settings.update({ timer: { notify: true } });
          sendTestNotification();
          toast(t('temporizador.notify.enabled'), { kind: 'success' });
        }
        paint();
      }
    }));
    box.appendChild(row);
  }

  paint();
  box.refresh = paint;
  return box;
}


/* ---------------- Cronometro ---------------- */

function buildCrono(panel) {
  const time = h('p.timer__time.tnum', { role: 'timer', 'aria-live': 'off' });
  const estado = h('p.timer__phase');
  const lista = h('ol.crono__vueltas');
  const aviso = h('p.small.muted', { 'aria-live': 'polite' });

  const startBtn = button('', { variant: 'primary', icon: 'timer', onClick: cronoToggle });
  const lapBtn = button('', {
    icon: 'checklist',
    onClick: () => { if (!cronoLap()) aviso.textContent = t('temporizador.crono.tope', { n: MAX_VUELTAS }); }
  });
  const resetBtn = button('', { icon: 'refresh', onClick: () => { cronoReset(); aviso.textContent = ''; } });

  pintarCrono = () => {
    time.textContent = formatCrono(cronoMs());
    time.setAttribute('aria-label', t('temporizador.crono.transcurrido', { time: formatCrono(cronoMs()) }));
    estado.textContent = t(crono.running ? 'temporizador.state.running' : 'temporizador.state.paused');
    startBtn.lastChild.textContent = crono.running ? t('temporizador.pause') : t('temporizador.start');
    lapBtn.lastChild.textContent = t('temporizador.crono.vuelta');
    lapBtn.disabled = !crono.running || crono.vueltas.length >= MAX_VUELTAS;
    resetBtn.lastChild.textContent = t('temporizador.reset');
    resetBtn.disabled = crono.running || (cronoMs() === 0 && !crono.vueltas.length);

    clear(lista);
    for (const v of vueltasConParcial()) {
      lista.appendChild(h('li.crono__vuelta',
        h('span.small.muted', { text: t('temporizador.crono.numero', { n: v.n }) }),
        h('span.tnum.grow', { text: formatCrono(v.parcial) }),
        h('span.small.muted.tnum', { text: formatCrono(v.total) })
      ));
    }
  };

  panel.append(
    h('div.timer__display', h('div.timer__inner', time, estado)),
    h('div.row', { style: { justifyContent: 'center' } }, startBtn, lapBtn, resetBtn),
    aviso,
    lista
  );
  pintarCrono();
}

/* ---------------- Módulo de herramienta ---------------- */

export default {
  id: 'temporizador',

  mount(container) {
    restore();
    restoreCrono();
    listenToServiceWorker();

    const view = h('div.page',
      h('header.page__header',
        h('h1.page__title', { text: t('tools.temporizador.name') }),
        h('p.page__lead', { text: t('tools.temporizador.desc') })
      )
    );

    const tabsEl = tabs({
      label: t('tools.temporizador.name'),
      active: state.mode,
      items: [
        { id: 'cuenta', label: t('temporizador.tab.countdown'), render: buildPanel },
        { id: 'pomodoro', label: t('temporizador.tab.pomodoro'), render: buildPanel },
        { id: 'crono', label: t('temporizador.tab.crono'), render: buildCrono }
      ],
      onChange: id => {
        // El cronometro es otra cosa: no cambia el modo del temporizador.
        if (id === 'crono') return;
        switchMode(id);
        // Si el panel ya estaba pintado, se reconstruye para el modo nuevo;
        // si no, de eso se encarga el propio componente de pestañas.
        const panel = tabsEl?.querySelector(`.tabs__panel[data-id="${id}"][data-painted]`);
        if (panel) { clear(panel); buildPanel(panel); }
      }
    });

    view.appendChild(tabsEl);

    const notificationBox = buildNotificationBox();
    view.appendChild(notificationBox);
    view.appendChild(notice(t('temporizador.hint'), { kind: 'info' }));
    container.appendChild(view);

    // Si el permiso cambia en otra pestaña o desde Ajustes, se refresca.
    this._offSettings = on('settings:change', ({ changed }) => {
      if (changed.includes('timer')) notificationBox.refresh();
    });

    // Aqui ya estan todos los controles: la minibarra sobra.
    this._silencio = silenciar('temporizador');

    // Una sola suscripcion al servicio: el repintado llega de ahi.
    desuscribir = subscribe(() => { pintarPanel?.(); pintarCrono?.(); });

    // Y un refresco propio mientras algo corre, para que el reloj avance.
    ticker = setInterval(() => {
      if (state.running) pintarPanel?.();
      if (crono.running) pintarCrono?.();
    }, 100);
  },

  unmount() {
    clearInterval(ticker);
    ticker = 0;
    desuscribir?.();
    desuscribir = null;
    pintarPanel = null;
    pintarCrono = null;
    this._silencio?.();
    this._silencio = null;
    this._offSettings?.();
    this._offSettings = null;
    // Ojo: el aviso (alarmTimer) NO se cancela, para que suene aunque
    // hayas salido de la herramienta.
  }
};
