import './style.css';
import { state, currentProfile } from './core/store.js';
import { loadAll, switchTo, saveCurrent } from './core/storage.js';
import { loadJson } from './core/data.js';
import { mountStart } from './screens/start.js';
import { mountProfile } from './screens/profile.js';
import { mountAdult } from './screens/adult.js';
import { mountHome } from './screens/home.js';
import { mountLesson } from './screens/lesson.js';
import { mountResult } from './screens/result.js';

// 拡大を止める（iOS Safari）
['gesturestart', 'gesturechange', 'gestureend'].forEach((e) => document.addEventListener(e, (ev) => ev.preventDefault()));

const root = document.getElementById('ui');
let unmount = null;
async function show(mounter, ...args) {
  if (unmount) { unmount(); unmount = null; }
  unmount = await mounter(root, nav, ...args);
}

// 先生の導入：レッスンを終えたときの記録（★は初回=1、2回目=2、3回目以降=3）
async function recordLesson(lessonId) {
  const rec = state.person.lessons[lessonId] || { clears: 0, stars: 0 };
  const first = rec.clears === 0;
  rec.clears++;
  rec.stars = Math.min(3, Math.max(rec.stars, rec.clears));
  state.person.lessons[lessonId] = rec;
  state.person.plays++;
  const exp = first ? 2 : 1;
  const before = state.family.level;
  state.family.exp += exp;
  state.family.turns++;
  const { levels } = await loadJson('levels.json');
  for (const l of levels) if (state.family.exp >= l.exp) state.family.level = Math.max(state.family.level, l.level);
  const p = currentProfile(); if (p) p.lastPlayed = Date.now();
  await saveCurrent();
  return { lessonId, stars: rec.stars, exp, levelUp: state.family.level > before };
}

const nav = {
  start: () => show(mountStart),
  profile: async () => { await switchTo(null); await show(mountProfile); },
  adult: () => show(mountAdult),
  play: async (id) => { await switchTo(id); await show(mountHome); },
  home: () => show(mountHome),
  lesson: (id) => show(mountLesson, id),
  result: async (id) => show(mountResult, await recordLesson(id)),
};

(async () => {
  await loadAll();
  nav.start();
  if (import.meta.env.DEV) window.__state = state;
})();
