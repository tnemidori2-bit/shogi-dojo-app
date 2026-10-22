import { T } from '../text.js';
import { state } from '../core/store.js';
import { loadJson, loadPieces } from '../core/data.js';
import { initialBoard, parseBoard, movesFor, applyMove, canPromote, mustPromote, defOf, SIZE } from '../shogi/rules.js';
import { sfx } from '../core/audio.js';
import { toast } from '../ui.js';

const goalLabel = { moves: T.moveCount, capture: T.captureCount, promote: T.promoteCount };

export async function mountLesson(root, nav, lessonId) {
  const el = document.createElement('div');
  el.className = 'screen lesson-screen';
  root.appendChild(el);
  let lesson, pieces;
  try {
    [lesson, pieces] = await Promise.all([loadJson(`lessons/${lessonId}.json`), loadPieces()]);
  } catch (e) {
    console.warn(e); toast(T.loadFailed); nav.home();
    return () => el.remove();
  }
  const hard = state.person?.difficulty === 'hard';
  const goal = lesson.goal;
  let board = lesson.board ? parseBoard(lesson.board) : initialBoard();
  let sel = null; // {x,y}
  let targets = [];
  let pending = null; // 成るか聞いている {from,to}
  let progress = 0;
  let done = false;
  let msg = lesson.intro;

  el.innerHTML = `
    <div class="topbar"><button class="btn small" type="button" id="quit">${T.quit}</button><span id="count"></span></div>
    <div class="message" id="msg"></div>
    <div class="actions" id="actions"></div>
    <div class="board" id="board"></div>`;
  const boardEl = el.querySelector('#board');

  function draw() {
    el.querySelector('#msg').textContent = msg;
    el.querySelector('#count').textContent = goalLabel[goal.type](progress, goal.n);
    let html = '';
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
      const c = board[y][x];
      const isSel = sel && sel.x === x && sel.y === y;
      const isT = pending ? (pending.to.x === x && pending.to.y === y) : !hard && targets.some((t) => t.x === x && t.y === y);
      let p = '';
      if (c) {
        const d = defOf(c, pieces);
        const k = c.s === 1 && d.kanjiGote ? d.kanjiGote : d.kanji;
        p = `<span class="piece ${c.s === 1 ? 'gote' : 'sente'} ${c.p ? 'promoted' : ''} ${lesson.allow.includes(c.t) ? '' : 'dim'}">${k}</span>`;
      }
      html += `<button type="button" class="cell ${isSel ? 'sel' : ''} ${isT ? 'target' : ''}" data-x="${x}" data-y="${y}" aria-label="${x + 1},${y + 1}">${p}</button>`;
    }
    boardEl.innerHTML = html;
    const act = el.querySelector('#actions');
    if (done) act.innerHTML = `<button class="btn big" type="button" id="finish">${T.next}</button>`;
    else if (pending) act.innerHTML = `<button class="btn big" type="button" id="yes">${T.doPromote}</button><button class="btn" type="button" id="no">${T.noPromote}</button>`;
    else act.innerHTML = '';
    act.querySelector('#finish')?.addEventListener('click', () => { sfx('tap'); nav.result(lessonId); });
    act.querySelector('#yes')?.addEventListener('click', () => finishMove(true));
    act.querySelector('#no')?.addEventListener('click', () => finishMove(false));
  }

  function finishMove(promote) {
    const { from, to } = pending || {};
    if (!from) return;
    const captured = !!board[to.y][to.x];
    const piece = board[from.y][from.x];
    board = applyMove(board, from, to, promote);
    pending = null; sel = null; targets = [];
    sfx('move');
    if (goal.type === 'moves') progress++;
    else if (goal.type === 'capture' && captured) progress++;
    else if (goal.type === 'promote' && promote) progress++;
    if (progress >= goal.n) { done = true; msg = lesson.clear; sfx('clear'); }
    else if (promote) { msg = `${T.promoted(pieces[piece.t].promote.yomi + '（' + pieces[piece.t].promote.kanji + '）')} ${T.tapOwnPiece}`; sfx('ok'); }
    else if (captured) msg = T.captured(progress, goal.n);
    else msg = `${goalLabel[goal.type](progress, goal.n)}。${T.tapOwnPiece}`;
    draw();
  }

  boardEl.addEventListener('click', (e) => {
    const b = e.target.closest('.cell');
    if (!b || done || pending) return;
    const x = Number(b.dataset.x), y = Number(b.dataset.y);
    const c = board[y][x];
    if (sel && targets.some((t) => t.x === x && t.y === y)) {
      const to = { x, y };
      pending = { from: sel, to };
      if (lesson.promote && canPromote(board, sel, to, pieces)) {
        if (mustPromote(board, sel, to)) { finishMove(true); return; }
        msg = T.askPromote;
        draw(); return;
      }
      finishMove(false); return;
    }
    if (c && c.s === 0) {
      if (!lesson.allow.includes(c.t)) {
        const d = pieces[lesson.pieceId];
        sfx('no'); msg = T.notNow(`${d.yomi}（${d.kanji}）`); sel = null; targets = []; draw(); return;
      }
      sel = { x, y }; targets = movesFor(board, x, y, pieces); sfx('select');
      const d = defOf(c, pieces);
      msg = targets.length ? `${d.yomi}（${d.kanji}）：${d.desc}。${T.pickTarget}` : `${d.yomi}（${d.kanji}）は いま うごけないよ`;
      draw(); return;
    }
    if (sel) { sfx('no'); msg = T.cantMove; sel = null; targets = []; draw(); }
  });
  el.querySelector('#quit').addEventListener('click', () => { sfx('tap'); nav.home(); });
  draw();
  return () => el.remove();
}
