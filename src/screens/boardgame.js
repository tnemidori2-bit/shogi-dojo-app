import { T } from '../text.js';
import { sfx } from '../core/audio.js';
import { createBoard } from '../games/board.js';
import * as othello from '../games/othello.js';
import * as gomoku from '../games/gomoku.js';

const RULES = { othello, gomoku };
const CPU_WAIT = 500;   // CPUが打つまでの待ち（ミリ秒）
const PASS_WAIT = 1000; // 「パスです」を出している時間

// オセロ・五目並べの対局画面。cfg = { game: 'othello' | 'gomoku', vs: 'two' | 'cpu' }。CPUは白
export function mountBoardGame(root, nav, cfg) {
  const rules = RULES[cfg.game];
  const g = T.games;
  const el = document.createElement('div');
  el.className = 'screen boardgame';
  el.innerHTML = `
    <div class="topbar"><button class="btn small" type="button" data-act="back">${T.back}</button><span>${g[cfg.game]}・${cfg.vs === 'cpu' ? g.cpu : g.two}</span><span></span></div>
    <div class="ginfo"><span class="turn"></span><span class="count"></span></div>
    <div class="gmsg"></div>
    <div class="gwrap"></div>
    <div class="actions"><button class="btn" type="button" data-act="reset">${g.reset}</button></div>`;
  const $ = (s) => el.querySelector(s);
  const board = createBoard(rules.SIZE, cfg.game, (r, c) => tap(r, c));
  $('.gwrap').appendChild(board.el);

  let s, timer = null, dead = false;
  const cpuTurn = () => cfg.vs === 'cpu' && s.turn === 2 && !s.result;

  function draw() {
    board.render({ stones: s.b, hints: cpuTurn() ? new Set() : rules.hints(s), last: s.last, over: !!s.result || cpuTurn() });
    $('.turn').textContent = s.result ? '' : g.turn(s.turn === 1 ? g.black : g.white);
    if (cfg.game === 'othello') { const n = othello.count(s.b); $('.count').textContent = g.stones(n.black, n.white); }
    else $('.count').textContent = g.movesCount(s.moves);
    const msg = $('.gmsg');
    if (s.result) {
      msg.className = 'gmsg result';
      msg.innerHTML = `<div class="big-result">${s.result === 'draw' ? g.draw : g.win(s.result === 'black' ? g.black : g.white)}</div>
        <div class="actions"><button class="btn big" type="button" data-act="reset">${g.again}</button><button class="btn" type="button" data-act="back">${T.back}</button></div>`;
    } else if (s.passed) {
      msg.className = 'gmsg pass'; msg.textContent = g.pass(s.passed === 1 ? g.black : g.white);
    } else { msg.className = 'gmsg'; msg.textContent = ''; }
  }

  // 打ったあとの進行：パスの表示、CPUの番、終局
  function after() {
    draw();
    clearTimeout(timer);
    if (s.result) { sfx('tap'); return; }
    const wait = s.passed ? PASS_WAIT : 0;
    const go = () => {
      if (dead) return;
      if (s.passed) { s = { ...s, passed: null }; draw(); }
      if (cpuTurn()) timer = setTimeout(cpuMove, s.passed ? 0 : CPU_WAIT);
    };
    if (wait) timer = setTimeout(go, wait); else go();
  }

  function cpuMove() {
    if (dead || !cpuTurn()) return;
    const m = rules.cpuMove(s);
    if (!m) return;
    s = rules.play(s, m[0], m[1]);
    sfx('tap');
    after();
  }

  function tap(r, c) {
    if (s.result || cpuTurn() || s.passed) return;
    const n = rules.play(s, r, c);
    if (!n) return; // 置けない場所は何も起きない
    s = n;
    sfx('tap');
    after();
  }

  function reset() { clearTimeout(timer); s = rules.newState(); draw(); }
  el.addEventListener('click', (ev) => {
    const b = ev.target.closest('button[data-act]');
    if (!b) return;
    if (b.dataset.act === 'back') nav.games();
    else if (b.dataset.act === 'reset') reset();
  });

  reset();
  root.appendChild(el);
  return () => { dead = true; clearTimeout(timer); el.remove(); };
}
