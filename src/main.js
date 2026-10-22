import './style.css';
import { state, currentProfile, animalOf } from './core/store.js';
import { loadAll, switchTo, saveCurrent } from './core/storage.js';
import { loadJson } from './core/data.js';
import { totalStars, kyuOf, tsumeStars, openingStars, matchStars } from './core/rank.js';
import { applyStreak } from './shogi/drills.js';
import { T } from './text.js';
import { mountStart } from './screens/start.js';
import { mountProfile } from './screens/profile.js';
import { mountAdult } from './screens/adult.js';
import { mountHome } from './screens/home.js';
import { mountLesson } from './screens/lesson.js';
import { mountDrill } from './screens/drill.js';
import { mountTsume, fmtTime } from './screens/tsume.js';
import { mountOpening } from './screens/opening.js';
import { mountMatch } from './screens/match.js';
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
  const tsume = await Promise.all((await loadJson('tsume/index.json')).sets.map((id) => loadJson(`tsume/${id}.json`)));
  const openings = (await loadJson('openings/index.json')).openings;
  return { lessons, drills, tsume, openings };
}

// 1回遊び終えたときの共通の記録：経験値・家族のレベル・「番」・最後に遊んだ日・級
async function finishSession(exp, applyStars) {
  const { levels, kyu } = await loadJson('levels.json');
  const ids = await allIds();
  const kyuBefore = kyuOf(totalStars(state.person, ids.lessons, ids.drills, ids.tsume, ids.openings), kyu);
  applyStars();
  const gained = typeof exp === 'function' ? exp() : exp; // 記録を反映したあとで決まる経験値もある（つめしょうぎ）
  const kyuAfter = kyuOf(totalStars(state.person, ids.lessons, ids.drills, ids.tsume, ids.openings), kyu);
  const before = state.family.level;
  state.person.plays++;
  state.family.exp += gained;
  state.family.turns++;
  for (const l of levels) if (state.family.exp >= l.exp) state.family.level = Math.max(state.family.level, l.level);
  const p = currentProfile(); if (p) p.lastPlayed = Date.now();
  await saveCurrent();
  return { exp: gained, levelUp: state.family.level > before, kyu: kyuAfter, kyuUp: kyuAfter < kyuBefore };
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

// つめしょうぎ：初めて解いたら +2、2回目以降 +1。自己ベスト更新 +1、家族ベスト更新 +2。ヒントを使うと、タイムは記録に載らない
async function recordTsume(setId, problemId, res) {
  const set = await loadJson(`tsume/${setId}.json`);
  const rec = state.person.tsume[problemId] || { solves: 0, best: null, misses: 0 };
  const first = rec.solves === 0;
  const prof = currentProfile();
  const lines = [T.tsumeTime(fmtTime(res.ms))];
  let exp = first ? 2 : 1;
  const info = await finishSession(() => exp, () => {
    rec.solves++;
    rec.misses += res.misses;
    if (!res.hinted) {
      if (rec.best == null || res.ms < rec.best) { if (!first) exp += 1; if (!first) lines.push(T.tsumeMyNew); rec.best = res.ms; }
      const fam = state.family.tsume[problemId];
      if (!fam || res.ms < fam.ms) {
        if (fam) { exp += 2; lines.push(T.tsumeFamilyNew); }
        state.family.tsume[problemId] = { ms: res.ms, icon: prof?.icon || 'turtle', name: prof?.name || '', at: Date.now() };
      }
    } else lines.push(T.tsumeNoRecord);
    state.person.tsume[problemId] = rec;
  });
  const fam = state.family.tsume[problemId];
  if (rec.best != null) lines.push(T.tsumeMyBest(fmtTime(rec.best)));
  if (fam) lines.push(T.tsumeFamilyBest(fmtTime(fam.ms), fam.name || animalOf(fam.icon).label));
  const idx = set.problems.findIndex((p) => p.id === problemId);
  const next = set.problems[(idx + 1) % set.problems.length];
  return { ...info, kind: 'tsume', setId, id: problemId, nextId: next.id, stars: tsumeStars(state.person, set), lines };
}

// 戦法：まなぶ（初回 +1）／ためす（初クリア +2、2回目以降 +1、初めて まちがいなし・ヒントなしで +1）
async function recordOpening(id, mode, res) {
  const rec = state.person.openings[id] || { learned: false, clears: 0, perfect: false, misses: 0 };
  let exp = 0;
  const lines = [];
  const info = await finishSession(() => exp, () => {
    if (mode === 'learn') {
      if (!rec.learned) exp += 1;
      rec.learned = true;
      lines.push(T.learnedNote);
    } else {
      exp += rec.clears === 0 ? 2 : 1;
      rec.clears++;
      rec.misses += res.misses;
      const clean = res.misses === 0 && !res.hinted;
      if (clean && !rec.perfect) { exp += 1; rec.perfect = true; }
      lines.push(clean ? T.noMistake : T.openingMissNote(res.misses, res.hinted));
    }
    state.person.openings[id] = rec;
  });
  return { ...info, kind: 'opening', id, mode, stars: openingStars(state.person, id), lines };
}

// たいきょく：勝ち +3（駒落ちなしで初めてその強さに勝てば +2）、負け・引き分け・投了 +1。★は、駒落ちなしで勝てた強さの数
async function recordMatch(res) {
  const m = state.person.match;
  let exp = 1;
  const lines = [];
  const info = await finishSession(() => exp, () => {
    m.plays++;
    if (res.outcome === 'win') {
      exp = 3;
      if (res.handicap === 'none') {
        if (!(m.wins[res.level] > 0)) { exp += 2; lines.push(T.matchFirstWin(T.levelLabel[res.level])); }
        m.wins[res.level] = (m.wins[res.level] || 0) + 1;
      } else m.handicapWins++;
    } else if (res.outcome === 'loss') m.losses[res.level] = (m.losses[res.level] || 0) + 1;
    else m.draws++;
    m.prefs = { level: res.level, side: res.me, handicap: res.handicap };
  });
  lines.push(T.expGain(exp));
  if (info.levelUp) lines.push(T.levelUp(state.family.level));
  lines.push(info.kyuUp ? T.rankUp(info.kyu) : T.rank(info.kyu));
  lines.push(T.starsNow(matchStars(state.person)));
  return { ...info, exp, lines };
}

const nav = {
  start: () => show(mountStart),
  profile: async () => { await switchTo(null); await show(mountProfile); },
  adult: () => show(mountAdult),
  play: async (id) => { await switchTo(id); await show(mountHome); },
  home: () => show(mountHome),
  lesson: (id) => show(mountLesson, id),
  drill: (id) => show(mountDrill, id),
  match: (cfg) => show(mountMatch, cfg),
  matchRecord: (res) => recordMatch(res),
  opening: (id, mode) => show(mountOpening, id, mode),
  openingResult: async (id, mode, res) => show(mountResult, await recordOpening(id, mode, res)),
  tsume: (setId, problemId) => show(mountTsume, setId, problemId),
  tsumeResult: async (setId, problemId, res) => show(mountResult, await recordTsume(setId, problemId, res)),
  result: async (id) => show(mountResult, await recordLesson(id)),
  drillResult: async (id, results) => show(mountResult, await recordDrill(id, results)),
};

(async () => {
  await loadAll();
  nav.start();
  if (import.meta.env.DEV) window.__state = state;
})();
