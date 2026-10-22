import { T } from '../text.js';
import { state, currentProfile, animalOf } from '../core/store.js';
import { loadJson, loadPieces } from '../core/data.js';
import { totalStars, kyuOf, tsumeSolved, tsumeStars } from '../core/rank.js';
import { sfx } from '../core/audio.js';
import { toast } from '../ui.js';
import { escapeHtml } from './profile.js';

const SIGNS = [
  { key: 'lesson', label: T.signLesson, emoji: '📖', ready: true },
  { key: 'drill', label: T.signDrill, emoji: '✏️', ready: true },
  { key: 'tsume', label: T.signTsume, emoji: '👑', ready: true },
  { key: 'senpou', label: T.signSenpou, emoji: '🗡️' },
  { key: 'match', label: T.signMatch, emoji: '⚔️' },
];

const stars = (n) => '★'.repeat(n) + '☆'.repeat(3 - n);

export async function mountHome(root, nav) {
  const el = document.createElement('div');
  el.className = 'screen home';
  const prof = currentProfile();
  const a = animalOf(prof?.icon);
  let lessons = [], drills = [], tsumeSets = [], pieces = {}, kyu = [{ kyu: 10, stars: 0 }];
  try {
    const idx = await loadJson('lessons/index.json');
    lessons = await Promise.all(idx.lessons.map((id) => loadJson(`lessons/${id}.json`)));
    const didx = await loadJson('drills/index.json');
    drills = await Promise.all(didx.drills.map((id) => loadJson(`drills/${id}.json`)));
    tsumeSets = await Promise.all((await loadJson('tsume/index.json')).sets.map((id) => loadJson(`tsume/${id}.json`)));
    pieces = await loadPieces();
    kyu = (await loadJson('levels.json')).kyu;
  } catch (e) { console.warn(e); toast(T.loadFailed); }
  const stars_ = totalStars(state.person, lessons.map((l) => l.id), drills.map((d) => d.id), tsumeSets);

  const lessonRows = lessons.map((l) => {
    const rec = state.person?.lessons?.[l.id];
    return `<button class="lesson" type="button" data-lesson="${l.id}"><span class="lk">${pieces[l.pieceId]?.kanji || ''}</span><span class="lt">${escapeHtml(l.title)}</span><span class="stars">${stars(rec?.stars || 0)}</span></button>`;
  }).join('');
  const drillRows = drills.map((d) => {
    const rec = state.person?.drills?.[d.id];
    return `<button class="lesson" type="button" data-drill="${d.id}"><span class="lk drill">${d.icon}</span><span class="lt">${escapeHtml(d.title)}</span><span class="sub">${T.drillRow(rec?.streak || 0)}</span><span class="stars">${stars(rec?.stars || 0)}</span></button>`;
  }).join('');
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
    <div class="topbar"><span>${a.emoji} ${escapeHtml(prof?.name || a.label)}</span><span>${T.rank(kyuOf(stars_, kyu))}　${T.totalStars(stars_, (lessons.length + drills.length + tsumeSets.length) * 3)}</span><span>${T.level(state.family.level)}</span>
      <button class="btn small" type="button" id="switch">${T.next}</button></div>
    <div class="title">${T.homeTitle}</div>
    <div class="signs">${SIGNS.map((s) => `<button class="sign ${s.ready ? '' : 'off'}" type="button" data-sign="${s.key}"><span class="emoji">${s.emoji}</span>${s.label}</button>`).join('')}</div>
    <div class="lessons" id="lessons">${lessonRows}</div>
    <div class="lessons hidden" id="drills">${drillRows}</div>
    <div class="lessons hidden" id="tsume">${tsumeHtml}</div>`;
  const panels = { lesson: el.querySelector('#lessons'), drill: el.querySelector('#drills'), tsume: el.querySelector('#tsume') };
  const signBtns = [...el.querySelectorAll('[data-sign]')];
  const open = (key) => { for (const k in panels) panels[k].classList.toggle('hidden', k !== key); signBtns.forEach((x) => x.classList.toggle('on', x.dataset.sign === key)); };
  open(['drill', 'tsume'].includes(sessionStorage.getItem('homeTab')) ? sessionStorage.getItem('homeTab') : 'lesson');
  signBtns.forEach((b) => b.addEventListener('click', () => {
    const k = b.dataset.sign;
    if (panels[k]) { sfx('tap'); try { sessionStorage.setItem('homeTab', k); } catch {} open(k); } else { sfx('no'); toast(T.comingSoon); }
  }));
  el.querySelectorAll('[data-problem]').forEach((b) => b.addEventListener('click', () => { sfx('ok'); nav.tsume(b.dataset.tsume, b.dataset.problem); }));
  el.querySelectorAll('[data-drill]').forEach((b) => b.addEventListener('click', () => { sfx('ok'); nav.drill(b.dataset.drill); }));
  el.querySelectorAll('[data-lesson]').forEach((b) => b.addEventListener('click', () => { sfx('ok'); nav.lesson(b.dataset.lesson); }));
  el.querySelector('#switch').addEventListener('click', () => { sfx('tap'); nav.profile(); });
  root.appendChild(el);
  return () => el.remove();
}
