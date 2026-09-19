/**
 * Formato de las notas, guardado de forma segura.
 *
 * Una nota NO se guarda como HTML. Se guarda como una lista de fragmentos:
 *   [{ t: 'texto', b: true, i: false, s: false, c: 'rojo' }, …]
 * Al pintarla se construye el DOM con createElement y textContent, así que
 * por mucho que alguien escriba "<script>" solo verá ese texto.
 *
 * El color se guarda como identificador ('rojo'), no como un valor fijo, para
 * que cada tema le dé el tono con buen contraste.
 */

export const COLORS = ['rojo', 'naranja', 'amarillo', 'verde', 'azul', 'violeta', 'rosa', 'gris'];

const BOLD_TAGS = new Set(['B', 'STRONG']);
const ITALIC_TAGS = new Set(['I', 'EM']);
const STRIKE_TAGS = new Set(['S', 'STRIKE', 'DEL']);
const BLOCK_TAGS = new Set(['DIV', 'P', 'LI', 'BLOCKQUOTE', 'H1', 'H2', 'H3']);

/** ¿Este texto plano es lo que ya había guardado (notas antiguas)? */
export const isPlain = value => typeof value === 'string';

/** Convierte una nota antigua de texto plano al modelo nuevo, sin perder nada. */
export function fromPlain(text) {
  return text ? [{ t: String(text) }] : [];
}

/** Normaliza lo que venga del almacenamiento: texto antiguo o fragmentos. */
export function toFragments(value) {
  if (isPlain(value)) return fromPlain(value);
  if (!Array.isArray(value)) return [];
  return value
    .filter(f => f && typeof f.t === 'string')
    .map(f => ({
      t: f.t,
      ...(f.b ? { b: true } : {}),
      ...(f.i ? { i: true } : {}),
      ...(f.s ? { s: true } : {}),
      ...(COLORS.includes(f.c) ? { c: f.c } : {})
    }));
}

/** Texto plano de una nota: lo usan el buscador, la vista previa y copiar. */
export function plainText(fragments) {
  return toFragments(fragments).map(f => f.t).join('');
}

const sameStyle = (a, b) => a.b === b.b && a.i === b.i && a.s === b.s && a.c === b.c;

/** Une fragmentos seguidos con el mismo estilo, para no guardar basura. */
export function compact(fragments) {
  const out = [];
  for (const frag of fragments) {
    if (!frag.t) continue;
    const last = out[out.length - 1];
    if (last && sameStyle(last, frag)) last.t += frag.t;
    else out.push({ ...frag });
  }
  return out;
}

/**
 * Lee el DOM del editor y lo pasa al modelo.
 * Solo se reconocen negrita, cursiva, tachado y color: cualquier otra cosa
 * que el navegador haya metido se queda en el texto y se descarta el envoltorio.
 */
export function fromEditor(root) {
  const out = [];

  const walk = (node, style) => {
    for (const child of node.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        if (child.nodeValue) out.push({ t: child.nodeValue, ...style });
        continue;
      }
      if (child.nodeType !== Node.ELEMENT_NODE) continue;

      if (child.tagName === 'BR') { out.push({ t: '\n' }); continue; }

      const next = { ...style };
      if (BOLD_TAGS.has(child.tagName)) next.b = true;
      if (ITALIC_TAGS.has(child.tagName)) next.i = true;
      if (STRIKE_TAGS.has(child.tagName)) next.s = true;
      if (child.dataset?.color && COLORS.includes(child.dataset.color)) next.c = child.dataset.color;

      // El navegador a veces usa <span style> en lugar de etiquetas.
      const inline = child.style;
      if (inline) {
        const weight = inline.fontWeight;
        if (weight === 'bold' || Number(weight) >= 600) next.b = true;
        if (inline.fontStyle === 'italic') next.i = true;
        if (String(inline.textDecoration || inline.textDecorationLine).includes('line-through')) next.s = true;
      }

      const wasBlock = BLOCK_TAGS.has(child.tagName);
      if (wasBlock && out.length && !out[out.length - 1].t.endsWith('\n')) out.push({ t: '\n' });
      walk(child, next);
    }
  };

  walk(root, {});
  return compact(out);
}

/** Pinta los fragmentos dentro de un contenedor, nodo a nodo. */
export function renderInto(container, fragments) {
  while (container.firstChild) container.removeChild(container.firstChild);
  for (const frag of toFragments(fragments)) {
    for (const [index, piece] of frag.t.split('\n').entries()) {
      if (index > 0) container.appendChild(document.createElement('br'));
      if (!piece) continue;

      let node = document.createTextNode(piece);   // texto plano, siempre
      if (frag.s) { const s = document.createElement('s'); s.appendChild(node); node = s; }
      if (frag.i) { const i = document.createElement('i'); i.appendChild(node); node = i; }
      if (frag.b) { const b = document.createElement('b'); b.appendChild(node); node = b; }
      if (frag.c) {
        const span = document.createElement('span');
        span.className = `nc nc--${frag.c}`;
        span.dataset.color = frag.c;
        span.appendChild(node);
        node = span;
      }
      container.appendChild(node);
    }
  }
  return container;
}

/** ¿Tiene algún formato? Sirve para decidir si basta con texto plano. */
export function hasFormatting(fragments) {
  return toFragments(fragments).some(f => f.b || f.i || f.s || f.c);
}

/* ------------------------------------------------------------------
   Aplicar formato sobre el MODELO, no sobre el DOM.
   Es más código que usar execCommand, pero es determinista: no depende de
   qué etiquetas invente cada navegador, y se puede probar sin navegador.
   ------------------------------------------------------------------ */

export function textLength(fragments) {
  return toFragments(fragments).reduce((n, f) => n + f.t.length, 0);
}

/**
 * Aplica `patch` (p. ej. { b: true } o { c: null }) al tramo [start, end).
 * Los valores null o false quitan el estilo.
 */
export function applyStyle(fragments, start, end, patch) {
  const list = toFragments(fragments);
  if (start >= end) return compact(list);

  const out = [];
  let at = 0;

  for (const frag of list) {
    const from = at;
    const to = at + frag.t.length;
    at = to;

    // Sin solape: queda como está.
    if (to <= start || from >= end) { out.push({ ...frag }); continue; }

    const cut = (a, b, styled) => {
      const text = frag.t.slice(a - from, b - from);
      if (!text) return;
      const next = { ...frag, t: text };
      if (styled) {
        for (const [key, value] of Object.entries(patch)) {
          if (value) next[key] = value;
          else delete next[key];
        }
      }
      out.push(next);
    };

    cut(from, Math.max(from, start), false);                 // trozo anterior
    cut(Math.max(from, start), Math.min(to, end), true);     // trozo afectado
    cut(Math.min(to, end), to, false);                       // trozo posterior
  }

  return compact(out);
}

/** ¿Todo el tramo tiene ya ese estilo? Sirve para los botones con aria-pressed. */
export function styleAt(fragments, start, end, key) {
  const list = toFragments(fragments);
  if (!list.length) return false;
  const span = Math.max(start, 0) === Math.max(end, 0) ? null : [start, end];
  let at = 0;
  let visto = false;
  for (const frag of list) {
    const from = at;
    const to = at + frag.t.length;
    at = to;
    if (span && (to <= span[0] || from >= span[1])) continue;
    if (!span && !(from <= start && start <= to)) continue;
    visto = true;
    if (!frag[key]) return false;
  }
  return visto;
}

/**
 * Sustituye el tramo [start, end) por `text` sin tocar el formato del resto.
 * El texto pegado entra siempre sin formato.
 */
export function replaceRange(fragments, start, end, text) {
  const list = toFragments(fragments);
  const out = [];
  let at = 0;
  let puesto = false;

  const meter = () => { if (!puesto) { if (text) out.push({ t: text }); puesto = true; } };

  for (const frag of list) {
    const from = at;
    const to = at + frag.t.length;
    at = to;

    if (to <= start) { out.push({ ...frag }); continue; }
    if (from >= end) { meter(); out.push({ ...frag }); continue; }

    const antes = frag.t.slice(0, Math.max(0, start - from));
    const despues = frag.t.slice(Math.max(0, end - from));
    if (antes) out.push({ ...frag, t: antes });
    meter();
    if (despues) out.push({ ...frag, t: despues });
  }
  meter();
  return compact(out);
}
