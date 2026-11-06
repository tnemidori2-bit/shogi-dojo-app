import { T } from '../text.js';
import { sfx } from '../core/audio.js';
import * as Se from '../cards/sevens.js';
import * as Sp from '../cards/speed.js';
import * as U from '../cards/uno.js';

const g = T.cards;
const html = String.raw;

// ---- 共通の部品 ----
export function frame(root, title, extra = '', rulesKey = '') {
  const el = document.createElement('div');
  el.className = 'screen cardgame ' + extra;
  const rules = (g.rules[rulesKey] || []).map((t) => `<p>${t}</p>`).join('');
  el.innerHTML = html`<div class="topbar"><button class="btn small" type="button" data-act="back">${T.back}</button><span>${title}</span><button class="btn small" type="button" data-act="rules">${g.rulesBtn}</button></div><div class="cg-status"></div><div class="cg-body"></div>
    <div class="rules-overlay" hidden><div class="rules-box"><div class="title">${title}・${g.rulesTitle}</div>${rules}<button class="btn big" type="button" data-act="closerules">${g.rulesClose}</button></div></div>`;
  root.appendChild(el);
  return { el, body: el.querySelector('.cg-body'), status: el.querySelector('.cg-status') };
}
// トランプ1枚（表）。opts: { on: 出せる, sel: 選択中 }
const faceCard = (c, opts = {}) =>
  `<button class="pcard ${Se.suitColor(c.s)}${opts.on ? ' on' : ''}${opts.sel ? ' sel' : ''}" type="button" data-s="${c.s}" data-r="${c.r}"><span class="rk">${Se.rankLabel(c.r)}</span><span class="st">${Se.SUITS[c.s]}</span></button>`;
const backCard = (extra = '') => `<span class="pcard back ${extra}"></span>`;
const UNO_SYM = { skip: '⊘', rev: '⇄', d2: '+2', w: '★', w4: '+4' };
const unoLabel = (c) => (typeof c.v === 'number' ? String(c.v) : UNO_SYM[c.v]);
const unoCard = (c, opts = {}) =>
  `<button class="ucard c-${c.c}${opts.on ? ' on' : ''}" type="button" data-i="${opts.i ?? ''}"><span>${unoLabel(c)}</span></button>`;
export const result = (text, sub, extra = '') => html`<div class="cg-result"><div class="big-result">${text}</div>${sub ? `<div>${sub}</div>` : ''}${extra}<div class="actions"><button class="btn big" type="button" data-act="again">${T.games.again}</button><button class="btn" type="button" data-act="back">${T.back}</button></div></div>`;

export function wire(el, nav, onAgain, onTap) {
  el.addEventListener('click', (ev) => {
    const b = ev.target.closest('button,[data-act]');
    if (!b) return;
    if (b.dataset.act === 'rules' || b.dataset.act === 'closerules') {
      const open = b.dataset.act === 'rules';
      el.querySelector('.rules-overlay').hidden = !open;
      el.classList.toggle('show-rules', open);
      return;
    }
    if (el.classList.contains('show-rules')) return;
    if (b.dataset.act === 'back') nav.games();
    else if (b.dataset.act === 'again') onAgain();
    else onTap(b, ev);
  });
}

// ================= 七並べ =================
export function mountSevens(root, nav) {
  const { el, body, status } = frame(root, g.sevens, '', 'sevens');
  let s, timer = null, dead = false, msg = '';
  const names = [g.you, 'CPU1', 'CPU2', 'CPU3'];

  function draw() {
    const rows = [0, 1, 2, 3].map((su) => `<div class="srow ${Se.suitColor(su)}"><span class="ssuit">${Se.SUITS[su]}</span>${Array.from({ length: 13 }, (_, i) => {
      const r = i + 1;
      return s.board[su][i] ? `<span class="scell on">${Se.rankLabel(r)}</span>` : `<span class="scell">${Se.rankLabel(r)}</span>`;
    }).join('')}</div>`).join('');
    const mine = Se.playable(s, 0);
    const myTurn = s.turn === 0 && s.winner === null;
    const hand = s.hands[0].map((c) => faceCard(c, { on: myTurn && Se.canPlay(s.board, c) })).join('');
    status.textContent = s.winner === null ? g.turnOf(names[s.turn]) : '';
    body.innerHTML = html`
      <div class="cpus">${[1, 2, 3].map((p) => `<span class="cpu${s.turn === p && s.winner === null ? ' now' : ''}">${names[p]} ${g.cards(s.hands[p].length)}${s.passes[p] ? ` ・ ${g.passN(s.passes[p])}` : ''}</span>`).join('')}</div>
      <div class="tableau">${rows}</div>
      <div class="cg-msg">${s.winner !== null ? '' : msg || (myTurn ? (mine.length ? g.sevensPick : g.sevensMustPass) : '')}</div>
      <div class="hand-cards">${hand}</div>
      <div class="actions"><button class="btn" type="button" data-act="pass" ${myTurn && !mine.length ? '' : 'disabled'}>${T.games.passBtn}</button></div>
      ${s.winner !== null ? result(s.winner === 0 ? g.youWin : g.cpuWin(names[s.winner]), g.remainList([1, 2, 3].map((p) => `${names[p]} ${g.cards(s.hands[p].length)}`).join(' ・ ') + ` ・ ${g.you} ${g.cards(s.hands[0].length)}`)) : ''}`;
  }

  function step() {
    clearTimeout(timer);
    draw();
    if (s.winner !== null || dead || s.turn === 0) return;
    timer = setTimeout(() => {
      if (dead) return;
      const p = s.turn, c = Se.cpuChoose(s, p);
      if (c) { s = Se.play(s, p, c); msg = g.played(names[p], `${Se.SUITS[c.s]}${Se.rankLabel(c.r)}`); }
      else { s = Se.pass(s, p); msg = g.passed(names[p]); }
      sfx('tap');
      step();
    }, 750);
  }
  function reset() { s = Se.newGame(); msg = ''; step(); }
  wire(el, nav, reset, (b) => {
    if (b.dataset.act === 'pass') { const n = Se.pass(s, 0); if (n) { s = n; msg = g.passed(g.you); step(); } return; }
    if (b.classList.contains('pcard') && s.turn === 0) {
      const n = Se.play(s, 0, { s: Number(b.dataset.s), r: Number(b.dataset.r) });
      if (n) { s = n; msg = ''; sfx('tap'); step(); }
    }
  });
  reset();
  return () => { dead = true; clearTimeout(timer); el.remove(); };
}

// ================= スピード =================
// cfg.speed: 1=ゆっくり 2=ふつう 3=はやい（CPUが出すまでの時間）
const SPEED_MS = { 1: 2800, 2: 1800, 3: 1000 };
export function mountSpeed(root, nav, cfg = {}) {
  const speed = cfg.speed || 1;
  const { el, body, status } = frame(root, `${g.speedTitle} ${g.speedNames[speed - 1]}`, 'speedgame', 'speed');
  let s, sel = null, dead = false, nextCpu = 0, stuckAt = 0, tick = null, note = '';

  function draw() {
    const me = s.players[0], cpu = s.players[1];
    const pile = (i) => `<button class="pile" type="button" data-pile="${i}">${faceCard(Sp.top(s, i)).replace('<button', '<span').replace('</button>', '</span>')}</button>`;
    status.textContent = '';
    body.innerHTML = html`
      <div class="sp-opp"><span>CPU ${g.cards(Sp.remaining(s, 1))}</span><div class="hand-cards small">${cpu.hand.map(() => backCard()).join('')}</div></div>
      <div class="sp-center">${pile(0)}${pile(1)}</div>
      <div class="cg-msg">${s.winner !== null ? '' : note || (Sp.stuck(s) ? g.speedStuck : g.speedHint)}</div>
      <div class="hand-cards">${me.hand.map((c, i) => faceCard(c, { on: Sp.movesFor(s, 0).some((m) => m.i === i), sel: sel === i }).replace('<button', `<button data-i="${i}"`)).join('')}</div>
      <div class="sp-me"><span>${g.you} ${g.cards(Sp.remaining(s, 0))}</span></div>
      ${s.winner !== null ? result(s.winner === 0 ? g.youWin : g.cpuWin('CPU'), '') : ''}`;
  }

  function after() {
    sel = null; note = ''; draw();
    if (s.winner !== null) { clearInterval(tick); sfx('tap'); }
  }
  function loop() {
    if (dead || s.winner !== null) return;
    if (el.classList.contains('show-rules')) { nextCpu += 120; if (stuckAt) stuckAt += 120; return; } // ルールを読んでいる間は止める
    const now = Date.now();
    if (Sp.stuck(s)) {
      if (!stuckAt) { stuckAt = now; draw(); }
      if (now - stuckAt > 1500) { s = Sp.flip(s); stuckAt = 0; note = ''; after(); }
      return;
    }
    stuckAt = 0;
    if (now >= nextCpu) {
      const m = Sp.movesFor(s, 1);
      nextCpu = now + SPEED_MS[speed] * (0.7 + Math.random() * 0.6);
      if (m.length) { const x = m[Math.floor(Math.random() * m.length)]; s = Sp.play(s, 1, x.i, x.pile); sfx('tap'); after(); }
    }
  }
  function reset() { s = Sp.newGame(); sel = null; note = ''; stuckAt = 0; nextCpu = Date.now() + SPEED_MS[speed]; clearInterval(tick); tick = setInterval(loop, 120); draw(); }

  wire(el, nav, reset, (b) => {
    if (s.winner !== null) return;
    if (b.dataset.i !== undefined && b.classList.contains('pcard')) {
      const i = Number(b.dataset.i), moves = Sp.movesFor(s, 0).filter((m) => m.i === i);
      if (!moves.length) { note = g.speedNo; sel = null; draw(); return; }
      note = '';
      if (moves.length === 1) { s = Sp.play(s, 0, i, moves[0].pile); sfx('tap'); after(); }
      else { sel = i; draw(); }
      return;
    }
    const pileBtn = b.closest('.pile');
    if (pileBtn && sel !== null) {
      const n = Sp.play(s, 0, sel, Number(pileBtn.dataset.pile));
      if (n) { s = n; sfx('tap'); after(); }
    }
  });
  reset();
  return () => { dead = true; clearInterval(tick); el.remove(); };
}

// ================= UNO =================
const COLOR_NAME = { R: 'あか', Y: 'きいろ', G: 'みどり', B: 'あお' };
export function mountUno(root, nav) {
  const { el, body, status } = frame(root, g.uno, 'unogame', 'uno');
  let s, timer = null, dead = false, msg = '', choosing = null;
  const names = [g.you, 'CPU1', 'CPU2', 'CPU3'];

  function draw() {
    const myTurn = s.turn === 0 && s.winner === null;
    const mine = U.playable(s, 0);
    const canDraw = myTurn && s.drew === null && !mine.length;
    status.textContent = s.winner === null ? g.turnOf(names[s.turn]) : '';
    body.innerHTML = html`
      <div class="cpus">${[1, 2, 3].map((p) => `<span class="cpu${s.turn === p && s.winner === null ? ' now' : ''}">${names[p]} ${g.cards(s.hands[p].length)}${s.hands[p].length === 1 ? ' UNO!' : ''}</span>`).join('')}</div>
      <div class="uno-center">
        <button class="deck${canDraw ? ' on' : ''}" type="button" data-act="draw"><span>${g.unoDraw}</span></button>
        ${unoCard(U.top(s))}
        <div class="curcolor c-${s.color}"><small>${g.unoColor}</small>${COLOR_NAME[s.color]}</div>
      </div>
      <div class="cg-msg">${s.winner !== null ? '' : msg || (myTurn ? (s.drew ? g.unoDrew : mine.length ? g.unoPick : g.unoMustDraw) : '')}</div>
      ${choosing ? `<div class="colorpick">${U.COLORS.map((c) => `<button class="ucard c-${c} on" type="button" data-color="${c}"><span>${COLOR_NAME[c]}</span></button>`).join('')}</div>` : ''}
      <div class="hand-cards uno-hand">${s.hands[0].map((c, i) => unoCard(c, { i, on: myTurn && mine.includes(c) })).join('')}</div>
      <div class="actions"><button class="btn" type="button" data-act="pass" ${myTurn && s.drew ? '' : 'disabled'}>${T.games.passBtn}</button></div>
      ${s.winner !== null ? result(s.winner === 0 ? g.youWin : g.cpuWin(names[s.winner]), '') : ''}`;
  }

  function logText(prev) {
    const l = s.log;
    if (!l) return '';
    if (l.draw) return g.unoDrawnBy(names[l.p]);
    if (l.pass) return g.passed(names[l.p]);
    const extra = l.card.c === 'W' ? ` → ${COLOR_NAME[l.color]}` : '';
    const lastOne = s.hands[l.p].length === 1 ? ' UNO!' : '';
    return `${names[l.p]}: ${l.card.c === 'W' ? '' : COLOR_NAME[l.card.c]}${unoLabel(l.card)}${extra}${lastOne}`;
  }

  function step() {
    clearTimeout(timer);
    msg = logText();
    draw();
    if (s.winner !== null || dead || s.turn === 0) return;
    timer = setTimeout(() => {
      if (dead) return;
      const p = s.turn, ch = U.cpuChoose(s, p);
      let n;
      if (ch) n = U.play(s, p, ch.card, ch.color);
      else if (s.drew !== null) n = U.passAfterDraw(s, p);
      else n = U.draw(s, p);
      if (n) { s = n; sfx('tap'); }
      step();
    }, 900);
  }
  function reset() { s = U.newGame(); choosing = null; msg = ''; step(); }

  wire(el, nav, reset, (b) => {
    if (s.turn !== 0 || s.winner !== null) return;
    if (b.dataset.color && choosing) {
      const n = U.play(s, 0, choosing, b.dataset.color);
      choosing = null;
      if (n) { s = n; sfx('tap'); step(); }
      return;
    }
    if (b.dataset.act === 'draw') { const n = U.draw(s, 0); if (n) { s = n; step(); } return; }
    if (b.dataset.act === 'pass') { const n = U.passAfterDraw(s, 0); if (n) { s = n; step(); } return; }
    if (b.classList.contains('ucard') && b.dataset.i !== undefined && b.dataset.i !== '') {
      const card = s.hands[0][Number(b.dataset.i)];
      if (!card || !U.playable(s, 0).includes(card)) { msg = g.unoNo; draw(); return; }
      if (card.c === 'W') { choosing = card; draw(); return; }
      const n = U.play(s, 0, card);
      if (n) { s = n; sfx('tap'); step(); }
    }
  });
  reset();
  return () => { dead = true; clearTimeout(timer); el.remove(); };
}
