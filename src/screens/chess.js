import { T } from '../text.js';
import { sfx } from '../core/audio.js';
import { Chess, squares, resultOf, needsPromotion, chooseMove, fallbackMove } from '../games/chess.js';
import { createChessEngine } from '../games/chessengine.js';

const c = T.chess;
// 駒はどちらの色も「ぬりつぶし」の字を使い、色は CSS で白・黒にする（外の画像は使わない）
const GLYPH = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };
const VS15 = '︎'; // iOS で絵文字にならないようにする

// cfg = { vs: 'cpu' | 'two', me: 'w' | 'b' }。cfg が空なら「どう あそぶ？」から
export function mountChess(root, nav, cfg = {}) {
  const el = document.createElement('div');
  el.className = 'screen chess';
  root.appendChild(el);
  let dead = false, engine = null, timer = null;
  const cleanup = () => { dead = true; clearTimeout(timer); engine?.stop(); el.remove(); };

  function setup() {
    el.innerHTML = `
      <div class="title">${c.title}</div>
      <div class="pick-list">
        <button class="pick" type="button" data-go="w">${c.asWhite}</button>
        <button class="pick" type="button" data-go="b">${c.asBlack}</button>
        <button class="pick" type="button" data-go="two">${c.two}</button>
        <button class="pick" type="button" data-go="rules">${c.rules}</button>
      </div>
      <button class="btn small" type="button" data-go="back">${T.back}</button>
      <div class="c-about">${c.about}</div>`;
  }

  function rules() {
    el.innerHTML = `
      <div class="title">${c.rulesTitle}</div>
      <div class="chess-rules">${c.rulesBody.map(([h, t]) => `<div class="cr-h">${h}</div><div class="cr-t">${t}</div>`).join('')}
        <div class="cr-h">${'駒の字'}</div><div class="cr-t">${Object.entries(GLYPH).map(([k, g]) => `<span class="cr-p">${g}${VS15}</span>${{ k: 'キング', q: 'クイーン', r: 'ルーク', b: 'ビショップ', n: 'ナイト', p: 'ポーン' }[k]}`).join('　')}</div>
      </div>
      <button class="btn" type="button" data-go="menu">${c.rulesBack}</button>`;
  }

  function game(opts) {
    const vs = opts.vs, me = opts.me || 'w', flip = vs === 'cpu' ? me === 'b' : false;
    const chess = new Chess();
    let sel = null, targets = [], promo = null, thinking = false, notice = '';
    if (vs === 'cpu') engine = createChessEngine();
    el.innerHTML = `
      <div class="topbar"><button class="btn small" type="button" data-go="menu">${T.back}</button><span>${c.title}</span><span></span></div>
      <div class="ginfo"><span class="cturn"></span><span class="ccheck"></span></div>
      <div class="gmsg"></div>
      <div class="gwrap"><div class="cboard"></div></div>
      <div class="actions"><button class="btn" type="button" data-go="undo">${c.undo}</button><button class="btn" type="button" data-go="reset">${c.reset}</button></div>`;
    const $ = (s) => el.querySelector(s);
    const boardEl = $('.cboard');
    const isMine = () => vs === 'two' || chess.turn() === me;

    function draw() {
      const res = resultOf(chess);
      const hist = chess.history({ verbose: true });
      const last = hist.at(-1);
      const kingSq = chess.inCheck() ? squares(chess).find((q) => q.piece && q.piece.type === 'k' && q.piece.color === chess.turn())?.square : null;
      boardEl.innerHTML = squares(chess, flip).map((q, i) => {
        const dark = (q.square.charCodeAt(0) + Number(q.square[1])) % 2 === 0;
        const cls = ['ccell', dark ? 'dk' : 'lt'];
        if (sel === q.square) cls.push('sel');
        if (last && (last.from === q.square || last.to === q.square)) cls.push('last');
        if (kingSq === q.square) cls.push('chk');
        const tg = targets.includes(q.square);
        if (tg) cls.push(q.piece ? 'cap' : 'dot');
        const p = q.piece ? `<span class="cp ${q.piece.color}">${GLYPH[q.piece.type]}${VS15}</span>` : '';
        return `<button type="button" class="${cls.join(' ')}" data-sq="${q.square}" ${res || thinking || promo ? 'disabled' : ''} aria-label="${q.square}">${p}${tg && !q.piece ? '<i></i>' : ''}</button>`;
      }).join('');
      $('.cturn').textContent = res ? '' : thinking ? c.thinking : c.turn(chess.turn() === 'w' ? c.white : c.black);
      $('.ccheck').textContent = !res && chess.inCheck() ? c.check : '';
      const msg = $('.gmsg');
      if (res) {
        msg.className = 'gmsg result';
        const head = res.winner ? (vs === 'cpu' ? (res.winner === me ? c.youWin : c.youLose) : c.win(res.winner === 'w' ? c.white : c.black)) : c.drawWord;
        msg.innerHTML = `<div class="big-result">${head}</div><div>${res.kind === 'mate' ? c.mate : c[res.kind] || c.draw}</div>
          <div class="actions"><button class="btn big" type="button" data-go="reset">${c.again}</button><button class="btn" type="button" data-go="menu">${T.back}</button></div>`;
      } else if (promo) {
        msg.className = 'gmsg pass';
        msg.innerHTML = `<div>${c.promoTitle}</div><div class="actions wrap">${['q', 'r', 'b', 'n'].map((t) => `<button class="btn" type="button" data-promo="${t}"><span class="cp ${chess.turn()} pp">${GLYPH[t]}${VS15}</span> ${c.piece[t]}</button>`).join('')}</div>`;
      } else if (notice) { msg.className = 'gmsg pass'; msg.textContent = notice; }
      else { msg.className = 'gmsg'; msg.textContent = ''; }
    }

    function afterMove() {
      sel = null; targets = []; promo = null;
      sfx('tap');
      draw();
      if (resultOf(chess) || vs !== 'cpu' || chess.turn() === me) return;
      cpuMove();
    }

    async function cpuMove() {
      thinking = true; draw();
      const t0 = Date.now();
      const uci = await engine.best(chess.fen());
      if (dead) return;
      if (uci === null && !notice) notice = c.engineFail;
      const m = uci === null ? fallbackMove(chess) : chooseMove(chess, uci);
      const wait = Math.max(0, 500 - (Date.now() - t0)); // 速すぎると何が起きたか分からない
      timer = setTimeout(() => {
        if (dead) return;
        thinking = false;
        if (m) chess.move(m);
        afterMove();
      }, wait);
    }

    function tap(sq) {
      if (!isMine() || resultOf(chess) || thinking || promo) return;
      notice = '';
      const piece = chess.get(sq);
      if (sel && targets.includes(sq)) {
        if (needsPromotion(chess, sel, sq)) { promo = { from: sel, to: sq }; targets = []; draw(); return; }
        chess.move({ from: sel, to: sq });
        return afterMove();
      }
      if (piece && piece.color === chess.turn() && sq !== sel) {
        sel = sq; targets = chess.moves({ square: sq, verbose: true }).map((m) => m.to);
      } else { sel = null; targets = []; }
      draw();
    }

    function undo() {
      if (thinking || promo) return;
      clearTimeout(timer);
      // コンピュータと：自分の手番に戻るまで（ふつうは2手）戻す
      if (vs === 'cpu') { do { if (!chess.undo()) break; } while (chess.turn() !== me); } else chess.undo();
      sel = null; targets = []; notice = ''; draw();
      // 黒を持っていて最初まで戻したら、コンピュータ（白）がまた指す
      if (vs === 'cpu' && !resultOf(chess) && chess.turn() !== me) cpuMove();
    }

    function reset() {
      clearTimeout(timer); chess.reset(); sel = null; targets = []; promo = null; thinking = false; notice = '';
      draw();
      if (vs === 'cpu' && chess.turn() !== me) cpuMove();
    }

    el.onclick = (ev) => {
      const b = ev.target.closest('button');
      if (!b) return;
      if (b.dataset.sq) return tap(b.dataset.sq);
      if (b.dataset.promo && promo) { chess.move({ ...promo, promotion: b.dataset.promo }); return afterMove(); }
      if (b.dataset.go === 'undo') return undo();
      if (b.dataset.go === 'reset') return reset();
      if (b.dataset.go === 'menu') { engine?.stop(); engine = null; clearTimeout(timer); thinking = false; return menu(); }
    };
    draw();
    if (vs === 'cpu' && chess.turn() !== me) cpuMove();
  }

  function menu() { setup(); el.onclick = onMenu; }
  function onMenu(ev) {
    const b = ev.target.closest('button[data-go]');
    if (!b) return;
    sfx('tap');
    const g = b.dataset.go;
    if (g === 'back') return nav.games();
    if (g === 'rules') { rules(); return; }
    if (g === 'menu') return menu();
    game(g === 'two' ? { vs: 'two' } : { vs: 'cpu', me: g });
  }

  if (cfg.vs) game(cfg); else menu();
  return cleanup;
}
