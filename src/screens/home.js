import { T } from '../text.js';
import { state, currentProfile, animalOf } from '../core/store.js';
import { loadJson } from '../core/data.js';
import { sfx } from '../core/audio.js';
import { toast } from '../ui.js';
import { escapeHtml } from './profile.js';

const SIGNS = [
  { key: 'lesson', label: T.signLesson, emoji: '📖', ready: true },
  { key: 'drill', label: T.signDrill, emoji: '✏️' },
  { key: 'tsume', label: T.signTsume, emoji: '👑' },
  { key: 'senpou', label: T.signSenpou, emoji: '🗡️' },
  { key: 'match', label: T.signMatch, emoji: '⚔️' },
];

const stars = (n) => '★'.repeat(n) + '☆'.repeat(3 - n);

export async function mountHome(root, nav) {
  const el = document.createElement('div');
  el.className = 'screen home';
  const prof = currentProfile();
  const a = animalOf(prof?.icon);
  let lessons = [];
  try {
    const idx = await loadJson('lessons/index.json');
    lessons = await Promise.all(idx.lessons.map((id) => loadJson(`lessons/${id}.json`)));
  } catch (e) { console.warn(e); toast(T.loadFailed); }

  const lessonRows = lessons.map((l) => {
    const rec = state.person?.lessons?.[l.id];
    return `<button class="lesson" type="button" data-lesson="${l.id}"><span>${escapeHtml(l.title)}</span><span class="stars">${stars(rec?.stars || 0)}</span></button>`;
  }).join('');
  el.innerHTML = `
    <div class="topbar"><span>${a.emoji} ${escapeHtml(prof?.name || a.label)}</span><span>${T.level(state.family.level)}</span>
      <button class="btn small" type="button" id="switch">${T.next}</button></div>
    <div class="title">${T.homeTitle}</div>
    <div class="signs">${SIGNS.map((s) => `<button class="sign ${s.ready ? '' : 'off'}" type="button" data-sign="${s.key}"><span class="emoji">${s.emoji}</span>${s.label}</button>`).join('')}</div>
    <div class="lessons hidden" id="lessons">${lessonRows}</div>`;
  const panel = el.querySelector('#lessons');
  el.querySelectorAll('[data-sign]').forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.sign === 'lesson') { sfx('tap'); panel.classList.toggle('hidden'); } else { sfx('no'); toast(T.comingSoon); }
  }));
  el.querySelectorAll('[data-lesson]').forEach((b) => b.addEventListener('click', () => { sfx('ok'); nav.lesson(b.dataset.lesson); }));
  el.querySelector('#switch').addEventListener('click', () => { sfx('tap'); nav.profile(); });
  panel.classList.remove('hidden');
  root.appendChild(el);
  return () => el.remove();
}
