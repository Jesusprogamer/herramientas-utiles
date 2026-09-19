/** Bus de eventos minimo (publicar / suscribir). */
const map = new Map();

export function on(name, fn) {
  if (!map.has(name)) map.set(name, new Set());
  map.get(name).add(fn);
  return () => off(name, fn);
}

export function off(name, fn) {
  map.get(name)?.delete(fn);
}

export function emit(name, detail) {
  const set = map.get(name);
  if (!set) return;
  for (const fn of [...set]) {
    try { fn(detail); } catch (err) { console.error(`[eventos] ${name}`, err); }
  }
}
