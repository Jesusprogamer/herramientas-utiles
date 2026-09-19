/**
 * Generador de códigos QR.
 *
 * Usa qrcode-generator (MIT), guardado dentro del proyecto en vendor/qrcode,
 * asi que funciona sin conexion. Todo se genera en el dispositivo: el
 * contenido no sale de aqui ni se envia a ningun servidor.
 */
import qrcode from '../../../vendor/qrcode/qrcode.mjs';
import { stringToBytes as utf8Bytes } from '../../../vendor/qrcode/qrcode-utf8.mjs';
import { h, clear, downloadFile } from '../../ui/dom.js';
import { button, tabs, field, select, slider, toggle, settingRow, notice } from '../../ui/components.js';
import { toastOk, toastError } from '../../ui/toast.js';
import * as storage from '../../core/storage.js';
import { t } from '../../core/i18n.js';

// Sin esto, los acentos y las eñes se codifican mal.
qrcode.stringToBytes = utf8Bytes;

const KEY = 'qr';
const LEVELS = ['L', 'M', 'Q', 'H'];

/** Escapa los caracteres reservados del formato WIFI:. */
const escapeWifi = value => String(value).replace(/([\;,:"])/g, '\\$1');

function wifiPayload({ ssid, password, security, hidden }) {
  if (!ssid) return '';
  const type = security === 'nopass' ? 'nopass' : security;
  const parts = [`T:${type}`, `S:${escapeWifi(ssid)}`];
  if (type !== 'nopass' && password) parts.push(`P:${escapeWifi(password)}`);
  if (hidden) parts.push('H:true');
  return `WIFI:${parts.join(';')};;`;
}

export default {
  id: 'qr',

  mount(container) {
    const saved = storage.get(KEY, null) || {};
    const opts = {
      size: Number.isFinite(saved.size) ? Math.min(1024, Math.max(128, saved.size)) : 320,
      level: LEVELS.includes(saved.level) ? saved.level : 'M',
      dark: /^#[0-9a-f]{6}$/i.test(saved.dark || '') ? saved.dark : '#000000',
      light: /^#[0-9a-f]{6}$/i.test(saved.light || '') ? saved.light : '#ffffff',
      margin: Number.isFinite(saved.margin) ? saved.margin : 4
    };
    const persist = () => storage.set(KEY, opts);

    let payload = '';
    /* Cada pestaña deja aqui como recalcular su contenido, para que al volver
       a ella se recupere el QR en lugar de vaciarse. */
    const recompute = {};

    const canvas = h('canvas', { role: 'img', 'aria-label': t('qr.canvasLabel') });
    const errorBox = h('div', { hidden: true });
    const downloadBtn = button(t('qr.download'), { variant: 'primary', icon: 'download', onClick: download });

    function render() {
      clear(errorBox);
      errorBox.hidden = true;
      const ctx = canvas.getContext('2d');

      if (!payload) {
        canvas.width = opts.size;
        canvas.height = opts.size;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        downloadBtn.disabled = true;
        canvas.setAttribute('aria-label', t('qr.canvasEmpty'));
        return;
      }

      let qr;
      try {
        qr = qrcode(0, opts.level);      // 0 = elige el tamaño automaticamente
        qr.addData(payload);
        qr.make();
      } catch (err) {
        errorBox.hidden = false;
        errorBox.appendChild(notice(t('qr.tooLong'), { kind: 'danger' }));
        downloadBtn.disabled = true;
        console.warn('[qr] no se pudo generar', err);
        return;
      }

      const modules = qr.getModuleCount();
      const cell = Math.max(1, Math.floor(opts.size / (modules + opts.margin * 2)));
      const px = (modules + opts.margin * 2) * cell;

      canvas.width = px;
      canvas.height = px;
      canvas.style.width = `${Math.min(px, opts.size)}px`;

      ctx.fillStyle = opts.light;
      ctx.fillRect(0, 0, px, px);
      ctx.fillStyle = opts.dark;
      for (let r = 0; r < modules; r++) {
        for (let c = 0; c < modules; c++) {
          if (qr.isDark(r, c)) {
            ctx.fillRect((c + opts.margin) * cell, (r + opts.margin) * cell, cell, cell);
          }
        }
      }
      downloadBtn.disabled = false;
      canvas.setAttribute('aria-label', t('qr.canvasReady'));
    }

    function download() {
      if (!payload) return;
      canvas.toBlob(blob => {
        if (!blob) { toastError(t('qr.downloadFailed')); return; }
        downloadFile(`qr-${Date.now()}.png`, blob, 'image/png');
        toastOk(t('qr.downloaded'));
      }, 'image/png');
    }

    let debounce = 0;
    const setPayload = value => {
      payload = value;
      clearTimeout(debounce);
      debounce = setTimeout(render, 120);
    };

    /* ---------- pestaña: texto o enlace ---------- */
    function renderText(panel) {
      const textarea = h('textarea.textarea', {
        rows: '4',
        placeholder: t('qr.text.placeholder'),
        'aria-label': t('qr.text.label')
      });
      recompute.texto = () => setPayload(textarea.value.trim());
      textarea.addEventListener('input', recompute.texto);
      panel.append(h('div.stack',
        h('div.field',
          h('label.field__label', { text: t('qr.text.label') }),
          textarea,
          h('p.field__hint', { text: t('qr.text.hint') })
        )
      ));
      setPayload(textarea.value.trim());
    }

    /* ---------- pestaña: wifi ---------- */
    function renderWifi(panel) {
      const data = { ssid: '', password: '', security: 'WPA', hidden: false };
      const update = () => setPayload(wifiPayload(data));
      recompute.wifi = update;

      const ssid = field({
        label: t('qr.wifi.ssid'), type: 'text', maxlength: '64',
        onInput: e => { data.ssid = e.target.value; update(); }
      });
      const password = field({
        label: t('qr.wifi.password'), type: 'password', maxlength: '128',
        hint: t('qr.wifi.passwordHint'),
        onInput: e => { data.password = e.target.value; update(); }
      });
      const security = select({
        label: t('qr.wifi.security'),
        value: 'WPA',
        options: [
          { value: 'WPA', label: t('qr.wifi.wpa') },
          { value: 'WEP', label: 'WEP' },
          { value: 'nopass', label: t('qr.wifi.open') }
        ],
        onChange: e => {
          data.security = e.target.value;
          password.hidden = data.security === 'nopass';
          update();
        }
      });

      panel.append(h('div.stack',
        ssid, security, password,
        settingRow({
          label: t('qr.wifi.hidden.label'), desc: t('qr.wifi.hidden.desc'),
          control: toggle({
            label: t('qr.wifi.hidden.label'),
            onChange: v => { data.hidden = v; update(); }
          })
        }),
        notice(t('qr.wifi.note'), { kind: 'info' })
      ));
      update();
    }

    /* ---------- opciones de aspecto ---------- */
    const sizeSlider = slider({
      label: t('qr.size'), min: 128, max: 1024, step: 32, value: opts.size,
      format: v => `${v} px`,
      onInput: v => { opts.size = v; persist(); render(); }
    });

    const darkInput = h('input.color-native', {
      type: 'color', value: opts.dark, 'aria-label': t('qr.colorDark'),
      onInput: e => { opts.dark = e.target.value; persist(); render(); }
    });
    const lightInput = h('input.color-native', {
      type: 'color', value: opts.light, 'aria-label': t('qr.colorLight'),
      onInput: e => { opts.light = e.target.value; persist(); render(); }
    });

    const levelSelect = select({
      label: t('qr.level'),
      value: opts.level,
      options: LEVELS.map(l => ({ value: l, label: t(`qr.levelName.${l}`) })),
      onChange: e => { opts.level = e.target.value; persist(); render(); }
    });

    container.appendChild(h('div.page',
      h('header.page__header',
        h('h1.page__title', { text: t('tools.qr.name') }),
        h('p.page__lead', { text: t('tools.qr.desc') })
      ),
      h('div.stack',
        h('div.qr-preview', canvas),
        errorBox,
        downloadBtn,
        tabs({
          label: t('tools.qr.name'),
          items: [
            { id: 'texto', label: t('qr.tab.text'), render: renderText },
            { id: 'wifi', label: t('qr.tab.wifi'), render: renderWifi }
          ],
          onChange: id => { if (recompute[id]) recompute[id](); else setPayload(''); }
        }),
        h('details',
          h('summary', { text: t('qr.appearance') }),
          h('div.stack',
            sizeSlider,
            levelSelect,
            h('div.row',
              h('div.field', h('span.field__label', { text: t('qr.colorDark') }), darkInput),
              h('div.field', h('span.field__label', { text: t('qr.colorLight') }), lightInput)
            )
          )
        ),
        notice(t('qr.privacy'), { kind: 'info', iconName: 'shield' })
      )
    ));

    render();
  },

  unmount() {}
};
