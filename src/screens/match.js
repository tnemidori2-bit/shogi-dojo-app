import { T } from '../text.js';
import { state } from '../core/store.js';
import { loadPieces, loadBook } from '../core/data.js';
import { defOf, SIZE } from '../shogi/rules.js';
import { legalMoves, HAND_ORDER } from '../shogi/engine.js';
import { startGame, playMove, undoMoves, resign } from '../shogi/game.js';
import { moveLabel, toUsi } from '../shogi/usi.js';
import { sfx } from '../core/audio.js';
import { toast } from '../ui.js';

const same = (a, b) => a && b && a.x === b.x && a.y === b.y;
const VALUE = { fu: 100, kyo: 300, kei: 350, gin: 500, kin: 600, kaku: 900, hi: 1100 };

// cfg = { level:'weak'|'normal'|'strong', handicap:'none'|..., me:0|1 }（me：自分が先手(0)か後手(1)か）
export async function mountMatch(root, nav, cfg) {
  const el = document.createElement('div');
  el.className = 'screen lesson-screen tsume-screen match-screen';
  root.appendChild(el);
  let pieces;
  try { pieces = await loadPieces(); } catch (e) { console.warn(e); toast(T.loadFailed); nav.home(); return () => el.remove(); }
  let book = [];
  try { book = await loadBook(); } catch (e) { console.warn(e); } // 定跡が読めなくても、対局はできる
  const hard = state.person?.difficulty === 'hard';
  const me = cfg.me;
  let game = startGame(cfg.handicap, pieces);
  let mode = 'play'; // 'play' | 'review' | 'view'
  let sel = null, targets = [], pending = null, busy = false, hint = null, resignArmed = false;
  let undos = 0, hinted = false;
  let msg = '';
  let info = null; // 終局後の記録（lines など）
  let reviewItems = null, viewItem = null, reviewing = false;

  // 考える係（別スレッド）。画面は止まらない
  const worker = new Worker(new URL('../shogi/ai.worker.js', import.meta.url), { type: 'module' });
  let reqId = 0;
  const pendingReq = new Map();
  worker.onmessage = (e) => {
    const { id, type } = e.data;
    if (type === 'progress') { msg = `${T.reviewing} ${e.data.done}/${e.data.total}`; paintMsg(); return; }
    const cb = pendingReq.get(id);
    if (cb) { pendingReq.delete(id); cb(e.data); }
  };
  const ask = (payload) => new Promise((resolve) => { const id = ++reqId; pendingReq.set(id, resolve); worker.postMessage({ id, pieces, ...payload }); });
  const slim = (g) => ({ board: g.board, hands: g.hands, turn: g.turn, handicap: g.handicap, usiHistory: g.history.map((h) => toUsi(h.move)) });

  el.innerHTML = `
    <div class="topbar"><button class="btn small" type="button" id="quit">${T.quit}</button><span id="title"></span><span id="count"></span></div>
    <div class="message" id="msg"></div>
    <div class="actions wrap" id="actions"></div>
    <div class="hand opp" id="opp"></div>
    <div class="board" id="board"></div>
    <div class="hand mine" id="mine"></div>`;
  const boardEl = el.querySelector('#board');
  const paintMsg = () => { el.querySelector('#msg').textContent = msg; };

  const flip = (x, y) => (me === 1 ? { x: SIZE - 1 - x, y: SIZE - 1 - y } : { x, y });
  const labelOf = (i) => moveLabel(game.history[i].move, game.history[i].before.board, game.history[i].side, pieces, i > 0 ? game.history[i - 1].move.to : null);
  const pieceName = (c) => (c.p ? pieces[c.t].promote.kanji : pieces[c.t].kanji);

  const handHtml = (side) => {
    const hands = viewItem ? viewItem.before.hands : game.hands;
    const items = HAND_ORDER.filter((t) => hands[side][t]).map((t) => {
      const on = side === me && sel && sel.drop === t;
      const hintOn = side === me && hint && hint.drop === t;
      return `<button type="button" class="hp ${on ? 'on' : ''} ${hintOn ? 'hint' : ''}" data-drop="${t}" ${side !== me || mode !== 'play' ? 'disabled' : ''}><span class="k">${pieces[t].kanji}</span><span class="n">${hands[side][t] > 1 ? '×' + hands[side][t] : ''}</span></button>`;
    }).join('');
    return `<span class="hl">${side === me ? T.tsumeHand : T.tsumeOppHand}</span>${items || '<span class="none">なし</span>'}`;
  };

  function draw() {
    paintMsg();
    el.querySelector('#title').textContent = `${T.levelLabel[cfg.level]}${cfg.handicap !== 'none' ? '・' + handicapName() : ''}`;
    el.querySelector('#count').textContent = `${game.history.length}手`;
    el.querySelector('#opp').innerHTML = handHtml(1 - me);
    el.querySelector('#mine').innerHTML = handHtml(me);
    const shown = viewItem ? viewItem.before : game;
    const last = viewItem ? viewItem.move : (game.history.length ? game.history[game.history.length - 1].move : null);
    let html = '';
    for (let dy = 0; dy < SIZE; dy++) for (let dx = 0; dx < SIZE; dx++) {
      const { x, y } = flip(dx, dy);
      const c = shown.board[y][x];
      const at = { x, y };
      const cls = ['cell'];
      if (last && (same(at, last.to) || (last.from && same(at, last.from)))) cls.push('last');
      if (sel && sel.from && same(sel.from, at)) cls.push('sel');
      if (mode === 'play' && !hard && !pending && targets.some((t) => same(t, at))) cls.push('target');
      if (pending && same(pending.to, at)) cls.push('target');
      const h = viewItem ? viewItem.bestMove : hint;
      if (h && ((h.from && same(h.from, at)) || same(h.to, at))) cls.push('hintcell');
      let p = '';
      if (c) {
        const d = defOf(c, pieces);
        const k = c.s === 1 && d.kanjiGote ? d.kanjiGote : d.kanji;
        p = `<span class="piece ${c.s === me ? 'sente' : 'gote'} ${c.p ? 'promoted' : ''}">${k}</span>`;
      }
      html += `<button type="button" class="${cls.join(' ')}" data-x="${x}" data-y="${y}" aria-label="${x + 1},${y + 1}">${p}</button>`;
    }
    boardEl.innerHTML = html;
    drawActions();
  }

  function handicapName() { return { kyo: '香落ち', kaku: '角落ち', hi: '飛車落ち', two: '二枚落ち' }[cfg.handicap] || ''; }

  function drawActions() {
    const act = el.querySelector('#actions');
    let h = '';
    if (mode === 'view') h = `<button class="btn big" type="button" id="rvback">${T.reviewBack}</button>`;
    else if (mode === 'review') {
      h = (reviewItems || []).map((it) => `<button class="btn" type="button" data-rv="${it.index}">${T.reviewItem(it.index + 1, it.label)}${it.loss >= 300 ? ' ✖' : ' ？'}</button>`).join('')
        + `<button class="btn big" type="button" id="rvclose">${T.reviewClose}</button>`;
    } else if (game.result) {
      h = `${game.history.length && !reviewing ? `<button class="btn" type="button" id="review">${T.review}</button>` : ''}`
        + `<button class="btn big" type="button" id="again">${T.matchAgain}</button><button class="btn" type="button" id="home">${T.toHome}</button><button class="btn" type="button" id="next">${T.next}</button>`;
    } else if (pending) h = `<button class="btn big" type="button" id="yes">${T.doPromote}</button><button class="btn" type="button" id="no">${T.noPromote}</button>`;
    else if (!busy) {
      if (!hard) h += `<button class="btn" type="button" id="hint">${T.hint}</button><button class="btn" type="button" id="undo" ${game.history.length < 2 ? 'disabled' : ''}>${T.undo}</button>`;
      h += `<button class="btn danger" type="button" id="resign">${resignArmed ? T.resignConfirm : T.resignBtn}</button>`;
    }
    act.innerHTML = h;
    const on = (id, fn) => act.querySelector(id)?.addEventListener('click', fn);
    on('#hint', requestHint); on('#undo', doUndo); on('#resign', doResign);
    on('#yes', () => choosePromote(true)); on('#no', () => choosePromote(false));
    on('#review', openReview); on('#rvclose', () => { mode = 'play'; viewItem = null; msg = endMessage(); draw(); });
    on('#rvback', () => { mode = 'review'; viewItem = null; msg = T.reviewIntro; draw(); });
    on('#again', () => { sfx('tap'); nav.match(cfg); });
    on('#home', () => { sfx('tap'); nav.home(); });
    on('#next', () => { sfx('tap'); nav.profile(); });
    act.querySelectorAll('[data-rv]').forEach((b) => b.addEventListener('click', () => viewReview(Number(b.dataset.rv))));
  }

  function endMessage() {
    const r = game.result;
    let t;
    if (r.type === 'repetition') t = T.resultDraw;
    else if (r.type === 'moves') t = T.resultDrawMoves;
    else if (r.type === 'resign') t = r.winner === me ? T.resultResignAi : T.resultResignMe;
    else t = r.winner === me ? T.resultWin : T.resultLoss;
    return [t, ...(info ? info.lines : [])].join('　');
  }

  async function finishGame() {
    sfx(game.result.winner === me ? 'clear' : game.result.winner === undefined ? 'ok' : 'no');
    const outcome = game.result.winner === undefined ? 'draw' : game.result.winner === me ? 'win' : 'loss';
    info = await nav.matchRecord({ level: cfg.level, handicap: cfg.handicap, me, outcome, plies: game.history.length, undos, hinted });
    msg = endMessage(); busy = false; draw();
  }

  // ---- AI の手番 ----
  async function aiTurn() {
    if (game.result || game.turn === me) return;
    busy = true; hint = null; msg = T.aiThinking; draw();
    const t0 = Date.now();
    const res = await ask({ type: 'move', level: cfg.level, game: slim(game), book });
    if (res.type === 'error' || !res.move) { toast(T.loadFailed); busy = false; draw(); return; }
    // 考えた時間が短すぎると、指した手が分かりにくいので、少し間をおく
    const wait = Math.max(0, 450 - (Date.now() - t0));
    await new Promise((r) => setTimeout(r, wait));
    if (!el.isConnected) return;
    game = playMove(game, res.move);
    sfx('move');
    const label = labelOf(game.history.length - 1);
    if (game.result) { msg = `${T.aiMoved(label)}`; busy = true; draw(); finishGame(); return; }
    busy = false;
    msg = `${T.aiMoved(label)}。${game.check ? T.inCheckMe : T.yourTurn}`;
    draw();
  }

  function myMove(move) {
    sel = null; targets = []; hint = null; resignArmed = false;
    game = playMove(game, move);
    sfx('move');
    if (game.result) { msg = ''; busy = true; draw(); finishGame(); return; }
    msg = game.check ? T.inCheckAi : '';
    draw();
    aiTurn();
  }

  function choosePromote(promote) {
    const m = pending.moves.find((x) => x.promote === promote);
    pending = null; myMove(m);
  }

  async function requestHint() {
    hinted = true; sfx('select'); busy = true; msg = T.hintThinking; draw();
    const res = await ask({ type: 'hint', game: slim(game) });
    busy = false;
    if (res.move) { hint = res.move; msg = T.hintShown; } else msg = T.yourTurn;
    draw();
  }

  function doUndo() {
    const n = game.turn === me ? 2 : 1;
    if (game.history.length < n) return;
    game = undoMoves(game, n); undos++; sel = null; targets = []; hint = null; resignArmed = false;
    sfx('tap'); msg = `${T.yourTurn}（${T.undo}）`; draw();
  }

  function doResign() {
    if (!resignArmed) { resignArmed = true; sfx('select'); drawActions(); return; }
    game = resign(game, me); busy = true; msg = ''; draw(); finishGame();
  }

  // ---- 盤のタップ ----
  boardEl.addEventListener('click', (e) => {
    const b = e.target.closest('.cell');
    if (!b || mode !== 'play' || game.result || busy || pending || game.turn !== me) return;
    const at = { x: Number(b.dataset.x), y: Number(b.dataset.y) };
    const c = game.board[at.y][at.x];
    const all = legalMoves(game.board, game.hands, me, pieces);
    if (sel) {
      const cands = all.filter((m) => same(m.to, at) && (sel.drop ? m.drop === sel.drop : m.from && same(m.from, sel.from)));
      if (cands.length === 1) { myMove(cands[0]); return; }
      if (cands.length > 1) { pending = { to: at, moves: cands }; msg = T.askPromote; draw(); return; }
    }
    if (c && c.s === me) {
      sel = { from: at }; targets = all.filter((m) => m.from && same(m.from, at)).map((m) => m.to);
      sfx('select'); msg = targets.length ? T.pickTarget : (game.check ? T.inCheckMe : T.noMovesNote); draw(); return;
    }
    if (sel) { sfx('no'); msg = T.cantMove; sel = null; targets = []; draw(); }
  });
  el.addEventListener('click', (e) => {
    const hp = e.target.closest('.hp');
    if (!hp || hp.disabled || mode !== 'play' || game.result || busy || pending || game.turn !== me) return;
    const t = hp.dataset.drop;
    sel = { drop: t };
    targets = legalMoves(game.board, game.hands, me, pieces).filter((m) => m.drop === t).map((m) => m.to);
    sfx('select'); msg = targets.length ? T.tsumePickDrop : T.cantMove; draw();
  });

  // ---- ふりかえり ----
  async function openReview() {
    sfx('tap'); reviewing = true; busy = true; msg = T.reviewing; draw();
    const entries = game.history.map((h, i) => ({ index: i, board: h.before.board, hands: h.before.hands, side: h.side, move: h.move })).filter((h) => h.side === me).slice(0, 60);
    const res = await ask({ type: 'review', entries });
    busy = false;
    const bad = (res.out || []).filter((r) => r.loss >= 150).sort((a, b) => b.loss - a.loss).slice(0, 5).sort((a, b) => a.index - b.index);
    reviewItems = bad.map((r) => ({ ...r, label: labelOf(r.index) }));
    mode = 'review';
    msg = reviewItems.length ? T.reviewIntro : T.reviewNone;
    draw();
  }

  function viewReview(index) {
    const it = reviewItems.find((r) => r.index === index);
    const h = game.history[index];
    // 理由：指した手のあと、駒を取られるか／取れる駒をのがしたか
    const after = playMove({ ...game, board: h.before.board, hands: h.before.hands, turn: h.side, history: [], counts: {}, result: null }, h.move);
    const replies = legalMoves(after.board, after.hands, 1 - me, pieces).filter((m) => m.from && after.board[m.to.y][m.to.x]);
    let hang = null;
    for (const m of replies) { const c = after.board[m.to.y][m.to.x]; if (!hang || (VALUE[c.t] || 0) > (VALUE[hang.t] || 0)) hang = c; }
    let reason = T.reviewBetter;
    if (hang && (VALUE[hang.t] || 0) >= 300) reason = T.reviewHang(pieceName(hang));
    else if (it.bestCaptures) reason = T.reviewMissCapture;
    const bestLabel = moveLabel(it.best, h.before.board, me, pieces, null);
    viewItem = { before: h.before, move: h.move, bestMove: it.best };
    mode = 'view'; msg = `${T.reviewItem(index + 1, labelOf(index))}：${reason}。${T.reviewShowBest(bestLabel)}`;
    draw();
  }

  el.querySelector('#quit').addEventListener('click', () => {
    if (game.result || game.history.length === 0) { sfx('tap'); nav.home(); return; }
    if (!el.querySelector('#quit').dataset.armed) { el.querySelector('#quit').dataset.armed = '1'; toast(T.quitConfirm); setTimeout(() => { const q = el.querySelector('#quit'); if (q) delete q.dataset.armed; }, 2500); return; }
    nav.home();
  });
  if (import.meta.env.DEV) window.__match = () => ({ game, cfg, info });
  msg = game.turn === me ? T.yourTurn : '';
  draw();
  if (game.turn !== me) aiTurn();
  return () => { worker.terminate(); el.remove(); };
}
