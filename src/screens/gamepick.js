import { T } from '../text.js';
import { unlock, sfx } from '../core/audio.js';

// 起動したときに出る「ゲームを選ぶ」画面
export function mountGamePick(root, nav) {
  const el = document.createElement('div');
  el.className = 'screen center gamepick';
  const g = T.games;
  el.innerHTML = `
    <div class="title">${g.pick}</div>
    <div class="pick-list">
      <button class="pick" type="button" data-game="shogi"><span class="emoji">☗</span>${g.shogi}</button>
      <button class="pick" type="button" data-game="othello"><span class="emoji">⚫</span>${g.othello}</button>
      <button class="pick" type="button" data-game="gomoku"><span class="emoji">⚪</span>${g.gomoku}</button>
    </div>
    <div class="pick-vs hidden">
      <div class="opt-title"></div>
      <div class="pick-list">
        <button class="pick" type="button" data-vs="two">${g.two}</button>
        <button class="pick" type="button" data-vs="cpu">${g.cpu}</button>
      </div>
      <button class="btn small" type="button" data-act="cancel">${T.back}</button>
    </div>`;
  const list = el.querySelector('.pick-list');
  const vs = el.querySelector('.pick-vs');
  let game = null;
  el.addEventListener('click', (ev) => {
    const b = ev.target.closest('button');
    if (!b) return;
    unlock(); sfx('tap');
    if (b.dataset.game === 'shogi') return nav.start();
    if (b.dataset.game) {
      game = b.dataset.game;
      vs.querySelector('.opt-title').textContent = g[game];
      list.classList.add('hidden'); vs.classList.remove('hidden');
    } else if (b.dataset.vs) nav.boardgame({ game, vs: b.dataset.vs });
    else if (b.dataset.act === 'cancel') { vs.classList.add('hidden'); list.classList.remove('hidden'); }
  });
  root.appendChild(el);
  return () => el.remove();
}
