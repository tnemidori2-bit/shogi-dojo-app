// IndexedDB への保存。キー：family / profiles / settings / person/<id>
import { get, set, del } from 'idb-keyval';
import { state, emit, defaultFamily, defaultPerson, defaultSettings, DATA_VERSION } from './store.js';

const ok = (p) => p.catch((e) => { console.warn('save failed', e); emit('saveError'); return false; }).then((r) => r !== false);

// 古い形式を読めるようにする（データを捨てない）。形式を変えるときはここに足す。
function migrateFamily(d) {
  const out = { ...defaultFamily(), ...(d || {}), version: DATA_VERSION };
  if (!out.tsume || typeof out.tsume !== 'object') out.tsume = {}; // 第4段階で追加
  return out;
}
function migratePerson(d) {
  const out = { ...defaultPerson(), ...(d || {}), version: DATA_VERSION };
  if (!out.lessons || typeof out.lessons !== 'object') out.lessons = {};
  if (!out.drills || typeof out.drills !== 'object') out.drills = {}; // 第3段階で追加
  if (!out.tsume || typeof out.tsume !== 'object') out.tsume = {}; // 第4段階で追加
  if (!out.openings || typeof out.openings !== 'object') out.openings = {}; // 第5段階で追加
  out.match = { ...defaultPerson().match, ...(out.match || {}) }; // 第6段階で追加
  out.match.prefs = { ...defaultPerson().match.prefs, ...(out.match.prefs || {}) };
  return out;
}

export async function loadAll() {
  try {
    state.family = migrateFamily(await get('family'));
    state.profiles = (await get('profiles')) || [];
    state.settings = { ...defaultSettings(), ...((await get('settings')) || {}) };
  } catch (e) {
    console.warn('load failed', e);
  }
  state.ready = true;
}

export const saveFamily = () => ok(set('family', state.family));
export const saveProfiles = () => ok(set('profiles', state.profiles));
export const saveSettings = () => ok(set('settings', state.settings));
export const savePerson = () => (state.currentId && state.person ? ok(set('person/' + state.currentId, state.person)) : Promise.resolve(true));
export const saveCurrent = () => Promise.all([saveFamily(), savePerson(), saveProfiles()]);

// 交代：書き出してから読み直す
export async function switchTo(id) {
  await savePerson();
  state.currentId = id;
  state.person = null;
  if (id) {
    let p = null;
    try { p = await get('person/' + id); } catch (e) { console.warn(e); }
    state.person = migratePerson(p);
    if (!p) state.person.difficulty = state.settings.defaultDifficulty;
  }
  emit();
}

export async function removePersonData(id) { try { await del('person/' + id); } catch (e) { console.warn(e); } }
