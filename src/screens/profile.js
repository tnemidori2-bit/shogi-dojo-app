import { T } from '../text.js';
import { state, animalOf } from '../core/store.js';
import { sfx } from '../core/audio.js';

export const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function lastText(p) {
  if (!p.lastPlayed) return T.never;
  const d0 = new Date(p.lastPlayed), now = new Date();
  const a = new Date(d0.getFullYear(), d0.getMonth(), d0.getDate());
  const b = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const n = Math.round((b - a) / 86400000);
  return n <= 0 ? T.today : T.daysAgo(n);
}

export function mountProfile(root, nav) {
  const el = document.createElement('div');
  el.className = 'screen profile';
  const cards = state.profiles.map((p) => {
    const a = animalOf(p.icon);
    return `<button class="card" type="button" data-id="${p.id}">
      <span class="emoji">${a.emoji}</span>
      <span class="pname">${escapeHtml(p.name || a.label)}</span>
      <span class="last">${T.lastPlayed} ${lastText(p)}</span>
    </button>`;
  }).join('');
  el.innerHTML = `
    <div class="title">${state.profiles.length ? T.whoPlays : T.noProfile}</div>
    <div class="cards">${cards}</div>
    <button class="adult-btn" type="button"><span class="ring"></span>${T.adult}<small>${T.adultHold}</small></button>`;
  el.querySelectorAll('.card').forEach((c) => c.addEventListener('click', () => { sfx('ok'); nav.play(c.dataset.id); }));

  // おとな：2秒長押し
  const ab = el.querySelector('.adult-btn');
  let timer = null;
  const cancel = () => { clearTimeout(timer); timer = null; ab.classList.remove('holding'); };
  ab.addEventListener('pointerdown', () => { ab.classList.add('holding'); timer = setTimeout(() => { cancel(); nav.adult(); }, 2000); });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((e) => ab.addEventListener(e, cancel));
  ab.addEventListener('contextmenu', (e) => e.preventDefault());

  root.appendChild(el);
  return () => { cancel(); el.remove(); };
}
