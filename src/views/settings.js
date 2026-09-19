/** Pantalla de Ajustes. Cada cambio se guarda al instante. */
import { h, clear, downloadFile } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import {
  button, iconButton, select, toggle, segmented, notice, settingRow, card, field, slider
} from '../ui/components.js';
import { confirm } from '../ui/dialog.js';
import { toast, toastOk, toastError } from '../ui/toast.js';
import * as settings from '../core/settings.js';
import * as storage from '../core/storage.js';
import * as registry from '../core/registry.js';
import * as pwa from '../core/pwa.js';
import * as account from '../core/account.js';
import { markSvg } from '../core/accents.js';
import * as theme from '../core/theme.js';
import * as audio from '../core/audio.js';
import * as i18n from '../core/i18n.js';
import { t, tn } from '../core/i18n.js';
import { APP_VERSION } from '../core/version.js';
import { refresh } from '../core/router.js';
import { on } from '../core/events.js';

/* Monedas mas habituales para el ajuste "moneda por defecto".
   El conversor (fase 2) traera la lista completa desde la API. */
const COMMON_CURRENCIES = [
  'ARS', 'EUR', 'USD',
  'GBP', 'BRL', 'CLP', 'COP', 'MXN', 'PEN', 'UYU', 'BOB', 'PYG',
  'CHF', 'JPY', 'CNY', 'CAD', 'AUD', 'NZD', 'SEK', 'NOK', 'DKK',
  'PLN', 'CZK', 'HUF', 'RON', 'TRY', 'RUB', 'INR', 'KRW', 'ZAR', 'MAD'
];

function currencyOptions() {
  let names = null;
  try { names = new Intl.DisplayNames([i18n.locale()], { type: 'currency' }); } catch { /* sin soporte */ }
  return COMMON_CURRENCIES.map(code => {
    let label = code;
    try { const n = names?.of(code); if (n && n !== code) label = `${code} · ${n}`; } catch { /* ignorado */ }
    return { value: code, label };
  });
}

function sectionBlock(titleKey, iconName, ...children) {
  return h('section.settings__section',
    h('h2.settings__section-title', icon(iconName), h('span', { text: t(titleKey) })),
    card(...children)
  );
}

/* ---------------------------------------------------------------- */

function appearanceSection() {
  const s = settings.all();

  const theme = segmented({
    label: t('settings.appearance.theme.label'),
    value: s.theme,
    options: settings.THEMES.map(v => ({
      value: v, label: t(`settings.appearance.theme.${v === 'dark' ? 'dark' : v === 'light' ? 'light' : 'system'}`)
    })),
    onChange: v => settings.update({ theme: v })
  });

  const swatches = h('div.swatches', { role: 'radiogroup', 'aria-label': t('settings.appearance.accent.label') });
  const swatchEls = settings.ACCENTS.map(name => {
    const el = h('button.swatch', {
      type: 'button', role: 'radio',
      'aria-checked': String(s.accent === name),
      'aria-label': t(`settings.appearance.accent.${name}`),
      title: t(`settings.appearance.accent.${name}`),
      dataset: { accent: name },
      tabIndex: s.accent === name ? 0 : -1,
      onClick: () => {
        settings.update({ accent: name });
        swatchEls.forEach(b => {
          const onSel = b.dataset.accent === name;
          b.setAttribute('aria-checked', String(onSel));
          b.tabIndex = onSel ? 0 : -1;
        });
      }
    });
    // El color de la muestra se lee del tema activo para ese acento.
    el.style.setProperty('--swatch', `var(--accent-preview-${name})`);
    swatches.appendChild(el);
    return el;
  });

  const textSize = segmented({
    label: t('settings.appearance.textSize.label'),
    value: s.textSize,
    options: settings.TEXT_SIZES.map(v => ({ value: v, label: t(`settings.appearance.textSize.${v}`) })),
    onChange: v => settings.update({ textSize: v })
  });

  const motion = toggle({
    label: t('settings.appearance.reduceMotion.label'),
    checked: s.reduceMotion,
    onChange: v => settings.update({ reduceMotion: v })
  });

  return sectionBlock('settings.appearance.title', 'palette',
    settingRow({ label: t('settings.appearance.theme.label'), desc: t('settings.appearance.theme.desc'), control: theme, stacked: true }),
    settingRow({ label: t('settings.appearance.accent.label'), desc: t('settings.appearance.accent.desc'), control: swatches, stacked: true }),
    settingRow({ label: t('settings.appearance.textSize.label'), desc: t('settings.appearance.textSize.desc'), control: textSize, stacked: true }),
    settingRow({ label: t('settings.appearance.reduceMotion.label'), desc: t('settings.appearance.reduceMotion.desc'), control: motion })
  );
}

/* ---------------- Sonido y animaciones ---------------- */

const SOUND_CUES = [
  ['tap', 'settings.sound.cue.tap'],
  ['toggle', 'settings.sound.cue.toggle'],
  ['success', 'settings.sound.cue.success'],
  ['error', 'settings.sound.cue.error'],
  ['navigate', 'settings.sound.cue.navigate'],
  ['dialog', 'settings.sound.cue.dialog']
];

function soundSection(rerender) {
  const sound = settings.get('sound');
  const rows = [];

  const master = toggle({
    label: t('settings.sound.enabled.label'),
    checked: sound.enabled,
    onChange: value => {
      settings.update({ sound: { enabled: value } });
      if (value) { audio.unlock(); audio.play('success', { force: true }); }
      rerender();
    }
  });

  const volume = slider({
    label: t('settings.sound.volume.label'),
    min: 0, max: 100, step: 5, value: sound.volume,
    format: v => `${v} %`,
    onInput: value => {
      settings.update({ sound: { volume: value } });
      audio.setVolume(value);
    }
  });
  // Al soltar se oye cómo ha quedado.
  volume.input.addEventListener('change', () => { audio.unlock(); audio.play('tap', { force: true }); });

  const styleButtons = h('div.row');
  for (const style of settings.SOUND_STYLES) {
    styleButtons.appendChild(button(t(`settings.sound.style.${style}`), {
      class: 'btn--sm',
      onClick: () => { audio.unlock(); audio.preview(style); }
    }));
  }

  const styleChooser = segmented({
    label: t('settings.sound.style.label'),
    value: sound.style,
    options: settings.SOUND_STYLES.map(v => ({ value: v, label: t(`settings.sound.style.${v}`) })),
    onChange: value => {
      settings.update({ sound: { style: value } });
      audio.unlock();
      audio.preview(value);
    }
  });

  rows.push(settingRow({
    label: t('settings.sound.enabled.label'),
    desc: t('settings.sound.enabled.desc'),
    control: master
  }));

  if (sound.enabled) {
    rows.push(
      volume,
      settingRow({
        label: t('settings.sound.style.label'),
        desc: t('settings.sound.style.desc'),
        control: styleChooser,
        stacked: true
      }),
      h('div.row', h('span.small.muted', { text: t('settings.sound.style.tryIt') }), styleButtons)
    );

    for (const [key, labelKey] of SOUND_CUES) {
      rows.push(settingRow({
        label: t(labelKey),
        control: toggle({
          label: t(labelKey),
          checked: sound[key],
          onChange: value => { settings.update({ sound: { [key]: value } }); }
        })
      }));
    }

    if (audio.supportsHoverSounds()) {
      rows.push(settingRow({
        label: t('settings.sound.hover.label'),
        desc: t('settings.sound.hover.desc'),
        control: toggle({
          label: t('settings.sound.hover.label'),
          checked: sound.hover,
          onChange: value => { settings.update({ sound: { hover: value } }); }
        })
      }));
    } else {
      rows.push(h('p.field__hint', { text: t('settings.sound.hover.unavailable') }));
    }
  }

  if (typeof navigator.vibrate === 'function') {
    rows.push(settingRow({
      label: t('settings.sound.vibrate.label'),
      desc: t('settings.sound.vibrate.desc'),
      control: toggle({
        label: t('settings.sound.vibrate.label'),
        checked: sound.vibrate,
        onChange: value => {
          settings.update({ sound: { vibrate: value } });
          if (value) audio.vibrate([14, 40, 14]);
        }
      })
    }));
  } else {
    rows.push(h('p.field__hint', { text: t('settings.sound.vibrate.unavailable') }));
  }

  rows.push(notice(t('settings.sound.note'), { kind: 'info' }));

  return sectionBlock('settings.sound.title', 'sliders', ...rows);
}

function languageSection() {
  const control = select({
    label: t('settings.language.label'),
    value: settings.get('language'),
    options: [
      { value: 'auto', label: t('settings.language.auto') },
      ...i18n.AVAILABLE.map(code => ({ value: code, label: i18n.languageName(code) }))
    ],
    onChange: async e => {
      settings.update({ language: e.target.value });
      await i18n.setLanguage(e.target.value);
    }
  });
  return sectionBlock('settings.language.title', 'globe',
    settingRow({ label: t('settings.language.label'), desc: t('settings.language.desc'), control, stacked: true })
  );
}

function regionSection() {
  const s = settings.all();

  const time = segmented({
    label: t('settings.region.time.label'),
    value: s.timeFormat,
    options: [
      { value: 'auto', label: t('settings.region.time.auto') },
      { value: '12', label: t('settings.region.time.h12') },
      { value: '24', label: t('settings.region.time.h24') }
    ],
    onChange: v => { settings.update({ timeFormat: v }); updatePreview(); }
  });

  const date = select({
    label: t('settings.region.date.label'),
    value: s.dateFormat,
    options: settings.DATE_FORMATS.map(v => ({ value: v, label: t(`settings.region.date.${v}`) })),
    onChange: e => { settings.update({ dateFormat: e.target.value }); updatePreview(); }
  });

  const currency = select({
    label: t('settings.region.currency.label'),
    value: s.currency,
    options: currencyOptions(),
    onChange: e => { settings.update({ currency: e.target.value }); updatePreview(); }
  });

  const units = segmented({
    label: t('settings.region.units.label'),
    value: s.units,
    options: settings.UNIT_SYSTEMS.map(v => ({ value: v, label: t(`settings.region.units.${v}`) })),
    onChange: v => settings.update({ units: v })
  });

  const preview = h('p.small.muted.tnum');
  function updatePreview() {
    const now = new Date();
    preview.textContent = t('settings.region.preview', {
      date: i18n.formatDate(now),
      time: i18n.formatTime(now),
      number: i18n.formatNumber(1234567.89),
      money: i18n.formatCurrency(1234.5)
    });
  }
  updatePreview();

  return sectionBlock('settings.region.title', 'sliders',
    settingRow({ label: t('settings.region.time.label'), desc: t('settings.region.time.desc'), control: time, stacked: true }),
    settingRow({ label: t('settings.region.date.label'), desc: t('settings.region.date.desc'), control: date, stacked: true }),
    settingRow({ label: t('settings.region.currency.label'), desc: t('settings.region.currency.desc'), control: currency, stacked: true }),
    settingRow({ label: t('settings.region.units.label'), desc: t('settings.region.units.desc'), control: units, stacked: true }),
    preview
  );
}

function toolsSection() {
  const list = h('div.reorder');

  function paintList() {
    clear(list);
    const tools = registry.list({ includeHidden: true });
    tools.forEach((tool, index) => {
      const name = t(`tools.${tool.id}.name`);
      const hidden = registry.isHidden(tool.id);
      const item = h('div.reorder__item', { dataset: { hidden: String(hidden), id: tool.id } },
        h('span.tool-card__icon', { style: { width: '32px', height: '32px' } }, icon(tool.icon)),
        h('span.reorder__name', { text: name }),
        h('div.reorder__controls',
          iconButton('chevronUp', t('settings.tools.moveUp', { name }), {
            disabled: index === 0,
            onClick: () => { registry.move(tool.id, -1); paintList(); }
          }),
          iconButton('chevronDown', t('settings.tools.moveDown', { name }), {
            disabled: index === tools.length - 1,
            onClick: () => { registry.move(tool.id, 1); paintList(); }
          }),
          iconButton(hidden ? 'eyeOff' : 'eye', t(hidden ? 'settings.tools.show' : 'settings.tools.hide', { name }), {
            pressed: !hidden,
            onClick: () => { registry.setHidden(tool.id, !hidden); paintList(); }
          })
        )
      );
      list.appendChild(item);
    });

    const hiddenCount = registry.list({ includeHidden: true }).filter(x => registry.isHidden(x.id)).length;
    counter.textContent = hiddenCount ? tn('settings.tools.hiddenCount', hiddenCount) : '';
  }

  const counter = h('p.small.muted');

  const resetBtn = button(t('settings.tools.resetOrder'), {
    icon: 'refresh',
    onClick: () => { registry.resetOrder(); paintList(); toast(t('settings.tools.orderReset')); }
  });

  paintList();

  /* ---- Opciones del temporizador ---- */
  const timer = settings.get('timer');
  const numberField = (key, min, max) => {
    const f = field({
      label: t(`settings.tools.timer.${key}.label`),
      hint: t(`settings.tools.timer.${key}.desc`),
      type: 'number', min, max, step: 1,
      value: String(timer[`${key}Minutes`] ?? timer[key]),
      inputmode: 'numeric',
      onInput: e => {
        const n = Number(e.target.value);
        if (!Number.isFinite(n) || n < min || n > max) { f.setError(`${min}–${max}`); return; }
        f.setError('');
        settings.update({ timer: { [key === 'rounds' ? 'roundsBeforeLongBreak' : `${key}Minutes`]: n } });
      }
    });
    return f;
  };

  const focusF = numberField('focus', 1, 180);
  focusF.input.value = String(timer.focusMinutes);
  const shortF = numberField('shortBreak', 1, 60);
  shortF.input.value = String(timer.shortBreakMinutes);
  const longF = numberField('longBreak', 1, 120);
  longF.input.value = String(timer.longBreakMinutes);
  const roundsF = numberField('rounds', 2, 12);
  roundsF.input.value = String(timer.roundsBeforeLongBreak);

  const notifySupported = 'Notification' in window;
  const notifyState = h('p.field__hint');
  const notifyToggle = toggle({
    label: t('settings.tools.timer.notify.label'),
    checked: settings.get('timer').notify && (!notifySupported || Notification.permission === 'granted'),
    onChange: async value => {
      if (!value) { settings.update({ timer: { notify: false } }); notifyState.textContent = ''; return; }
      if (!notifySupported) {
        notifyToggle.input.checked = false;
        notifyState.textContent = t('settings.tools.timer.notify.unsupported');
        return;
      }
      let perm = Notification.permission;
      if (perm === 'default') { try { perm = await Notification.requestPermission(); } catch { perm = 'denied'; } }
      if (perm === 'granted') {
        settings.update({ timer: { notify: true } });
        notifyState.textContent = t('settings.tools.timer.notify.granted');
      } else {
        notifyToggle.input.checked = false;
        settings.update({ timer: { notify: false } });
        notifyState.textContent = t('settings.tools.timer.notify.denied');
      }
    }
  });
  if (notifySupported && Notification.permission === 'denied') {
    notifyState.textContent = t('settings.tools.timer.notify.denied');
  } else if (!notifySupported) {
    notifyState.textContent = t('settings.tools.timer.notify.unsupported');
  }

  return sectionBlock('settings.tools.title', 'package',
    h('p.muted.small', { text: t('settings.tools.lead') }),
    list,
    h('div.row', resetBtn, counter),
    h('hr'),
    h('h3', { text: t('settings.tools.timer.title') }),
    h('div.stack', focusF, shortF, longF, roundsF),
    settingRow({
      label: t('settings.tools.timer.sound.label'), desc: t('settings.tools.timer.sound.desc'),
      control: toggle({
        label: t('settings.tools.timer.sound.label'),
        checked: timer.sound, onChange: v => settings.update({ timer: { sound: v } })
      })
    }),
    settingRow({
      label: t('settings.tools.timer.vibrate.label'), desc: t('settings.tools.timer.vibrate.desc'),
      control: toggle({
        label: t('settings.tools.timer.vibrate.label'),
        checked: timer.vibrate, onChange: v => settings.update({ timer: { vibrate: v } })
      })
    }),
    settingRow({
      label: t('settings.tools.timer.notify.label'), desc: t('settings.tools.timer.notify.desc'),
      control: notifyToggle
    }),
    h('p.field__hint', { text: t('settings.tools.timer.notify.hint') }),
    notifyState
  );
}

function dataSection(rerender) {
  const fileInput = h('input', {
    type: 'file', accept: 'application/json,.json', hidden: true,
    onChange: async e => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;
      let parsed;
      try {
        parsed = JSON.parse(await file.text());
      } catch {
        toastError(t('settings.data.import.unreadable'));
        return;
      }
      // Validacion antes de tocar nada.
      const valid = parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        && parsed.app === 'amano'
        && parsed.data && typeof parsed.data === 'object' && !Array.isArray(parsed.data);
      if (!valid) { toastError(t('settings.data.import.invalid')); return; }

      const ok = await confirm({
        title: t('settings.data.import.confirmTitle'),
        message: t('settings.data.import.confirmMessage'),
        confirmLabel: t('settings.data.import.action')
      });
      if (!ok) return;

      const count = storage.importAll(parsed.data);
      settings.load();
      registry.load();
      await i18n.setLanguage(settings.get('language'));
      rerender();
      toastOk(t('settings.data.import.done', { n: count }));
    }
  });

  const exportBtn = button(t('settings.data.export.action'), {
    icon: 'download',
    onClick: () => {
      const payload = {
        app: 'amano',
        schema: storage.SCHEMA_VERSION,
        version: APP_VERSION,
        exportedAt: new Date().toISOString(),
        data: storage.exportAll()
      };
      const stamp = new Date().toISOString().slice(0, 10);
      downloadFile(`amano-copia-${stamp}.json`, JSON.stringify(payload, null, 2));
      toastOk(t('settings.data.export.done'));
    }
  });

  const importBtn = button(t('settings.data.import.action'), {
    icon: 'upload',
    onClick: () => fileInput.click()
  });

  const clearBtn = button(t('settings.data.clear.action'), {
    variant: 'danger', icon: 'trash',
    onClick: async () => {
      const ok = await confirm({
        title: t('settings.data.clear.confirmTitle'),
        message: t('settings.data.clear.confirmMessage'),
        confirmLabel: t('settings.data.clear.action'),
        danger: true
      });
      if (!ok) return;
      storage.clearAll();
      settings.load();
      registry.load();
      storage.runMigrations();
      await i18n.setLanguage(settings.get('language'));
      rerender();
      toastOk(t('settings.data.clear.done'));
    }
  });

  return sectionBlock('settings.data.title', 'database',
    storage.isPersistent() ? null : notice(t('settings.data.blocked.message'), {
      kind: 'warning', title: t('settings.data.blocked.title')
    }),
    settingRow({ label: t('settings.data.export.label'), desc: t('settings.data.export.desc'), control: exportBtn }),
    settingRow({ label: t('settings.data.import.label'), desc: t('settings.data.import.desc'), control: importBtn }),
    settingRow({ label: t('settings.data.clear.label'), desc: t('settings.data.clear.desc'), control: clearBtn }),
    fileInput
  );
}

function accountSection(rerender) {
  const info = account.state();

  /* --- Sin configurar: modo invitado y explicacion --- */
  if (!info.configured) {
    return sectionBlock('settings.account.title', 'user',
      settingRow({
        label: t('settings.account.guest.label'),
        desc: t('settings.account.guest.desc'),
        control: h('span.chip.chip--accent', { text: t('common.on') })
      }),
      notice(t('settings.account.setup.message'), { kind: 'info', title: t('settings.account.setup.title') }),
      h('p.small.muted', { text: t('settings.account.setup.where') })
    );
  }

  /* --- Configurado pero sin sesion: formulario --- */
  if (!info.signedIn) {
    const emailField = field({ label: t('settings.account.email'), type: 'email', autocomplete: 'email' });
    const passField = field({
      label: t('settings.account.password'), type: 'password',
      autocomplete: 'current-password', hint: t('settings.account.passwordHint')
    });
    const message = h('div');

    const busy = value => {
      signInBtn.disabled = value;
      signUpBtn.disabled = value;
      resetBtn.disabled = value;
    };

    const show = (kind, text) => { clear(message); message.appendChild(notice(text, { kind })); };

    const readCredentials = () => {
      const email = emailField.input.value.trim();
      const password = passField.input.value;
      emailField.setError(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? '' : t('settings.account.invalidEmail'));
      passField.setError(password.length >= 6 ? '' : t('settings.account.shortPassword'));
      if (emailField.input.getAttribute('aria-invalid') === 'true' ||
          passField.input.getAttribute('aria-invalid') === 'true') return null;
      return { email, password };
    };

    const signInBtn = button(t('settings.account.signIn'), {
      variant: 'primary', icon: 'user',
      onClick: async () => {
        const creds = readCredentials();
        if (!creds) return;
        busy(true);
        try {
          await account.signIn(creds.email, creds.password);
          account.markAllDirty();
          await account.syncNow();
          toastOk(t('settings.account.signedIn'));
          rerender();
        } catch (err) {
          show('danger', err.message || t('common.error'));
        } finally { busy(false); }
      }
    });

    const signUpBtn = button(t('settings.account.signUp'), {
      onClick: async () => {
        const creds = readCredentials();
        if (!creds) return;
        busy(true);
        try {
          const { needsConfirmation } = await account.signUp(creds.email, creds.password);
          show(needsConfirmation ? 'info' : 'success',
            t(needsConfirmation ? 'settings.account.confirmEmail' : 'settings.account.signedIn'));
          if (!needsConfirmation) { account.markAllDirty(); await account.syncNow(); rerender(); }
        } catch (err) {
          show('danger', err.message || t('common.error'));
        } finally { busy(false); }
      }
    });

    const resetBtn = button(t('settings.account.forgot'), {
      variant: 'ghost',
      onClick: async () => {
        const email = emailField.input.value.trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          emailField.setError(t('settings.account.invalidEmail'));
          return;
        }
        busy(true);
        try {
          await account.resetPassword(email);
          show('success', t('settings.account.resetSent'));
        } catch (err) {
          show('danger', err.message || t('common.error'));
        } finally { busy(false); }
      }
    });

    return sectionBlock('settings.account.title', 'user',
      h('p.muted.small', { text: t('settings.account.why') }),
      h('div.account-form', emailField, passField, h('div.row', signInBtn, signUpBtn), resetBtn),
      message
    );
  }

  /* --- Con sesion iniciada --- */
  const STATUS_CLASS = {
    synced: 'sync-dot--ok', syncing: 'sync-dot--pending',
    offline: 'sync-dot--pending', error: 'sync-dot--error'
  };
  const dot = h(`span.sync-dot.${STATUS_CLASS[info.status] || ''}`);
  const statusText = h('span.small.muted', {
    text: t(`settings.account.status.${info.status}`, { n: info.pending })
      + (info.error ? ` · ${info.error}` : '')
  });

  const syncBtn = button(t('settings.account.syncNow'), {
    icon: 'refresh',
    onClick: async () => {
      syncBtn.disabled = true;
      try { await account.syncNow(); toastOk(t('settings.account.synced')); }
      catch (err) { toastError(err.message || t('common.error')); }
      finally { syncBtn.disabled = false; rerender(); }
    }
  });

  const signOutBtn = button(t('settings.account.signOut'), {
    onClick: async () => {
      try { await account.signOut(); toastOk(t('settings.account.signedOut')); rerender(); }
      catch (err) { toastError(err.message || t('common.error')); }
    }
  });

  const deleteCloudBtn = button(t('settings.account.deleteCloud.action'), {
    variant: 'danger', icon: 'trash',
    onClick: async () => {
      const ok = await confirm({
        title: t('settings.account.deleteCloud.confirmTitle'),
        message: t('settings.account.deleteCloud.confirmMessage'),
        confirmLabel: t('settings.account.deleteCloud.action'), danger: true
      });
      if (!ok) return;
      try { await account.deleteCloudData(); toastOk(t('settings.account.deleteCloud.done')); rerender(); }
      catch (err) { toastError(err.message || t('common.error')); }
    }
  });

  return sectionBlock('settings.account.title', 'user',
    h('div.kv',
      h('div.kv__row', h('span.kv__key', { text: t('settings.account.email') }), h('span.kv__val', { text: info.email })),
      h('div.kv__row', h('span.kv__key', { text: t('settings.account.syncStatus') }), h('span.row', dot, statusText))
    ),
    h('div.row', syncBtn, signOutBtn),
    h('hr'),
    settingRow({
      label: t('settings.account.deleteCloud.label'),
      desc: t('settings.account.deleteCloud.desc'),
      control: deleteCloudBtn
    }),
    notice(t('settings.account.deleteAccount.message'), { kind: 'info', title: t('settings.account.deleteAccount.title') })
  );
}

function aboutSection() {
  const installBtn = button(t('settings.about.install.action'), {
    icon: 'download',
    disabled: !pwa.installAvailable(),
    onClick: async () => {
      const outcome = await pwa.promptInstall();
      if (outcome === 'accepted') toastOk(t('settings.about.install.installed'));
      else if (outcome === 'dismissed') toast(t('settings.about.install.dismissed'));
      else toast(t('settings.about.install.unavailable'));
    }
  });

  const updateBtn = button(t('settings.about.update.action'), {
    icon: 'refresh',
    onClick: async () => {
      if (!pwa.supported()) { toast(t('settings.about.update.unsupported')); return; }
      updateBtn.disabled = true;
      const prev = updateBtn.lastChild.textContent;
      updateBtn.lastChild.textContent = t('settings.about.update.checking');
      const { found } = await pwa.checkForUpdate();
      updateBtn.lastChild.textContent = prev;
      updateBtn.disabled = false;
      if (found) toastOk(t('settings.about.update.found'));
      else toast(t('settings.about.update.upToDate'));
    }
  });

  const linkRow = h('div.row',
    h('a.btn.btn--ghost', { href: '#/privacidad', text: t('settings.about.privacy') }),
    h('a.btn.btn--ghost', { href: '#/licencias', text: t('settings.about.licenses') })
  );

  const logo = markSvg({ accent: settings.get('accent'), label: t('app.name') });
  logo.classList.add('about-logo');
  theme.registerMark(logo);

  return sectionBlock('settings.about.title', 'info',
    h('div.row',
      logo,
      h('div.grow',
        h('p', { text: t('app.name'), style: { fontWeight: '600' } }),
        h('p.small.muted', { text: t('app.tagline') })
      )
    ),
    h('p.field__hint', { text: t('settings.about.iconNote') }),
    h('div.kv',
      h('div.kv__row', h('span.kv__key', { text: t('settings.about.version') }), h('span.kv__val', { text: APP_VERSION })),
      h('div.kv__row', h('span.kv__key', { text: t('settings.about.storage') }),
        h('span.kv__val', { text: t('settings.about.storageValue', { n: storage.SCHEMA_VERSION }) }))
    ),
    settingRow({ label: t('settings.about.install.label'), desc: t('settings.about.install.desc'), control: installBtn }),
    pwa.installAvailable() || pwa.isStandalone() ? null : h('p.field__hint', { text: t('settings.about.install.howto') }),
    settingRow({ label: t('settings.about.update.label'), desc: t('settings.about.update.desc'), control: updateBtn }),
    h('hr'),
    linkRow,
    h('p.small.faint', { text: t('settings.about.sourceLabel') })
  );
}

/* ---------------------------------------------------------------- */

export default function settingsView({ outlet }) {
  const container = h('div.settings');

  function render() {
    clear(container);
    container.appendChild(appearanceSection());
    container.appendChild(soundSection(render));
    container.appendChild(languageSection());
    container.appendChild(regionSection());
    container.appendChild(toolsSection());
    container.appendChild(dataSection(render));
    container.appendChild(accountSection(render));
    container.appendChild(aboutSection());
  }

  render();

  outlet.appendChild(h('div.page',
    h('header.page__header',
      h('h1.page__title', { text: t('settings.title') }),
      h('p.page__lead', { text: t('settings.lead') })
    ),
    container
  ));

  const offLang = on('i18n:change', () => refresh());
  const offInstall = on('pwa:installable', render);
  const offAccount = on('account:change', render);
  return () => { offLang(); offInstall(); offAccount(); };
}
