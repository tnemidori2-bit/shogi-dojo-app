// IndexedDB への保存。キー：family / profiles / settings / person/<id>
import { get, set, del } from 'idb-keyval';
import { state, emit, defaultSettings } from './store.js';
import { migrateFamily, migratePerson, buildBackup, parseBackup } from './backup.js';

const ok = (p) => p.catch((e) => { console.warn('save failed', e); emit('saveError'); return false; }).then((r) => r !== false);

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

// ---- 書き出し・読み込み ----
export async function buildExport() {
  await savePerson();
  const persons = {};
  for (const p of state.profiles) {
    try { persons[p.id] = migratePerson(await get('person/' + p.id)); } catch { persons[p.id] = migratePerson(null); }
  }
  state.settings.lastExport = Date.now();
  await saveSettings();
  return buildBackup({ family: state.family, profiles: state.profiles, persons, settings: state.settings });
}

export { parseBackup };

// 読み込み：いまの記録をすべて置きかえる
export async function applyImport(data) {
  for (const p of state.profiles) await removePersonData(p.id);
  state.family = data.family;
  state.profiles = data.profiles;
  state.settings = data.settings;
  state.currentId = null;
  state.person = null;
  for (const p of data.profiles) await set('person/' + p.id, data.persons[p.id]);
  await Promise.all([saveFamily(), saveProfiles(), saveSettings()]);
  emit();
}

// 消えにくくする：ブラウザに、保存した記録を勝手に消さないようお願いする（断られても、遊びには影響しない）
export async function askPersistent() {
  try { return (await navigator.storage?.persist?.()) === true; } catch { return false; }
}
