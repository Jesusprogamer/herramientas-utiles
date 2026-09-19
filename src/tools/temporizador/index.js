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
let ticker = 0;            // refresco de pantalla, solo mientras esta montada
let render = null;         // funcion de pintado actual (null si no esta montada)
let restored = false;

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

let audioCtx = null;

/** Pitido generado al vuelo: no necesita ningun archivo y funciona sin conexion. */
function beep() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const now = audioCtx.currentTime;
    [0, 0.28, 0.56].forEach((offset, i) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(i === 2 ? 1046.5 : 880, now + offset);
      gain.gain.setValueAtTime(0.0001, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.32, now + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.22);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 0.24);
    });
  } catch (err) {
    console.warn('[temporizador] no se pudo reproducir el aviso', err);
  }
}

function fireAlarm() {
  const cfg = settings.get('timer');
  const label = t(`temporizador.phase.${state.phase}`);

  if (cfg.sound) beep();
  if (cfg.vibrate && typeof navigator.vibrate === 'function') {
    try { navigator.vibrate([220, 120, 220, 120, 320]); } catch { /* no compatible */ }
  }
  if (cfg.notify && 'Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(t('temporizador.done.title'), {
        body: t('temporizador.done.body', { phase: label }),
        tag: 'amano-temporizador'
      });
    } catch { /* algunos navegadores solo permiten notificaciones desde el SW */ }
  }
  toast(t('temporizador.done.body', { phase: label }), { kind: 'success', duration: 6000 });
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
  fireAlarm();

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
  if (leftMs() <= 0) return;
  // Un toque del usuario: buen momento para desbloquear el audio del navegador.
  if (settings.get('timer').sound) {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      audioCtx.resume?.();
    } catch { /* sin audio */ }
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
  state.running = false;
  state.finished = false;
  clearTimeout(alarmTimer);
  state.remainingMs = state.totalMs;
  save();
  render?.();
}

function setMinutes(min) {
  state.running = false;
  state.finished = false;
  clearTimeout(alarmTimer);
  state.totalMs = Math.round(min * 60000);
  state.remainingMs = state.totalMs;
  save();
  render?.();
}

function switchMode(mode) {
  if (state.mode === mode) return;
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
  const controls = h('div.row', { style: { justifyContent: 'center' } }, startBtn, resetBtn);

  const presets = h('div.timer__presets');
  const customInput = h('input.input', {
    type: 'number', min: '1', max: '600', step: '1', inputmode: 'numeric',
    'aria-label': t('temporizador.custom.label'),
    placeholder: t('temporizador.custom.label'),
    style: { maxWidth: '9rem' }
  });
  const customRow = h('div.row', { style: { justifyContent: 'center' } },
    customInput,
    button(t('temporizador.custom.action'), {
      onClick: () => {
        const n = Number(customInput.value);
        if (!Number.isFinite(n) || n < 1 || n > 600) { toast(t('temporizador.custom.invalid'), { kind: 'error' }); return; }
        setMinutes(n);
      }
    })
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
        onClick: () => setMinutes(min)
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

/* ---------------- Módulo de herramienta ---------------- */

export default {
  id: 'temporizador',

  mount(container) {
    restore();

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
    view.appendChild(notice(t('temporizador.hint'), { kind: 'info' }));
    container.appendChild(view);

    ticker = setInterval(() => {
      if (state.running) render?.();
    }, 250);
  },

  unmount() {
    clearInterval(ticker);
    ticker = 0;
    render = null;
    // Ojo: el aviso (alarmTimer) NO se cancela, para que suene aunque
    // hayas salido de la herramienta.
  }
};
