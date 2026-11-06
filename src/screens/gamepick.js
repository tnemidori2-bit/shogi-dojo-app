import { T } from '../text.js';
import { unlock, sfx } from '../core/audio.js';
import { LEVEL_COUNT, clearedLevel, unlockedLevel } from '../games/levels.js';

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
      <button class="pick" type="button" data-game="go"><span class="emoji">◎</span>${g.go}</button>
    </div>
    <div class="pick-vs hidden">
      <div class="opt-title"></div>
      <div class="pick-list">
        <button class="pick" type="button" data-vs="two">${g.two}</button>
        <button class="pick" type="button" data-vs="cpu">${g.cpu}</button>
        <button class="pick hidden" type="button" data-vs="lesson">${g.lesson}</button>
      </div>
      <button class="btn small" type="button" data-act="cancel">${T.back}</button>
    </div>
    <div class="pick-level hidden">
      <div class="opt-title">${g.levelPick}</div>
      <div class="pick-list levels"></div>
      <button class="btn small" type="button" data-act="levels-back">${T.back}</button>
    </div>`;
  const list = el.querySelector('.pick-list');
  const vs = el.querySelector('.pick-vs');
  const lv = el.querySelector('.pick-level');
  let game = null;
  function showLevels() {
    const open = unlockedLevel(game), cleared = clearedLevel(game);
    lv.querySelector('.levels').innerHTML = Array.from({ length: LEVEL_COUNT }, (_, i) => {
      const n = i + 1, locked = n > open;
      return `<button class="pick level${locked ? ' locked' : ''}" type="button" data-level="${n}" ${locked ? 'disabled' : ''}>${g.levelLabel(n, g.levelNames[i])}<span class="stars">${n <= cleared ? '★' : locked ? '🔒' : ''}</span></button>`;
    }).join('');
    vs.classList.add('hidden'); lv.classList.remove('hidden');
  }
  el.addEventListener('click', (ev) => {
    const b = ev.target.closest('button');
    if (!b) return;
    unlock(); sfx('tap');
    if (b.dataset.game === 'shogi') return nav.start();
    if (b.dataset.game) {
      game = b.dataset.game;
      vs.querySelector('.opt-title').textContent = g[game];
      vs.querySelector('[data-vs=lesson]').classList.toggle('hidden', game !== 'go');
      list.classList.add('hidden'); vs.classList.remove('hidden');
    } else if (b.dataset.vs === 'lesson') nav.golesson();
    else if (b.dataset.vs === 'cpu') showLevels();
    else if (b.dataset.vs) nav.boardgame({ game, vs: b.dataset.vs });
    else if (b.dataset.level) nav.boardgame({ game, vs: 'cpu', level: Number(b.dataset.level) });
    else if (b.dataset.act === 'levels-back') { lv.classList.add('hidden'); vs.classList.remove('hidden'); }
    else if (b.dataset.act === 'cancel') { vs.classList.add('hidden'); list.classList.remove('hidden'); }
  });
  root.appendChild(el);
  return () => el.remove();
}
