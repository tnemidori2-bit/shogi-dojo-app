import { T } from '../text.js';
import { state } from '../core/store.js';
import { sfx } from '../core/audio.js';

export function mountResult(root, nav, info) {
  const el = document.createElement('div');
  el.className = 'screen center result';
  el.innerHTML = `
    <div class="title">${T.resultTitle}</div>
    <div class="big-stars">${'★'.repeat(info.stars)}${'☆'.repeat(3 - info.stars)}</div>
    ${info.lines.map((l) => `<p>${l}</p>`).join('')}
    <p>${T.expGain(info.exp)}</p>
    ${info.levelUp ? `<p class="levelup">${T.levelUp(state.family.level)}</p>` : ''}
    ${info.kyuUp ? `<p class="levelup">${T.rankUp(info.kyu)}</p>` : `<p>${T.rank(info.kyu)}</p>`}
    <p>${T.turnCount(state.family.turns)}</p>
    <div class="actions wrap"><button class="btn" type="button" id="again">${T.again}</button>
    ${info.kind === 'tsume' ? `<button class="btn big" type="button" id="nextq">${T.nextProblem}</button><button class="btn" type="button" id="home">${T.toHome}</button>` : ''}
    <button class="btn ${info.kind === 'tsume' ? '' : 'big'}" type="button" id="next">${T.next}</button></div>`;
  el.querySelector('#again').addEventListener('click', () => {
    sfx('tap');
    if (info.kind === 'tsume') nav.tsume(info.setId, info.id); else (info.kind === 'drill' ? nav.drill : nav.lesson)(info.id);
  });
  el.querySelector('#nextq')?.addEventListener('click', () => { sfx('tap'); nav.tsume(info.setId, info.nextId); });
  el.querySelector('#home')?.addEventListener('click', () => { sfx('tap'); nav.home(); });
  el.querySelector('#next').addEventListener('click', () => { sfx('tap'); nav.profile(); });
  root.appendChild(el);
  return () => el.remove();
}
