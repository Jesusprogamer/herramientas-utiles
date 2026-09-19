/**
 * Temporizador y pomodoro.
 *
 * El reloj se calcula siempre contra la hora real (`Date.now()`), no sumando
 * ticks: asi no se desfasa aunque el navegador ralentice la pestaña. El estado
 * vive en el modulo y se guarda en disco, de modo que el temporizador sigue
 * corriendo al cambiar de pantalla y sobrevive a una recarga.
 */
import { h, clear } from '../../ui/dom.js';
import { icon } from '../../ui/icons.js';
import { button, tabs, notice } from '../../ui/components.js';
import { toast } from '../../ui/toast.js';
import * as storage from '../../core/storage.js';
import * as settings from '../../core/settings.js';
import { on } from '../../core/events.js';
import * as audio from '../../core/audio.js';
import { alarmSound } from './alarms.js';
import { t, formatTime } from '../../core/i18n.js';

const KEY = 'temporizador';
const PRESETS = [1, 3, 5, 10, 15, 20, 25, 45, 60];

/* ---------------- Estado ---------------- */

const state = {
  mode: 'cuenta',          // 'cuenta' | 'pomodoro'
  phase: 'cuenta',         // 'cuenta' | 'focus' | 'short' | 'long'
  running: false,
  endsAt: 0,               // marca de tiempo real en la que termina
  remainingMs: 25 * 60000, // lo que queda cuando esta en pausa
  totalMs: 25 * 60000,
  round: 1,
  finished: false
};

let alarmTimer = 0;        // dispara el aviso aunque no se este viendo la herramienta
let ringTimer = 0;         // repeticion del aviso mientras nadie lo apaga
let ringing = false;       // la alarma esta sonando ahora mismo
let alarmBanner = null;    // barra global para apagarla desde cualquier pantalla
let ticker = 0;            // refresco de pantalla, solo mientras esta montada
let render = null;         // funcion de pintado actual (null si no esta montada)
let restored = false;

const RING_EVERY_MS = 3000;
const RENOTIFY_EVERY = 5;   // uno de cada 5 ciclos -> vuelve a avisar cada 15 s
let ringCount = 0;

/** Cuantas veces suena, segun el ajuste de repeticion. */
function ringLimit() {
  const modo = settings.get('timer').repeat;
  if (modo === 'una') return 1;
  if (modo === 'tres') return 3;
  return Infinity;
}

function save() {
  storage.set(KEY, {
    mode: state.mode, phase: state.phase, running: state.running,
    endsAt: state.endsAt, remainingMs: state.remainingMs,
    totalMs: state.totalMs, round: state.round
  });
}

function restore() {
  if (restored) return;
  restored = true;
  const saved = storage.get(KEY, null);
  if (!saved || typeof saved !== 'object') { applyPomodoroDefaults(); return; }

  state.mode = saved.mode === 'pomodoro' ? 'pomodoro' : 'cuenta';
  state.phase = ['cuenta', 'focus', 'short', 'long'].includes(saved.phase) ? saved.phase : 'cuenta';
  state.round = Number.isInteger(saved.round) && saved.round > 0 ? saved.round : 1;
  state.totalMs = Number.isFinite(saved.totalMs) && saved.totalMs > 0 ? saved.totalMs : 25 * 60000;

  if (saved.running && Number.isFinite(saved.endsAt)) {
    const left = saved.endsAt - Date.now();
    if (left > 0) { state.running = true; state.endsAt = saved.endsAt; state.remainingMs = left; scheduleAlarm(); }
    else { state.running = false; state.remainingMs = 0; state.finished = true; }
  } else {
    state.running = false;
    state.remainingMs = Number.isFinite(saved.remainingMs) ? Math.max(0, saved.remainingMs) : state.totalMs;
  }
}

function applyPomodoroDefaults() {
  const cfg = settings.get('timer');
  state.totalMs = cfg.focusMinutes * 60000;
  state.remainingMs = state.totalMs;
}

function phaseMinutes(phase) {
  const cfg = settings.get('timer');
  if (phase === 'short') return cfg.shortBreakMinutes;
  if (phase === 'long') return cfg.longBreakMinutes;
  return cfg.focusMinutes;
}

function leftMs() {
  if (state.running) return Math.max(0, state.endsAt - Date.now());
  return Math.max(0, state.remainingMs);
}

/* ---------------- Aviso al terminar ---------------- */

/** Alarma elegida para la fase que acaba de terminar. */
function currentAlarmName() {
  const cfg = settings.get('timer');
  return state.phase === 'short' || state.phase === 'long' ? cfg.alarmBreak : cfg.alarmFocus;
}

/** Suena la alarma elegida. Se fuerza: es un aviso, no un adorno. */
function beep(name) {
  const cfg = settings.get('timer');
  audio.playCustom(alarmSound(name || currentAlarmName()), {
    force: true,
    volume: (cfg.alarmVolume ?? 80) / 100
  });
}

/** Prueba de una alarma desde Ajustes. */
export function testAlarm(name) {
  audio.unlock();
  beep(name);
}

/**
 * Un ciclo de aviso: pitido y vibracion. Se repite hasta que se apaga.
 * Cada cierto numero de ciclos se reenvia la notificacion del sistema, que
 * es lo unico que suena si el movil tiene la pantalla apagada.
 */
function ring() {
  const cfg = settings.get('timer');
  if (cfg.sound) beep();
  if (cfg.vibrate && typeof navigator.vibrate === 'function') {
    try { navigator.vibrate([220, 120, 220, 120, 320]); } catch { /* no compatible */ }
  }
  ringCount += 1;
  if (ringCount % RENOTIFY_EVERY === 0) notifySystem();
}

/**
 * Notificacion del sistema. Se pide al service worker cuando se puede:
 * aguanta mejor con la app en segundo plano y admite `vibrate` y acciones.
 * Aun asi, una web solo puede avisar si la app sigue viva en alguna pestaña;
 * si se cierra del todo, el navegador no la despierta.
 */
function notifySystem() {
  const cfg = settings.get('timer');
  if (!cfg.notify || !('Notification' in window) || Notification.permission !== 'granted') return;

  const label = t(`temporizador.phase.${state.phase}`);
  const options = {
    body: t('temporizador.done.notification', { phase: label }),
    tag: 'amano-temporizador',
    renotify: true,                    // vuelve a avisar al repetirse
    requireInteraction: true,          // no se va sola: el aviso sigue sonando
    silent: false,
    icon: './assets/icons/icon-192.png',
    badge: './assets/icons/icon-192.png',
    vibrate: cfg.vibrate ? [220, 120, 220, 120, 320] : undefined,
    // Boton dentro de la propia notificacion (Android y escritorio).
    actions: [{ action: 'stop', title: t('temporizador.alarm.stop') }]
  };

  const fallback = () => {
    try { new Notification(t('temporizador.done.title'), options); } catch { /* sin permiso */ }
  };

  if (navigator.serviceWorker?.ready) {
    navigator.serviceWorker.ready
      .then(reg => reg.showNotification(t('temporizador.done.title'), options))
      .catch(fallback);
  } else {
    fallback();
  }
}

function closeSystemNotification() {
  if (!navigator.serviceWorker?.ready) return;
  navigator.serviceWorker.ready
    .then(reg => reg.getNotifications({ tag: 'amano-temporizador' }))
    .then(list => list.forEach(n => n.close()))
    .catch(() => { /* nada que cerrar */ });
}

/** Barra fija para apagar la alarma aunque estes en otra pantalla. */
function showAlarmBanner() {
  if (alarmBanner) return;
  alarmBanner = h('div.alarmbar', { role: 'alert' },
    h('span.grow', {
      text: t('temporizador.alarm.ringing', { phase: t(`temporizador.phase.${state.phase}`) })
    }),
    button(t('temporizador.alarm.stop'), { variant: 'primary', icon: 'x', onClick: stopAlarm })
  );
  document.body.appendChild(alarmBanner);
  document.body.classList.add('alarm-on');
}

function hideAlarmBanner() {
  alarmBanner?.remove();
  alarmBanner = null;
  document.body.classList.remove('alarm-on');
}

export function isRinging() { return ringing; }

/* La notificacion del sistema vive fuera de la pagina: cuando la tocas, el
   service worker avisa por aqui para callar el aviso. */
let swListening = false;
function listenToServiceWorker() {
  if (swListening || !('serviceWorker' in navigator)) return;
  swListening = true;
  navigator.serviceWorker.addEventListener('message', event => {
    const type = event.data?.type;
    if (type === 'STOP_ALARM') stopAlarm();
    if (type === 'OPEN_TIMER' && location.hash !== '#/h/temporizador') location.hash = '#/h/temporizador';
  });
}

/** Arranca el aviso y lo repite hasta que la persona lo apaga. */
function startAlarm() {
  ringing = true;
  ringCount = 0;
  ring();
  notifySystem();
  showAlarmBanner();

  // El tope se mira en cada ciclo, NO dentro de ring(): si se comprobara
  // ahi, el primer aviso apagaria la alarma antes de terminar de montarla.
  const limit = ringLimit();
  clearInterval(ringTimer);
  ringTimer = setInterval(() => {
    if (ringCount >= limit) { stopAlarm(); return; }
    ring();
  }, RING_EVERY_MS);
  toast(t('temporizador.done.body', { phase: t(`temporizador.phase.${state.phase}`) }), {
    kind: 'success', duration: 6000
  });
  render?.();
}

/** Apaga el aviso. Lo llaman el boton, la barra y cualquier accion nueva. */
function stopAlarm() {
  if (!ringing) return;
  ringing = false;
  clearInterval(ringTimer);
  ringTimer = 0;
  try { navigator.vibrate?.(0); } catch { /* no compatible */ }
  hideAlarmBanner();
  closeSystemNotification();
  render?.();
}

function scheduleAlarm() {
  clearTimeout(alarmTimer);
  const ms = leftMs();
  if (!state.running || ms <= 0) return;
  alarmTimer = setTimeout(onFinished, ms);
}

function onFinished() {
  state.running = false;
  state.remainingMs = 0;
  state.finished = true;
  startAlarm();

  if (state.mode === 'pomodoro') advancePomodoro();
  save();
  render?.();
}

/** Encadena foco -> descanso corto -> … -> descanso largo. */
function advancePomodoro() {
  const cfg = settings.get('timer');
  if (state.phase === 'focus') {
    const useLong = state.round % cfg.roundsBeforeLongBreak === 0;
    state.phase = useLong ? 'long' : 'short';
  } else {
    if (state.phase === 'short' || state.phase === 'long') state.round += 1;
    state.phase = 'focus';
  }
  state.totalMs = phaseMinutes(state.phase) * 60000;
  state.remainingMs = state.totalMs;
  state.finished = false;
}

/* ---------------- Acciones ---------------- */

function start() {
  stopAlarm();
  if (leftMs() <= 0) return;
  const cfg = settings.get('timer');
  // Un toque del usuario: los moviles exigen desbloquear el audio asi.
  audio.unlock();
  // Y tambien para pedir el permiso de notificaciones, que solo se concede
  // a raiz de un gesto de la persona.
  if (cfg.notify && 'Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission().catch(() => { /* lo decide el navegador */ });
  }
  // Ojo al orden: hay que leer lo que queda ANTES de marcarlo en marcha,
  // porque leftMs() cambia de fuente segun `running`.
  const pending = leftMs();
  state.running = true;
  state.finished = false;
  state.endsAt = Date.now() + pending;
  scheduleAlarm();
  save();
  render?.();
}

function pause() {
  if (!state.running) return;
  state.remainingMs = leftMs();
  state.running = false;
  clearTimeout(alarmTimer);
  save();
  render?.();
}

function reset() {
  stopAlarm();
  state.running = false;
  state.finished = false;
  clearTimeout(alarmTimer);
  state.remainingMs = state.totalMs;
  save();
  render?.();
}

/** Fija la duracion en milisegundos (los atajos y el campo a medida pasan por aqui). */
function setDuration(ms) {
  stopAlarm();
  state.running = false;
  state.finished = false;
  clearTimeout(alarmTimer);
  state.totalMs = Math.max(1000, Math.round(ms));
  state.remainingMs = state.totalMs;
  save();
  render?.();
}

function switchMode(mode) {
  if (state.mode === mode) return;
  stopAlarm();
  state.mode = mode;
  state.running = false;
  state.finished = false;
  clearTimeout(alarmTimer);
  if (mode === 'pomodoro') {
    state.phase = 'focus';
    state.round = 1;
    state.totalMs = phaseMinutes('focus') * 60000;
  } else {
    state.phase = 'cuenta';
    state.totalMs = 25 * 60000;
  }
  state.remainingMs = state.totalMs;
  save();
}

/* ---------------- Pintado ---------------- */

function formatClock(ms) {
  const total = Math.ceil(ms / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = n => String(n).padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}

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

  render = () => {
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
    stopAlarmBtn.hidden = !ringing;

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

  render();
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

/* ---------------- Módulo de herramienta ---------------- */

export default {
  id: 'temporizador',

  mount(container) {
    restore();
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
        { id: 'pomodoro', label: t('temporizador.tab.pomodoro'), render: buildPanel }
      ],
      onChange: id => {
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

    ticker = setInterval(() => {
      if (state.running) render?.();
    }, 250);
  },

  unmount() {
    clearInterval(ticker);
    ticker = 0;
    render = null;
    this._offSettings?.();
    this._offSettings = null;
    // Ojo: el aviso (alarmTimer) NO se cancela, para que suene aunque
    // hayas salido de la herramienta.
  }
};
