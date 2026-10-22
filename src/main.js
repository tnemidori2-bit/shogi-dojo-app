import './style.css';
import { state, currentProfile } from './core/store.js';
import { loadAll, switchTo, saveCurrent } from './core/storage.js';
import { loadJson } from './core/data.js';
import { totalStars, kyuOf } from './core/rank.js';
import { applyStreak } from './shogi/drills.js';
import { T } from './text.js';
import { mountStart } from './screens/start.js';
import { mountProfile } from './screens/profile.js';
import { mountAdult } from './screens/adult.js';
import { mountHome } from './screens/home.js';
import { mountLesson } from './screens/lesson.js';
import { mountDrill } from './screens/drill.js';
import { mountResult } from './screens/result.js';

// 拡大を止める（iOS Safari）
['gesturestart', 'gesturechange', 'gestureend'].forEach((e) => document.addEventListener(e, (ev) => ev.preventDefault()));

const root = document.getElementById('ui');
let unmount = null;
async function show(mounter, ...args) {
  if (unmount) { unmount(); unmount = null; }
  unmount = await mounter(root, nav, ...args);
}

// 級の計算に使う、全レッスンと全ドリルの id
async function allIds() {
  const lessons = (await loadJson('lessons/index.json')).lessons;
  const drills = (await loadJson('drills/index.json')).drills;
  return { lessons, drills };
}

// 1回遊び終えたときの共通の記録：経験値・家族のレベル・「番」・最後に遊んだ日・級
async function finishSession(exp, applyStars) {
  const { levels, kyu } = await loadJson('levels.json');
  const ids = await allIds();
  const kyuBefore = kyuOf(totalStars(state.person, ids.lessons, ids.drills), kyu);
  applyStars();
  const kyuAfter = kyuOf(totalStars(state.person, ids.lessons, ids.drills), kyu);
  const before = state.family.level;
  state.person.plays++;
  state.family.exp += exp;
  state.family.turns++;
  for (const l of levels) if (state.family.exp >= l.exp) state.family.level = Math.max(state.family.level, l.level);
  const p = currentProfile(); if (p) p.lastPlayed = Date.now();
  await saveCurrent();
  return { exp, levelUp: state.family.level > before, kyu: kyuAfter, kyuUp: kyuAfter < kyuBefore };
}

// レッスン：★は初回=1、2回目=2、3回目以降=3。経験値は初回+2、以降+1
async function recordLesson(lessonId) {
  const rec = state.person.lessons[lessonId] || { clears: 0, stars: 0 };
  const first = rec.clears === 0;
  const info = await finishSession(first ? 2 : 1, () => {
    rec.clears++;
    rec.stars = Math.min(3, Math.max(rec.stars, rec.clears));
    state.person.lessons[lessonId] = rec;
  });
  return { ...info, kind: 'lesson', id: lessonId, stars: rec.stars, lines: [] };
}

// ドリル：5問。れんぞく正解で★（3・5・8）。経験値は +1、全問せいかいなら +2
async function recordDrill(drillId, results) {
  const correct = results.filter((r) => r !== 'ng').length;
  const exp = correct === results.length ? 2 : 1;
  let rec;
  const info = await finishSession(exp, () => {
    rec = applyStreak(state.person.drills[drillId], results);
    state.person.drills[drillId] = rec;
  });
  return {
    ...info, kind: 'drill', id: drillId, stars: rec.stars,
    lines: [T.drillScore(correct, results.length), T.streak(rec.streak), T.bestStreak(rec.best), T.streakGoal],
  };
}

const nav = {
  start: () => show(mountStart),
  profile: async () => { await switchTo(null); await show(mountProfile); },
  adult: () => show(mountAdult),
  play: async (id) => { await switchTo(id); await show(mountHome); },
  home: () => show(mountHome),
  lesson: (id) => show(mountLesson, id),
  drill: (id) => show(mountDrill, id),
  result: async (id) => show(mountResult, await recordLesson(id)),
  drillResult: async (id, results) => show(mountResult, await recordDrill(id, results)),
};

(async () => {
  await loadAll();
  nav.start();
  if (import.meta.env.DEV) window.__state = state;
})();
