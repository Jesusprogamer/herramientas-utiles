/**
 * Selector de colores: conversion entre HEX, RGB y HSL, tonos, colores
 * guardados y comprobador de contraste WCAG.
 */
import { h, clear, copyText } from '../../ui/dom.js';
import { button, iconButton, tabs, field, notice, emptyState } from '../../ui/components.js';
import { toastOk, toastError, toast } from '../../ui/toast.js';
import * as storage from '../../core/storage.js';
import { t, formatNumber } from '../../core/i18n.js';

const KEY = 'colores';

/* ---------------- Conversiones ---------------- */

/** Admite #abc y #aabbcc, con o sin almohadilla. */
export function parseHex(value) {
  const raw = String(value).trim().replace(/^#/, '');
  if (!/^([0-9a-f]{3}|[0-9a-f]{6})$/i.test(raw)) return null;
  const full = raw.length === 3 ? [...raw].map(c => c + c).join('') : raw;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16)
  };
}

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
const toHex = ({ r, g, b }) =>
  `#${[r, g, b].map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('')}`;

export function rgbToHsl({ r, g, b }) {
  const rr = r / 255, gg = g / 255, bb = b / 255;
  const max = Math.max(rr, gg, bb), min = Math.min(rr, gg, bb);
  const l = (max + min) / 2;
  let hue = 0, sat = 0;
  if (max !== min) {
    const d = max - min;
    sat = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === rr) hue = ((gg - bb) / d + (gg < bb ? 6 : 0));
    else if (max === gg) hue = (bb - rr) / d + 2;
    else hue = (rr - gg) / d + 4;
    hue *= 60;
  }
  return { h: Math.round(hue), s: Math.round(sat * 100), l: Math.round(l * 100) };
}

export function hslToRgb({ h, s, l }) {
  const hh = ((h % 360) + 360) % 360 / 360;
  const ss = clamp(s, 0, 100) / 100;
  const ll = clamp(l, 0, 100) / 100;
  if (ss === 0) { const v = Math.round(ll * 255); return { r: v, g: v, b: v }; }
  const q = ll < 0.5 ? ll * (1 + ss) : ll + ss - ll * ss;
  const p = 2 * ll - q;
  const channel = tc => {
    let x = tc;
    if (x < 0) x += 1;
    if (x > 1) x -= 1;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };
  return {
    r: Math.round(channel(hh + 1 / 3) * 255),
    g: Math.round(channel(hh) * 255),
    b: Math.round(channel(hh - 1 / 3) * 255)
  };
}

/** Luminancia relativa segun WCAG 2.x. */
export function luminance({ r, g, b }) {
  const [rr, gg, bb] = [r, g, b].map(v => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rr + 0.7152 * gg + 0.0722 * bb;
}

export function contrastRatio(a, b) {
  const la = luminance(a), lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

function mix(color, target, amount) {
  return {
    r: color.r + (target - color.r) * amount,
    g: color.g + (target - color.g) * amount,
    b: color.b + (target - color.b) * amount
  };
}

/* ---------------- Vista ---------------- */

export default {
  id: 'colores',

  mount(container) {
    const saved = storage.get(KEY, null) || {};
    let color = parseHex(saved.current || '') || { r: 92, g: 157, b: 255 };
    let palette = Array.isArray(saved.palette) ? saved.palette.filter(c => parseHex(c)) : [];

    const persist = () => storage.set(KEY, { current: toHex(color), palette });

    /* ---------- pestaña: selector ---------- */
    function renderPicker(panel) {
      const preview = h('div.color-preview');
      const native = h('input.color-native', {
        type: 'color', 'aria-label': t('colores.pick'),
        onInput: e => { setColor(parseHex(e.target.value), 'native'); }
      });

      const hexField = field({
        label: 'HEX', type: 'text', maxlength: '7', spellcheck: 'false',
        onInput: e => {
          const parsed = parseHex(e.target.value);
          if (!parsed) { hexField.setError(t('colores.invalidHex')); return; }
          hexField.setError('');
          setColor(parsed, 'hex');
        }
      });
      const rgbField = field({
        label: 'RGB', type: 'text', spellcheck: 'false',
        onInput: e => {
          const parts = e.target.value.replace(/rgba?|[()]/gi, '').split(/[,\s/]+/).filter(Boolean).map(Number);
          if (parts.length < 3 || parts.some(n => !Number.isFinite(n) || n < 0 || n > 255)) {
            rgbField.setError(t('colores.invalidRgb')); return;
          }
          rgbField.setError('');
          setColor({ r: parts[0], g: parts[1], b: parts[2] }, 'rgb');
        }
      });
      const hslField = field({
        label: 'HSL', type: 'text', spellcheck: 'false',
        onInput: e => {
          const parts = e.target.value.replace(/hsla?|[()%]/gi, '').split(/[,\s/]+/).filter(Boolean).map(Number);
          if (parts.length < 3 || !Number.isFinite(parts[0]) ||
              parts[1] < 0 || parts[1] > 100 || parts[2] < 0 || parts[2] > 100) {
            hslField.setError(t('colores.invalidHsl')); return;
          }
          hslField.setError('');
          setColor(hslToRgb({ h: parts[0], s: parts[1], l: parts[2] }), 'hsl');
        }
      });

      const copyRow = (labelText, getValue) => iconButton('download', t('colores.copyValue', { name: labelText }), {
        onClick: async () => {
          (await copyText(getValue())) ? toastOk(t('common.copied')) : toastError(t('common.copyFailed'));
        }
      });

      const shades = h('div.shades');
      const paletteRow = h('div.saved-colors');

      const eyedropBtn = button(t('colores.eyedropper'), {
        icon: 'eye',
        onClick: async () => {
          if (!('EyeDropper' in window)) { toast(t('colores.eyedropperUnsupported')); return; }
          try {
            const result = await new window.EyeDropper().open();
            const picked = parseHex(result.sRGBHex);
            if (picked) setColor(picked, 'eyedropper');
          } catch { /* cancelado por la persona */ }
        }
      });
      eyedropBtn.hidden = !('EyeDropper' in window);

      function paintShades() {
        clear(shades);
        for (const amount of [0.8, 0.6, 0.4, 0.2, 0, 0.2, 0.4, 0.6, 0.8]) {
          const idx = [0.8, 0.6, 0.4, 0.2, 0, 0.2, 0.4, 0.6, 0.8].indexOf(amount);
          const shade = idx === 4 ? color : (idx < 4 ? mix(color, 255, amount) : mix(color, 0, amount));
          const hex = toHex(shade);
          shades.appendChild(h('button.shade', {
            type: 'button',
            style: { background: hex },
            'aria-label': t('colores.useShade', { hex }),
            title: hex,
            onClick: () => setColor(parseHex(hex), 'shade')
          }));
        }
      }

      function paintPalette() {
        clear(paletteRow);
        if (!palette.length) {
          paletteRow.appendChild(h('p.small.muted', { text: t('colores.noSaved') }));
          return;
        }
        for (const hex of palette) {
          paletteRow.appendChild(h('button.saved-color', {
            type: 'button', style: { background: hex },
            'aria-label': t('colores.useSaved', { hex }), title: hex,
            onClick: () => setColor(parseHex(hex), 'palette')
          }));
        }
      }

      function refresh(source) {
        const hex = toHex(color);
        const hsl = rgbToHsl(color);
        preview.style.background = hex;
        if (source !== 'native') native.value = hex;
        // Al reescribir un campo con un valor valido hay que retirar su error:
        // si no, se quedaria un aviso antiguo junto a un valor correcto.
        if (source !== 'hex') { hexField.input.value = hex; hexField.setError(''); }
        if (source !== 'rgb') { rgbField.input.value = `${color.r}, ${color.g}, ${color.b}`; rgbField.setError(''); }
        if (source !== 'hsl') { hslField.input.value = `${hsl.h}, ${hsl.s}%, ${hsl.l}%`; hslField.setError(''); }
        paintShades();
      }

      setColor = (next, source) => {
        if (!next) return;
        color = { r: clamp(next.r, 0, 255), g: clamp(next.g, 0, 255), b: clamp(next.b, 0, 255) };
        persist();
        refresh(source);
        if (typeof onColorChange === 'function') onColorChange();
      };

      panel.append(h('div.stack',
        preview,
        h('div.row', native, eyedropBtn),
        h('div.color-input-row', hexField, copyRow('HEX', () => hexField.input.value)),
        h('div.color-input-row', rgbField, copyRow('RGB', () => `rgb(${rgbField.input.value})`)),
        h('div.color-input-row', hslField, copyRow('HSL', () => `hsl(${hslField.input.value})`)),
        h('div.stack',
          h('span.field__label', { text: t('colores.shades') }),
          shades
        ),
        h('div.stack',
          h('div.row',
            h('span.field__label.grow', { text: t('colores.saved') }),
            button(t('colores.save'), {
              icon: 'star',
              onClick: () => {
                const hex = toHex(color);
                if (palette.includes(hex)) { toast(t('colores.alreadySaved')); return; }
                palette = [hex, ...palette].slice(0, 24);
                persist();
                paintPalette();
                toastOk(t('colores.savedOk'));
              }
            }),
            button(t('colores.clearSaved'), {
              icon: 'trash',
              onClick: () => { palette = []; persist(); paintPalette(); }
            })
          ),
          paletteRow
        )
      ));

      refresh();
      paintPalette();
    }

    let setColor = () => {};
    let onColorChange = null;

    /* ---------- pestaña: contraste ---------- */
    function renderContrast(panel) {
      let fg = { r: 255, g: 255, b: 255 };
      let bg = { ...color };

      const fgInput = h('input.color-native', { type: 'color', value: toHex(fg), 'aria-label': t('colores.contrast.text') });
      const bgInput = h('input.color-native', { type: 'color', value: toHex(bg), 'aria-label': t('colores.contrast.bg') });
      const fgText = h('input.input', { type: 'text', value: toHex(fg), 'aria-label': `${t('colores.contrast.text')} HEX`, spellcheck: 'false' });
      const bgText = h('input.input', { type: 'text', value: toHex(bg), 'aria-label': `${t('colores.contrast.bg')} HEX`, spellcheck: 'false' });

      const ratioLabel = h('p.conv__result-value.tnum', { 'aria-live': 'polite' });
      const badges = h('div.badges');
      const previewBox = h('div.contrast-preview',
        h('p.big', { text: t('colores.contrast.sampleBig') }),
        h('p', { text: t('colores.contrast.sampleSmall') })
      );

      const badge = (labelKey, passes) => h(`span.badge.badge--${passes ? 'pass' : 'fail'}`, {
        text: `${t(labelKey)} ${passes ? '✓' : '✗'}`
      });

      function update() {
        const ratio = contrastRatio(fg, bg);
        ratioLabel.textContent = t('colores.contrast.ratio', { value: formatNumber(ratio, { maximumFractionDigits: 2 }) });
        clear(badges);
        badges.append(
          badge('colores.contrast.aaNormal', ratio >= 4.5),
          badge('colores.contrast.aaLarge', ratio >= 3),
          badge('colores.contrast.aaaNormal', ratio >= 7),
          badge('colores.contrast.aaaLarge', ratio >= 4.5)
        );
        previewBox.style.background = toHex(bg);
        previewBox.style.color = toHex(fg);
      }

      const bind = (colorInput, textInput, get, set) => {
        colorInput.addEventListener('input', () => {
          set(parseHex(colorInput.value));
          textInput.value = colorInput.value;
          update();
        });
        textInput.addEventListener('input', () => {
          const parsed = parseHex(textInput.value);
          if (!parsed) return;
          set(parsed);
          colorInput.value = toHex(parsed);
          update();
        });
      };
      bind(fgInput, fgText, () => fg, v => { fg = v; });
      bind(bgInput, bgText, () => bg, v => { bg = v; });

      onColorChange = () => {
        bg = { ...color };
        bgInput.value = toHex(bg);
        bgText.value = toHex(bg);
        update();
      };

      panel.append(h('div.stack',
        h('div.tool-cols.tool-cols--2',
          h('div.field', h('span.field__label', { text: t('colores.contrast.text') }), h('div.row', fgInput, fgText)),
          h('div.field', h('span.field__label', { text: t('colores.contrast.bg') }), h('div.row', bgInput, bgText))
        ),
        h('div.row',
          button(t('colores.contrast.swap'), {
            icon: 'refresh',
            onClick: () => {
              [fg, bg] = [bg, fg];
              fgInput.value = toHex(fg); fgText.value = toHex(fg);
              bgInput.value = toHex(bg); bgText.value = toHex(bg);
              update();
            }
          }),
          button(t('colores.contrast.useCurrent'), {
            onClick: () => { onColorChange(); }
          })
        ),
        ratioLabel,
        badges,
        previewBox,
        notice(t('colores.contrast.hint'), { kind: 'info' })
      ));

      update();
    }

    container.appendChild(h('div.page',
      h('header.page__header',
        h('h1.page__title', { text: t('tools.colores.name') }),
        h('p.page__lead', { text: t('tools.colores.desc') })
      ),
      tabs({
        label: t('tools.colores.name'),
        items: [
          { id: 'selector', label: t('colores.tab.picker'), render: renderPicker },
          { id: 'contraste', label: t('colores.tab.contrast'), render: renderContrast }
        ]
      })
    ));
  },

  unmount() {}
};
