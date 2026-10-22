import { T } from '../text.js';
import { state, currentProfile, animalOf } from '../core/store.js';
import { loadJson, loadPieces } from '../core/data.js';
import { totalStars, kyuOf, tsumeSolved, tsumeStars, openingStars, matchStars } from '../core/rank.js';
import { HANDICAPS } from '../shogi/game.js';
import { sfx } from '../core/audio.js';
import { toast } from '../ui.js';
import { escapeHtml } from './profile.js';

const SIGNS = [
  { key: 'lesson', label: T.signLesson, emoji: '📖', ready: true },
  { key: 'drill', label: T.signDrill, emoji: '✏️', ready: true },
  { key: 'tsume', label: T.signTsume, emoji: '👑', ready: true },
  { key: 'senpou', label: T.signSenpou, emoji: '🗡️', ready: true },
  { key: 'match', label: T.signMatch, emoji: '⚔️', ready: true },
];

const stars = (n) => '★'.repeat(n) + '☆'.repeat(3 - n);

export async function mountHome(root, nav) {
  const el = document.createElement('div');
  el.className = 'screen home';
  const prof = currentProfile();
  const a = animalOf(prof?.icon);
  let lessons = [], drills = [], tsumeSets = [], openings = [], pieces = {}, kyu = [{ kyu: 10, stars: 0 }];
  try {
    const idx = await loadJson('lessons/index.json');
    lessons = await Promise.all(idx.lessons.map((id) => loadJson(`lessons/${id}.json`)));
    const didx = await loadJson('drills/index.json');
    drills = await Promise.all(didx.drills.map((id) => loadJson(`drills/${id}.json`)));
    tsumeSets = await Promise.all((await loadJson('tsume/index.json')).sets.map((id) => loadJson(`tsume/${id}.json`)));
    openings = await Promise.all((await loadJson('openings/index.json')).openings.map((id) => loadJson(`openings/${id}.json`)));
    pieces = await loadPieces();
    kyu = (await loadJson('levels.json')).kyu;
  } catch (e) { console.warn(e); toast(T.loadFailed); }
  const stars_ = totalStars(state.person, lessons.map((l) => l.id), drills.map((d) => d.id), tsumeSets, openings.map((o) => o.id));

  const lessonRows = lessons.map((l) => {
    const rec = state.person?.lessons?.[l.id];
    return `<button class="lesson" type="button" data-lesson="${l.id}"><span class="lk">${pieces[l.pieceId]?.kanji || ''}</span><span class="lt">${escapeHtml(l.title)}</span><span class="stars">${stars(rec?.stars || 0)}</span></button>`;
  }).join('');
  const drillRows = drills.map((d) => {
    const rec = state.person?.drills?.[d.id];
    return `<button class="lesson" type="button" data-drill="${d.id}"><span class="lk drill">${d.icon}</span><span class="lt">${escapeHtml(d.title)}</span><span class="sub">${T.drillRow(rec?.streak || 0)}</span><span class="stars">${stars(rec?.stars || 0)}</span></button>`;
  }).join('');
  const openingHtml = openings.map((o) => `<div class="tsume-set"><div class="tsume-head"><span class="lt">${escapeHtml(o.title)}</span><span class="stars">${stars(openingStars(state.person, o.id))}</span></div><p class="note">${escapeHtml(o.summary)}</p><div class="actions"><button class="btn" type="button" data-op="${o.id}" data-mode="learn">${T.learn}</button><button class="btn big" type="button" data-op="${o.id}" data-mode="try">${T.try_}</button></div></div>`).join('') + `<p class="note">${T.openingStars}</p>`;
  const mp = state.person?.match?.prefs || { level: 'weak', side: 0, handicap: 'none' };
  const mrec = state.person?.match || { wins: {}, losses: {} };
  const matchHtml = `<div class="tsume-set">
    <div class="tsume-head"><span class="lt">${T.matchSetup}</span><span class="stars">${stars(matchStars(state.person))}</span></div>
    <div class="opt-title">${T.levelTitle}</div>
    <div class="opts" data-group="level">${['weak', 'normal', 'strong'].map((l) => `<button type="button" class="btn small" data-val="${l}">${T.levelLabel[l]}</button>`).join('')}</div>
    <div class="opt-title" id="side-title">${T.sideTitle}</div>
    <div class="opts" data-group="side">${[0, 1].map((s_) => `<button type="button" class="btn small" data-val="${s_}">${T.sideLabel[s_]}</button>`).join('')}</div>
    <div class="opt-title">${T.handicapTitle}</div>
    <div class="opts" data-group="handicap">${Object.entries(HANDICAPS).map(([k, v]) => `<button type="button" class="btn small" data-val="${k}">${v.label}</button>`).join('')}</div>
    <p class="note" id="handicap-note">${T.handicapNote}</p>
    <div class="actions"><button class="btn big" type="button" id="match-start">${T.matchStart}</button></div>
    <p class="note">${T.matchRecord(mrec.wins?.weak || 0, mrec.wins?.normal || 0, mrec.wins?.strong || 0)}<br>${T.matchStarsNote}</p>
  </div>`;
  const tsumeHtml = tsumeSets.map((set) => {
    const solved = tsumeSolved(state.person, set);
    const need = set.unlock ? set.unlock.solved : 0;
    const base = set.unlock ? tsumeSets.find((x) => x.id === set.unlock.set) : null;
    const locked = base && tsumeSolved(state.person, base) < need;
    const head = `<div class="tsume-head"><span class="lt">${escapeHtml(set.title)}</span><span class="sub">${T.tsumeSolvedCount(solved, set.problems.length)}</span><span class="stars">${stars(tsumeStars(state.person, set))}</span></div>`;
    if (locked) return `<div class="tsume-set">${head}<p class="note">${T.tsumeLocked(base.title, need)}</p></div>`;
    const nums = set.problems.map((p) => `<button type="button" class="num ${(state.person?.tsume?.[p.id]?.solves || 0) > 0 ? 'done' : ''}" data-tsume="${set.id}" data-problem="${p.id}">${p.no}</button>`).join('');
    return `<div class="tsume-set">${head}<div class="nums">${nums}</div></div>`;
  }).join('');
  el.innerHTML = `
    <div class="topbar"><span>${a.emoji} ${escapeHtml(prof?.name || a.label)}</span><span>${T.rank(kyuOf(stars_, kyu))}　${T.totalStars(stars_, (lessons.length + drills.length + tsumeSets.length + openings.length + 1) * 3)}</span><span>${T.level(state.family.level)}</span>
      <button class="btn small" type="button" id="switch">${T.next}</button></div>
    <div class="title">${T.homeTitle}</div>
    <div class="signs">${SIGNS.map((s) => `<button class="sign ${s.ready ? '' : 'off'}" type="button" data-sign="${s.key}"><span class="emoji">${s.emoji}</span>${s.label}</button>`).join('')}</div>
    <div class="lessons" id="lessons">${lessonRows}</div>
    <div class="lessons hidden" id="drills">${drillRows}</div>
    <div class="lessons hidden" id="tsume">${tsumeHtml}</div>
    <div class="lessons hidden" id="senpou">${openingHtml}</div>
    <div class="lessons hidden" id="match">${matchHtml}</div>`;
  const panels = { lesson: el.querySelector('#lessons'), drill: el.querySelector('#drills'), tsume: el.querySelector('#tsume'), senpou: el.querySelector('#senpou'), match: el.querySelector('#match') };
  const signBtns = [...el.querySelectorAll('[data-sign]')];
  const open = (key) => { for (const k in panels) panels[k].classList.toggle('hidden', k !== key); signBtns.forEach((x) => x.classList.toggle('on', x.dataset.sign === key)); };
  open(['drill', 'tsume', 'senpou', 'match'].includes(sessionStorage.getItem('homeTab')) ? sessionStorage.getItem('homeTab') : 'lesson');
  signBtns.forEach((b) => b.addEventListener('click', () => {
    const k = b.dataset.sign;
    if (panels[k]) { sfx('tap'); try { sessionStorage.setItem('homeTab', k); } catch {} open(k); } else { sfx('no'); toast(T.comingSoon); }
  }));
  // たいきょくの設定
  const cfg = { level: mp.level, side: mp.side, handicap: mp.handicap };
  const paintOpts = () => {
    el.querySelectorAll('#match .opts').forEach((g) => g.querySelectorAll('button').forEach((b) => b.classList.toggle('on', String(cfg[g.dataset.group]) === b.dataset.val)));
    const handi = cfg.handicap !== 'none';
    el.querySelector('#match [data-group="side"]').classList.toggle('hidden', handi);
    el.querySelector('#side-title').classList.toggle('hidden', handi);
    el.querySelector('#handicap-note').classList.toggle('hidden', !handi);
  };
  el.querySelectorAll('#match .opts button').forEach((b) => b.addEventListener('click', () => {
    const g = b.parentElement.dataset.group;
    cfg[g] = g === 'side' ? Number(b.dataset.val) : b.dataset.val;
    sfx('tap'); paintOpts();
  }));
  paintOpts();
  el.querySelector('#match-start')?.addEventListener('click', () => {
    sfx('ok');
    nav.match({ level: cfg.level, handicap: cfg.handicap, me: cfg.handicap === 'none' ? cfg.side : 0 });
  });
  el.querySelectorAll('[data-op]').forEach((b) => b.addEventListener('click', () => { sfx('ok'); nav.opening(b.dataset.op, b.dataset.mode); }));
  el.querySelectorAll('[data-problem]').forEach((b) => b.addEventListener('click', () => { sfx('ok'); nav.tsume(b.dataset.tsume, b.dataset.problem); }));
  el.querySelectorAll('[data-drill]').forEach((b) => b.addEventListener('click', () => { sfx('ok'); nav.drill(b.dataset.drill); }));
  el.querySelectorAll('[data-lesson]').forEach((b) => b.addEventListener('click', () => { sfx('ok'); nav.lesson(b.dataset.lesson); }));
  el.querySelector('#switch').addEventListener('click', () => { sfx('tap'); nav.profile(); });
  root.appendChild(el);
  return () => el.remove();
}
