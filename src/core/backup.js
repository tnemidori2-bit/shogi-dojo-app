// 記録の書き出し・読み込みで使う、変換と検査。画面にも IndexedDB にも依存しない（Node でテストできる）。
import { ANIMALS, MAX_PROFILES, NAME_MAX, DATA_VERSION, defaultFamily, defaultPerson, defaultSettings } from './store.js';

export const APP = 'shogi-dojo';
export const MAX_BYTES = 3 * 1024 * 1024;

// 古い形式を読めるようにする（データを捨てない）。形式を変えるときはここに足す。
export function migrateFamily(d) {
  const out = { ...defaultFamily(), ...(d || {}), version: DATA_VERSION };
  if (!out.tsume || typeof out.tsume !== 'object') out.tsume = {};
  return out;
}
export function migratePerson(d) {
  const out = { ...defaultPerson(), ...(d || {}), version: DATA_VERSION };
  for (const k of ['lessons', 'drills', 'tsume', 'openings']) if (!out[k] || typeof out[k] !== 'object') out[k] = {};
  out.match = { ...defaultPerson().match, ...(out.match || {}) };
  out.match.prefs = { ...defaultPerson().match.prefs, ...(out.match.prefs || {}) };
  return out;
}

export function buildBackup({ family, profiles, persons, settings }) {
  return { app: APP, version: DATA_VERSION, exportedAt: new Date().toISOString(), family, profiles, persons, settings };
}

const isObj = (x) => x && typeof x === 'object' && !Array.isArray(x);

// ファイルの中身（文字）を検査して、使える形にして返す。{ ok:true, data } か { ok:false, reason }
export function parseBackup(text) {
  if (typeof text !== 'string' || text.length > MAX_BYTES) return { ok: false, reason: 'size' };
  let d;
  try { d = JSON.parse(text); } catch { return { ok: false, reason: 'json' }; }
  if (!isObj(d) || d.app !== APP) return { ok: false, reason: 'app' };
  if (typeof d.version !== 'number' || d.version > DATA_VERSION) return { ok: false, reason: 'version' };
  if (!isObj(d.family) || typeof d.family.level !== 'number' || typeof d.family.exp !== 'number') return { ok: false, reason: 'family' };
  if (!Array.isArray(d.profiles) || d.profiles.length > MAX_PROFILES) return { ok: false, reason: 'profiles' };
  const ids = new Set();
  const profiles = [];
  for (const p of d.profiles) {
    if (!isObj(p) || typeof p.id !== 'string' || !p.id || p.id.length > 64 || ids.has(p.id)) return { ok: false, reason: 'profiles' };
    if (!ANIMALS.some((a) => a.id === p.icon)) return { ok: false, reason: 'profiles' };
    const name = typeof p.name === 'string' ? p.name.trim() : '';
    if (name.length > NAME_MAX) return { ok: false, reason: 'profiles' };
    ids.add(p.id);
    profiles.push({ id: p.id, icon: p.icon, name, lastPlayed: typeof p.lastPlayed === 'number' ? p.lastPlayed : null });
  }
  if (d.persons != null && !isObj(d.persons)) return { ok: false, reason: 'persons' };
  const persons = {};
  for (const p of profiles) persons[p.id] = migratePerson((d.persons || {})[p.id]);
  return {
    ok: true,
    data: {
      family: migrateFamily(d.family),
      profiles,
      persons,
      settings: { ...defaultSettings(), ...(isObj(d.settings) ? d.settings : {}) },
    },
  };
}
