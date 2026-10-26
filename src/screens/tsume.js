import { T } from '../text.js';
import { state } from '../core/store.js';
import { loadJson, loadPieces } from '../core/data.js';
import { parseBoard, defOf, SIZE } from '../shogi/rules.js';
import { legalMoves, applyFull, inCheck, validAttack, winningMoves, bestDefense, HAND_ORDER, sameMove } from '../shogi/engine.js';
import { sfx } from '../core/audio.js';
import { toast } from '../ui.js';

const same = (a, b) => a && b && a.x === b.x && a.y === b.y;
const toHands = (h) => [{ ...(h.sente || {}) }, { ...(h.gote || {}) }];

export const fmtTime = (ms) => {
  const s = Math.round(ms / 100) / 10;
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}` : `${s.toFixed(1)}びょう`;
};

export async function mountTsume(root, nav, setId, problemId) {
  const el = document.createElement('div');
  el.className = 'screen lesson-screen tsume-screen';
  root.appendChild(el);
  let set, pieces, problem;
  try {
    [set, pieces] = await Promise.all([loadJson(`tsume/${setId}.json`), loadPieces()]);
    problem = set.problems.find((p) => p.id === problemId) || set.problems[0];
  } catch (e) {
    console.warn(e); toast(T.loadFailed); nav.home();
    return () => el.remove();
  }
  const hard = state.person?.difficulty === 'hard';
  const total = (set.moves + 1) / 2; // 攻めの手の数
  let board = parseBoard(problem.board);
  let hands = toHands(problem.hands);
  let left = total; // 攻めの残りの手数
  let sel = null; // { from:{x,y} } か { drop:t }
  let targets = [];
  let pending = null; // 成る／成らない を聞いている手の候補
  let busy = false; // 相手が返事をしている間
  let done = false;
  let hinted = false, misses = 0;
  let hint = null;
  let msg = T.tsumeAsk;
  let tone = ''; // メッセージの見た目：'good'（途中の正解）／'solved'（詰み）
  let elapsed = 0, last = performance.now();
  let timerId = null;

  el.innerHTML = `
    <div class="topbar"><button class="btn small" type="button" id="quit">${T.quit}</button><span>${set.title}　${T.tsumeNo(problem.no)}</span><span id="time"></span></div>
    <div class="message" id="msg"></div>
    <div class="actions" id="actions"></div>
    <div class="hand opp" id="opp"></div>
    <div class="board" id="board"></div>
    <div class="hand mine" id="mine"></div>`;
  const boardEl = el.querySelector('#board');

  const tick = () => {
    const now = performance.now();
    if (!document.hidden && !done) elapsed += now - last;
    last = now;
    el.querySelector('#time').textContent = fmtTime(elapsed);
  };
  timerId = setInterval(tick, 250);
  tick();

  const handHtml = (side) => {
    const items = HAND_ORDER.filter((t) => hands[side][t]).map((t) => {
      const on = side === 0 && sel && sel.drop === t;
      const hintOn = side === 0 && hint && hint.drop === t;
      return `<button type="button" class="hp ${on ? 'on' : ''} ${hintOn ? 'hint' : ''}" data-drop="${t}" ${side === 1 ? 'disabled' : ''}><span class="k">${pieces[t].kanji}</span><span class="n">${hands[side][t] > 1 ? '×' + hands[side][t] : ''}</span></button>`;
    }).join('');
    return `<span class="hl">${side === 0 ? T.tsumeHand : T.tsumeOppHand}</span>${items || '<span class="none">なし</span>'}`;
  };

  function draw() {
    const msgEl = el.querySelector('#msg');
    msgEl.textContent = msg;
    msgEl.className = 'message' + (tone ? ' ' + tone : '');
    boardEl.classList.toggle('solved', tone === 'solved');
    el.querySelector('#opp').innerHTML = handHtml(1);
    el.querySelector('#mine').innerHTML = handHtml(0);
    let html = '';
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
      const c = board[y][x];
      const at = { x, y };
      const cls = ['cell'];
      if (sel && sel.from && same(sel.from, at)) cls.push('sel');
      if (!hard && !pending && targets.some((t) => same(t, at))) cls.push('target');
      if (pending && same(pending.to, at)) cls.push('target');
      if (hint && ((hint.from && same(hint.from, at)) || same(hint.to, at))) cls.push('hintcell');
      let p = '';
      if (c) {
        const d = defOf(c, pieces);
        const k = c.s === 1 && d.kanjiGote ? d.kanjiGote : d.kanji;
        p = `<span class="piece ${c.s === 1 ? 'gote' : 'sente'} ${c.p ? 'promoted' : ''}">${k}</span>`;
      }
      html += `<button type="button" class="${cls.join(' ')}" data-x="${x}" data-y="${y}" aria-label="${x + 1},${y + 1}">${p}</button>`;
    }
    boardEl.innerHTML = html;
    const act = el.querySelector('#actions');
    let h = '';
    if (done) h = `<button class="btn big" type="button" id="finish">${T.finish}</button>`;
    else if (pending) h = `<button class="btn big" type="button" id="yes">${T.doPromote}</button><button class="btn" type="button" id="no">${T.noPromote}</button>`;
    else if (!busy) {
      h = `<button class="btn" type="button" id="retry">${T.retry}</button>`;
      if (!hard) h += `<button class="btn" type="button" id="hint">${T.hint}</button>`;
    }
    act.innerHTML = h;
    act.querySelector('#finish')?.addEventListener('click', () => { sfx('tap'); finish(); });
    act.querySelector('#yes')?.addEventListener('click', () => choosePromote(true));
    act.querySelector('#no')?.addEventListener('click', () => choosePromote(false));
    act.querySelector('#retry')?.addEventListener('click', () => { sfx('tap'); reset(); });
    act.querySelector('#hint')?.addEventListener('click', () => showHint());
  }

  function reset() {
    board = parseBoard(problem.board); hands = toHands(problem.hands); left = total;
    sel = null; targets = []; pending = null; hint = null; msg = T.tsumeAsk; tone = ''; draw();
  }

  function showHint() {
    const win = winningMoves(board, hands, left, pieces);
    if (!win.length) return;
    hint = win[0]; hinted = true; sfx('select'); msg = T.tsumeHint; draw();
  }

  function finish() {
    clearInterval(timerId);
    nav.tsumeResult(setId, problem.id, { ms: Math.round(elapsed), hinted, misses });
  }

  // 攻めの手を指す。詰みに向かう手だけを盤に反映し、そうでなければ理由を言って戻す
  function play(move) {
    const r = applyFull(board, hands, move, 0);
    if (!inCheck(r.board, 1, pieces)) { misses++; sfx('no'); tone = ''; msg = T.tsumeNotCheck; sel = null; targets = []; draw(); return; }
    if (!validAttack(board, hands, move, left, pieces)) { misses++; sfx('no'); tone = ''; msg = T.tsumeNotMate; sel = null; targets = []; draw(); return; }
    board = r.board; hands = r.hands; sel = null; targets = []; hint = null; sfx('move');
    const replies = legalMoves(board, hands, 1, pieces);
    if (replies.length === 0) { done = true; tone = 'solved'; msg = T.tsumeSolved; sfx('clear'); clearInterval(timerId); tick(); draw(); return; }
    busy = true; tone = 'good'; msg = T.tsumeGood; sfx('ok'); draw();
    setTimeout(() => {
      const rep = bestDefense(board, hands, left - 1, pieces);
      const q = applyFull(board, hands, rep, 1);
      board = q.board; hands = q.hands; left--; busy = false; sfx('move');
      tone = 'good'; msg = T.tsumeEscaped; draw();
    }, 700);
  }

  function choosePromote(promote) {
    const m = pending.moves.find((x) => x.promote === promote);
    pending = null; play(m);
  }

  function selectFrom(at) {
    sel = { from: at };
    targets = legalMoves(board, hands, 0, pieces).filter((m) => m.from && same(m.from, at)).map((m) => m.to);
    sfx('select');
    msg = targets.length ? T.pickTarget : `${T.cantMove}`;
    draw();
  }

  boardEl.addEventListener('click', (e) => {
    const b = e.target.closest('.cell');
    if (!b || done || busy || pending) return;
    const at = { x: Number(b.dataset.x), y: Number(b.dataset.y) };
    const c = board[at.y][at.x];
    const all = legalMoves(board, hands, 0, pieces);
    // 行き先をタップ
    if (sel) {
      const cands = all.filter((m) => same(m.to, at) && (sel.drop ? m.drop === sel.drop : m.from && same(m.from, sel.from)));
      if (cands.length === 1) { play(cands[0]); return; }
      if (cands.length > 1) { pending = { to: at, moves: cands }; msg = T.askPromote; draw(); return; }
    }
    if (c && c.s === 0) { selectFrom(at); return; }
    if (sel) { sfx('no'); msg = T.cantMove; sel = null; targets = []; draw(); }
  });

  el.addEventListener('click', (e) => {
    const hp = e.target.closest('.hp');
    if (!hp || hp.disabled || done || busy || pending) return;
    const t = hp.dataset.drop;
    sel = { drop: t };
    targets = legalMoves(board, hands, 0, pieces).filter((m) => m.drop === t).map((m) => m.to);
    sfx('select'); msg = T.tsumePickDrop; draw();
  });

  el.querySelector('#quit').addEventListener('click', () => { clearInterval(timerId); sfx('tap'); nav.home(); });
  if (import.meta.env.DEV) window.__tsume = () => ({ problem, board, hands, left });
  draw();
  return () => { clearInterval(timerId); el.remove(); };
}
