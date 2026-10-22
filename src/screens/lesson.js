import { T } from '../text.js';
import { state } from '../core/store.js';
import { loadJson, loadPieces } from '../core/data.js';
import { initialBoard, movesFor, applyMove, SIZE } from '../shogi/rules.js';
import { sfx } from '../core/audio.js';
import { toast } from '../ui.js';

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
  let board = initialBoard();
  let sel = null; // {x,y}
  let targets = [];
  let moves = 0;
  let done = false;
  let msg = lesson.intro;

  el.innerHTML = `
    <div class="topbar"><button class="btn small" type="button" id="quit">${T.quit}</button><span id="count"></span></div>
    <div class="message" id="msg"></div>
    <div class="board" id="board"></div>
    <div class="actions" id="actions"></div>`;
  const boardEl = el.querySelector('#board');

  function draw() {
    el.querySelector('#msg').textContent = msg;
    el.querySelector('#count').textContent = T.moveCount(moves, lesson.goalMoves);
    let html = '';
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
      const c = board[y][x];
      const isSel = sel && sel.x === x && sel.y === y;
      const isT = !hard && targets.some((t) => t.x === x && t.y === y);
      let p = '';
      if (c) {
        const d = pieces[c.t];
        const k = c.s === 1 && d.kanjiGote ? d.kanjiGote : d.kanji;
        p = `<span class="piece ${c.s === 1 ? 'gote' : 'sente'} ${lesson.allow.includes(c.t) ? '' : 'dim'}">${k}</span>`;
      }
      html += `<button type="button" class="cell ${isSel ? 'sel' : ''} ${isT ? 'target' : ''}" data-x="${x}" data-y="${y}" aria-label="${x + 1},${y + 1}">${p}</button>`;
    }
    boardEl.innerHTML = html;
    const act = el.querySelector('#actions');
    act.innerHTML = done ? `<button class="btn big" type="button" id="finish">${T.next}</button>` : '';
    act.querySelector('#finish')?.addEventListener('click', () => { sfx('tap'); nav.result(lessonId, moves); });
  }

  boardEl.addEventListener('click', (e) => {
    const b = e.target.closest('.cell');
    if (!b || done) return;
    const x = Number(b.dataset.x), y = Number(b.dataset.y);
    const c = board[y][x];
    if (sel && targets.some((t) => t.x === x && t.y === y)) {
      board = applyMove(board, sel, { x, y });
      sel = null; targets = []; moves++; sfx('move');
      if (moves >= lesson.goalMoves) { done = true; msg = lesson.clear; sfx('clear'); }
      else msg = `${T.moveCount(moves, lesson.goalMoves)}。${T.tapOwnPiece}`;
      draw(); return;
    }
    if (c && c.s === 0) {
      if (!lesson.allow.includes(c.t)) { sfx('no'); msg = T.notNow(`${pieces[lesson.pieceId].yomi}（${pieces[lesson.pieceId].kanji}）`); sel = null; targets = []; draw(); return; }
      sel = { x, y }; targets = movesFor(board, x, y, pieces); sfx('select');
      const d = pieces[c.t];
      msg = targets.length ? `${d.yomi}（${d.kanji}）：${d.desc}。${T.pickTarget}` : `${d.yomi}（${d.kanji}）は いま うごけないよ`;
      draw(); return;
    }
    if (sel) { sfx('no'); msg = T.cantMove; sel = null; targets = []; draw(); }
  });
  el.querySelector('#quit').addEventListener('click', () => { sfx('tap'); nav.home(); });
  draw();
  return () => el.remove();
}
