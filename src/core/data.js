// 自分の public/data だけを読む（外部通信はしない）
const cache = new Map();
export async function loadJson(path) {
  if (cache.has(path)) return cache.get(path);
  const res = await fetch('/data/' + path);
  if (!res.ok) throw new Error(path + ' ' + res.status);
  const d = await res.json();
  cache.set(path, d);
  return d;
}
export async function loadPieces() {
  const d = await loadJson('pieces.json');
  return Object.fromEntries(d.pieces.map((p) => [p.id, p]));
}
