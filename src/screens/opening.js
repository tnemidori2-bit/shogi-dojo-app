import { T } from '../text.js';
import { state } from '../core/store.js';
import { loadJson, loadPieces } from '../core/data.js';
import { initialBoard, defOf, SIZE } from '../shogi/rules.js';
import { legalMoves, applyFull, sameMove } from '../shogi/engine.js';
import { parseUsi, moveLabel } from '../shogi/usi.js';
import { sfx } from '../core/audio.js';
import { toast } from '../ui.js';

const same = (a, b) => a && b && a.x === b.x && a.y === b.y;

// mode: 'learn'（お手本を1手ずつ見る）か 'try'（お手本どおりに指す）
export async function mountOpening(root, nav, openingId, mode) {
  const el = document.createElement('div');
  el.className = 'screen lesson-screen opening-screen';
  root.appendChild(el);
  let op, pieces;
  try {
    [op, pieces] = await Promise.all([loadJson(`openings/${openingId}.json`), loadPieces()]);
  } catch (e) {
    console.warn(e); toast(T.loadFailed); nav.home();
    return () => el.remove();
  }
  const hard = state.person?.difficulty === 'hard';
  const line = op.moves.map((m) => ({ ...m, move: parseUsi(m.usi) }));
  const N = line.length;

  // 盤の状態の列：states[i] = i手指したあとの盤。labels[i] = i手目の名前
  const states = [{ board: initialBoard(), hands: [{}, {}] }];
  const labels = [];
  line.forEach((m, i) => {
    const side = i % 2;
    const cur = states[i];
    labels.push(moveLabel(m.move, cur.board, side, pieces, i > 0 ? line[i - 1].move.to : null));
    states.push(applyFull(cur.board, cur.hands, m.move, side));
  });

  let step = 0; // いま何手目まで指したか
  let msg = mode === 'learn' ? `${op.summary}。${T.learnStart}` : T.tryAsk;
  let sel = null, targets = [], pending = null, busy = false, done = false;
  let hint = null, hinted = false, misses = 0;

  el.innerHTML = `
    <div class="topbar"><button class="btn small" type="button" id="quit">${T.quit}</button><span>${op.title}　${mode === 'learn' ? T.learn : T.try_}</span><span id="count"></span></div>
    <div class="message" id="msg"></div>
    <div class="actions" id="actions"></div>
    <div class="board" id="board"></div>
    <p class="legend">${T.lastMoveLegend}</p>`;
  const boardEl = el.querySelector('#board');

  function draw() {
    el.querySelector('#msg').textContent = msg;
    el.querySelector('#count').textContent = T.stepOf(step, N);
    const { board } = states[step];
    const last = step > 0 ? line[step - 1].move : null;
    let html = '';
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
      const c = board[y][x];
      const at = { x, y };
      const cls = ['cell'];
      if (last && (same(at, last.to) || (last.from && same(at, last.from)))) cls.push('last');
      if (sel && same(sel, at)) cls.push('sel');
      if (mode === 'try' && !hard && !pending && targets.some((t) => same(t, at))) cls.push('target');
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
    if (mode === 'learn') {
      h = `<button class="btn" type="button" id="prev" ${step === 0 ? 'disabled' : ''}>${T.prevStep}</button>`
        + (step < N ? `<button class="btn big" type="button" id="next">${T.nextStep}</button>` : `<button class="btn big" type="button" id="finish">${T.learnDone}</button>`);
    } else if (done) h = `<button class="btn big" type="button" id="finish">${T.finish}</button>`;
    else if (pending) h = `<button class="btn big" type="button" id="yes">${T.doPromote}</button><button class="btn" type="button" id="no">${T.noPromote}</button>`;
    else if (!busy && !hard) h = `<button class="btn" type="button" id="hint">${T.hint}</button>`;
    act.innerHTML = h;
    act.querySelector('#prev')?.addEventListener('click', () => { sfx('tap'); goto(step - 1); });
    act.querySelector('#next')?.addEventListener('click', () => { sfx('move'); goto(step + 1); });
    act.querySelector('#finish')?.addEventListener('click', () => { sfx('tap'); nav.openingResult(openingId, mode, { misses, hinted }); });
    act.querySelector('#yes')?.addEventListener('click', () => choosePromote(true));
    act.querySelector('#no')?.addEventListener('click', () => choosePromote(false));
    act.querySelector('#hint')?.addEventListener('click', () => { hint = line[step].move; hinted = true; sfx('select'); msg = T.tryHintMsg; draw(); });
  }

  // まなぶ：手を進める／戻す
  function goto(n) {
    step = Math.max(0, Math.min(N, n));
    msg = step === 0 ? `${op.summary}。${T.learnStart}`
      : `${labels[step - 1]}　${line[step - 1].text}${step === N ? `　${op.finish}` : ''}`;
    draw();
  }

  // ためす：自分の手が、お手本と同じかを見る
  function play(move) {
    const expected = line[step].move;
    if (!sameMove(move, expected)) {
      misses++; sfx('no'); msg = T.tryWrongLegal; sel = null; targets = []; draw(); return;
    }
    sel = null; targets = []; hint = null;
    const label = labels[step];
    step++; sfx('move');
    if (step >= N) { done = true; msg = `${T.tryOk(label)}　${line[step - 1].text}　${T.tryClear}`; sfx('clear'); draw(); return; }
    msg = `${T.tryOk(label)}　${line[step - 1].text}`;
    busy = true; draw();
    setTimeout(() => {
      const theirs = labels[step];
      step++; busy = false; sfx('move');
      if (step >= N) { done = true; msg = `${T.tryTheirs(theirs)}　${T.tryClear}`; sfx('clear'); }
      else msg = `${T.tryTheirs(theirs)}。${T.tryNext(step + 1)}：${T.tryAsk}`;
      draw();
    }, 800);
  }

  function choosePromote(promote) {
    const m = pending.moves.find((x) => x.promote === promote);
    pending = null; play(m);
  }

  boardEl.addEventListener('click', (e) => {
    if (mode !== 'try') return;
    const b = e.target.closest('.cell');
    if (!b || done || busy || pending) return;
    const at = { x: Number(b.dataset.x), y: Number(b.dataset.y) };
    const { board, hands } = states[step];
    const c = board[at.y][at.x];
    const all = legalMoves(board, hands, 0, pieces);
    if (sel) {
      const cands = all.filter((m) => same(m.to, at) && m.from && same(m.from, sel));
      if (cands.length === 1) { play(cands[0]); return; }
      if (cands.length > 1) { pending = { to: at, moves: cands }; msg = T.askPromote; draw(); return; }
    }
    if (c && c.s === 0) {
      sel = at; targets = all.filter((m) => m.from && same(m.from, at)).map((m) => m.to);
      sfx('select'); msg = targets.length ? T.pickTarget : T.cantMove; draw(); return;
    }
    if (sel) { sfx('no'); msg = T.cantMove; sel = null; targets = []; draw(); }
  });
  el.querySelector('#quit').addEventListener('click', () => { sfx('tap'); nav.home(); });
  if (import.meta.env.DEV) window.__opening = () => ({ line, step, misses, labels });
  draw();
  return () => el.remove();
}
