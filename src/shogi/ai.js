// 対局のAI。画面に依存しない。重い探索は ai.worker.js から呼ぶ。
// 探索：アルファ・ベータ法（記憶の表・手の並べ替えつき）で先読みし、局面を点数にして一番よい手を選ぶ。
// 序盤は、定跡（戦法の手順）が使えるあいだは定跡どおりに指す。
import { SIZE, movesFor, canPromote } from './rules.js';
import { legalMoves, HAND_ORDER, dropOk } from './engine.js';
import { toUsi, parseUsi, findLegal } from './usi.js';

const MATE = 1000000;
const VAL = { fu: 100, kyo: 300, kei: 350, gin: 500, kin: 600, kaku: 900, hi: 1100, gyoku: 50000 };
const PROMOTED = { fu: 600, kyo: 600, kei: 600, gin: 600, kaku: 1200, hi: 1400 };
const TI = { fu: 0, kyo: 1, kei: 2, gin: 3, kin: 4, kaku: 5, hi: 6, gyoku: 7 };
const pv = (c) => (c.p ? PROMOTED[c.t] : VAL[c.t]);
const baseVal = (t) => VAL[t];

// 強さ：depth=先読みの深さ、time=考える時間の上限(ミリ秒)、noise=手の点にまぜる乱数の幅、random=でたらめに指す確率、
// quiesce=駒の取り合いを、深さの先でさらに読む手数、exact=全部の手に正確な点をつける（乱数をまぜる弱いAIは、これが必要）、book=定跡を使う確率
export const LEVELS = {
  weak: { depth: 1, time: 300, noise: 320, random: 0.3, quiesce: 0, exact: true, book: 0.3 },
  normal: { depth: 2, time: 800, noise: 40, random: 0, quiesce: 3, exact: true, book: 1 },
  mid: { depth: 3, time: 1000, noise: 0, random: 0, quiesce: 3, exact: false, book: 1 },
  strong: { depth: 5, time: 1500, noise: 0, random: 0, quiesce: 4, exact: false, book: 1 },
  master: { depth: 9, time: 4000, noise: 0, random: 0, quiesce: 6, exact: false, book: 1 },
};

function mustPromoteFor(c, to) {
  const far = c.s === 0 ? to.y : SIZE - 1 - to.y;
  if (c.t === 'fu' || c.t === 'kyo') return far === 0;
  if (c.t === 'kei') return far <= 1;
  return false;
}

// ---- 局面の点数（手番の側から見て、大きいほどよい）----
// 評価の重み。対戦で強さを測りながら調整するため、数字をまとめて持つ（EW_OLD は、最初のAIの点のつけ方）
export const EW_OLD = { pawn: [0, 4, 8, 12, 16, 20, 24, 28, 0], other: 1, silver: 0, knight: 0, goldPen: 0, mob: 0, promo: 0, guard: 18, home: 25, away: -40, kingFile: 0, hand: 1.05 };
// 対戦（300局ほど）で、旧より勝ち越したのは「成った駒の前進に点（promo）」だけ。ほかの点（飛・角の動ける数、歩の進み、守り、銀・桂、玉の端寄せ）は、効果が出ないか、逆に弱くなった
export const EW = { ...EW_OLD, promo: 3 };

function evaluate(b, h, side, pieces, ew) {
  let score = 0;
  const kings = [null, null];
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    const c = b[y][x];
    if (!c) continue;
    const sign = c.s === side ? 1 : -1;
    if (c.t === 'gyoku') { kings[c.s] = { x, y }; continue; }
    let v = pv(c);
    const adv = c.s === 0 ? 8 - y : y; // 自陣の一番奥を0として、前に出た段数
    const edge = x === 0 || x === 8;
    if (c.p) v += adv * ew.promo;
    else if (c.t === 'fu') v += ew.pawn[adv];
    else v += adv * ew.other;
    if (!c.p) {
      if (c.t === 'gin') v += Math.min(adv, 5) * ew.silver;
      else if (c.t === 'kei') v += (adv >= 3 && adv <= 6 ? 12 : 0) * ew.knight - (edge ? 15 : 0) * ew.knight;
      else if (c.t === 'kin') v -= Math.max(0, adv - 4) * ew.goldPen;
    }
    if (ew.mob && (c.t === 'kaku' || c.t === 'hi')) v += ew.mob * Math.min(movesFor(b, x, y, pieces).length, 12);
    score += sign * v;
  }
  for (const s of [0, 1]) {
    const sign = s === side ? 1 : -1;
    for (const t of Object.keys(h[s])) score += sign * Math.round(baseVal(t) * ew.hand) * h[s][t];
    const k = kings[s];
    if (k) {
      let guard = 0;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const c = b[k.y + dy]?.[k.x + dx];
        if (c && c.s === s && (c.t === 'kin' || c.t === 'gin')) guard++;
      }
      const kAdv = s === 0 ? 8 - k.y : k.y;
      const fileC = Math.abs(k.x - 4);
      score += sign * (guard * ew.guard + (kAdv <= 2 ? ew.home : ew.away) + (fileC >= 2 ? 14 : fileC === 1 ? 0 : -12) * ew.kingFile);
    }
  }
  return score;
}

// ---- 記憶の表のための、局面の指紋（Zobrist）----
const ZR = (() => {
  let s = 0x2545f491;
  const rand = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return s >>> 0; };
  const pk = (n) => { const hi = new Int32Array(n), lo = new Int32Array(n); for (let i = 0; i < n; i++) { hi[i] = rand() & 0x1fffff; lo[i] = rand() | 0; } return { hi, lo }; };
  const P = pk(2 * 8 * 2 * 81);
  const H = pk(2 * 7 * 19);
  H.hi.forEach((_, i) => { if (i % 19 === 0) { H.hi[i] = 0; H.lo[i] = 0; } }); // 持ち駒0枚は、指紋に入れない
  const S = pk(1);
  return { P, H, S };
})();

// ---- 手の候補（盤の駒と持ち駒）。玉を取る手も含む ----
function genMoves(b, h, side, pieces, capturesOnly) {
  const out = [];
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    const c = b[y][x];
    if (!c || c.s !== side) continue;
    for (const to of movesFor(b, x, y, pieces)) {
      const cap = b[to.y][to.x];
      if (capturesOnly && !cap) continue;
      const from = { x, y };
      const order = cap ? 10 * pv(cap) - baseVal(c.t) / 10 + 1000 : 0;
      if (canPromote(b, from, to, pieces)) {
        if (!mustPromoteFor(c, to)) out.push({ from, to, drop: null, promote: false, order });
        out.push({ from, to, drop: null, promote: true, order: order + 300 });
      } else out.push({ from, to, drop: null, promote: false, order });
    }
  }
  if (!capturesOnly) {
    const near = (x, y) => {
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (b[y + dy]?.[x + dx]) return true;
      return false;
    };
    for (const t of HAND_ORDER) {
      if (!(h[side][t] > 0)) continue;
      for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
        if (b[y][x] || !near(x, y) || !dropOk(b, t, side, x, y)) continue;
        out.push({ from: null, to: { x, y }, drop: t, promote: false, order: 0 });
      }
    }
  }
  return out;
}

const sameMv = (a, c) => a && c && a.drop === c.drop && a.promote === c.promote && a.to.x === c.to.x && a.to.y === c.to.y
  && ((!a.from && !c.from) || (a.from && c.from && a.from.x === c.from.x && a.from.y === c.from.y));

class Search {
  constructor(board, hands, pieces, deadline, qdepth, ew) {
    this.pieces = pieces; this.ew = ew || EW; this.deadline = deadline; this.q = qdepth;
    this.nodes = 0; this.stopped = false;
    this.tt = new Map();
    this.killers = Array.from({ length: 80 }, () => [null, null]);
    this.hist = new Int32Array(2 * 90 * 81);
    this.h1 = 0; this.h0 = 0;
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) if (board[y][x]) this.xp(board[y][x], x, y);
    for (const s of [0, 1]) for (const t of Object.keys(hands[s])) this.xh(s, TI[t], hands[s][t]);
  }
  xp(c, x, y) { const i = ((c.s * 8 + TI[c.t]) * 2 + (c.p ? 1 : 0)) * 81 + y * 9 + x; this.h1 ^= ZR.P.hi[i]; this.h0 ^= ZR.P.lo[i]; }
  xh(s, t, n) { const i = (s * 7 + t) * 19 + n; this.h1 ^= ZR.H.hi[i]; this.h0 ^= ZR.H.lo[i]; }
  xs() { this.h1 ^= ZR.S.hi[0]; this.h0 ^= ZR.S.lo[0]; }
  key(side) { return (this.h1 ^ (side ? ZR.S.hi[0] : 0)) * 4294967296 + ((this.h0 ^ (side ? ZR.S.lo[0] : 0)) >>> 0); }

  make(b, h, m, side) {
    const u = { h1: this.h1, h0: this.h0, cap: null, piece: null };
    if (m.drop) {
      const t = TI[m.drop], n = h[side][m.drop];
      this.xh(side, t, n); h[side][m.drop] = n - 1; this.xh(side, t, n - 1);
      const p = { t: m.drop, s: side };
      b[m.to.y][m.to.x] = p; this.xp(p, m.to.x, m.to.y);
      return u;
    }
    const piece = b[m.from.y][m.from.x];
    const cap = b[m.to.y][m.to.x];
    this.xp(piece, m.from.x, m.from.y);
    if (cap) {
      this.xp(cap, m.to.x, m.to.y);
      const n = h[side][cap.t] || 0, t = TI[cap.t];
      this.xh(side, t, n); h[side][cap.t] = n + 1; this.xh(side, t, n + 1);
    }
    const np = m.promote ? { ...piece, p: true } : piece;
    b[m.to.y][m.to.x] = np; this.xp(np, m.to.x, m.to.y);
    b[m.from.y][m.from.x] = null;
    u.cap = cap; u.piece = piece;
    return u;
  }
  unmake(b, h, m, side, u) {
    if (m.drop) { b[m.to.y][m.to.x] = null; h[side][m.drop] += 1; }
    else {
      b[m.from.y][m.from.x] = u.piece;
      b[m.to.y][m.to.x] = u.cap;
      if (u.cap) h[side][u.cap.t] -= 1;
    }
    this.h1 = u.h1; this.h0 = u.h0;
  }
  tick() {
    if ((++this.nodes & 1023) === 0 && Date.now() > this.deadline) this.stopped = true;
    return this.stopped;
  }

  // 手を並べる：記憶の表の手→取る手→キラー（同じ深さで効いた手）→履歴の順
  order(moves, ply, side, ttm) {
    const k = this.killers[ply] || [null, null];
    for (const m of moves) {
      if (ttm && sameMv(m, ttm)) { m.order += 1e7; continue; }
      if (m.order > 0) continue; // 取る手は、すでに点がついている
      if (sameMv(m, k[0])) m.order += 5e5;
      else if (sameMv(m, k[1])) m.order += 4e5;
      else m.order += Math.min(this.hist[this.hidx(m, side)], 3e5);
    }
    moves.sort((a, c) => c.order - a.order);
  }
  hidx(m, side) { return (side * 90 + (m.from ? m.from.y * 9 + m.from.x : 81 + TI[m.drop])) * 81 + m.to.y * 9 + m.to.x; }

  quiesce(b, h, side, alpha, beta, ply, qd) {
    const stand = evaluate(b, h, side, this.pieces, this.ew);
    if (qd <= 0 || this.tick()) return stand;
    if (stand >= beta) return stand;
    if (stand > alpha) alpha = stand;
    const moves = genMoves(b, h, side, this.pieces, true);
    moves.sort((a, c) => c.order - a.order);
    for (const m of moves) {
      const cap = b[m.to.y][m.to.x];
      if (cap.t === 'gyoku') return MATE - ply;
      const u = this.make(b, h, m, side);
      const score = -this.quiesce(b, h, 1 - side, -beta, -alpha, ply + 1, qd - 1);
      this.unmake(b, h, m, side, u);
      if (this.stopped) return 0;
      if (score >= beta) return score;
      if (score > alpha) alpha = score;
    }
    return alpha;
  }

  negamax(b, h, side, depth, alpha, beta, ply) {
    if (depth <= 0) return this.quiesce(b, h, side, alpha, beta, ply, this.q);
    if (this.tick()) return 0;
    const alpha0 = alpha, beta0 = beta;
    const key = this.key(side);
    const e = this.tt.get(key);
    let ttm = null;
    if (e) {
      ttm = e.m;
      if (e.d >= depth) {
        if (e.f === 0) return e.s;
        if (e.f === 1 && e.s > alpha) alpha = e.s;
        else if (e.f === 2 && e.s < beta) beta = e.s;
        if (alpha >= beta) return e.s;
      }
    }
    const moves = genMoves(b, h, side, this.pieces, false);
    this.order(moves, ply, side, ttm);
    let best = -MATE, bestMove = null;
    for (const m of moves) {
      const cap = m.from ? b[m.to.y][m.to.x] : null;
      if (cap && cap.t === 'gyoku') return MATE - ply;
      const u = this.make(b, h, m, side);
      const score = -this.negamax(b, h, 1 - side, depth - 1, -beta, -alpha, ply + 1);
      this.unmake(b, h, m, side, u);
      if (this.stopped) return 0;
      if (score > best) { best = score; bestMove = m; }
      if (best > alpha) alpha = best;
      if (alpha >= beta) {
        if (!cap) { // 取らない手で効いた手は、次の局面でも先に試す
          const k = this.killers[ply];
          if (k && !sameMv(k[0], m)) { k[1] = k[0]; k[0] = m; }
          this.hist[this.hidx(m, side)] += depth * depth;
        }
        break;
      }
    }
    if (!this.stopped && Math.abs(best) < MATE - 1000) {
      if (this.tt.size > 400000) this.tt.clear();
      this.tt.set(key, { d: depth, s: best, f: best <= alpha0 ? 2 : best >= beta0 ? 1 : 0, m: bestMove });
    }
    return best;
  }
}

const cloneBoard = (b) => b.map((r) => r.slice());
const cloneHands = (h) => [{ ...h[0] }, { ...h[1] }];

// 合法手すべてに点をつける（深さを順に深めて、時間までに終わった最後の深さの結果を返す）。exact=false なら、いちばんよい手だけが正確
export function analyze(board, hands, side, pieces, { depth, time, quiesce, exact = true, ew }) {
  const roots = legalMoves(board, hands, side, pieces).map((m) => ({ move: m, score: 0 }));
  if (roots.length === 0) return [];
  const b = cloneBoard(board), h = cloneHands(hands);
  const s = new Search(b, h, pieces, Date.now() + time, quiesce, ew);
  let result = roots;
  for (let d = 1; d <= depth; d++) {
    const scored = [];
    let alpha = -MATE;
    for (const r of result) {
      const u = s.make(b, h, r.move, side);
      const score = -s.negamax(b, h, 1 - side, d - 1, -MATE, exact ? MATE : -alpha, 1);
      s.unmake(b, h, r.move, side, u);
      if (s.stopped) break;
      scored.push({ move: r.move, score });
      if (!exact && score > alpha) alpha = score;
    }
    if (s.stopped) { if (d === 1 && scored.length) result = scored; break; }
    scored.sort((a, c) => c.score - a.score);
    result = scored;
    if (result[0].score >= MATE - 50) break; // 詰みが見つかった
  }
  return result;
}

// ---- 定跡 ----
export const usiHistoryOf = (game) => game.usiHistory || (game.history || []).map((h) => toUsi(h.move));

// 定跡（手順の並び）のうち、いままでの手と同じ形で始まるものから、次の手をひとつ選ぶ。使えなければ null
export function bookMove(game, book, rng = Math.random) {
  if (!book || !book.length) return null;
  if (game.handicap && game.handicap !== 'none') return null;
  const hist = usiHistoryOf(game);
  const next = [];
  for (const line of book) {
    if (line.length <= hist.length) continue;
    let ok = true;
    for (let i = 0; i < hist.length; i++) if (line[i] !== hist[i]) { ok = false; break; }
    if (ok) next.push(line[hist.length]);
  }
  if (!next.length) return null;
  const m = parseUsi(next[Math.floor(rng() * next.length)]);
  return findLegal(game.board, game.hands, game.turn, game.pieces, m);
}

// 強さに応じて、1手を選ぶ。rng を差し替えれば、同じ結果を再現できる。book は定跡（手順の並び）
export function chooseMove(game, level, rng = Math.random, book = null) {
  const cfg = typeof level === 'object' ? level : (LEVELS[level] || LEVELS.normal);
  const { board, hands, turn, pieces } = game;
  if (cfg.book > 0 && rng() < cfg.book) {
    const bm = bookMove(game, book, rng);
    if (bm) return bm;
  }
  const scored = analyze(board, hands, turn, pieces, cfg);
  if (scored.length === 0) return null;
  if (cfg.random > 0 && rng() < cfg.random && scored[0].score < MATE - 50) {
    return scored[Math.floor(rng() * scored.length)].move;
  }
  // 速い探索（exact=false）では、最善の手だけが正確で、ほかの手の点は「それ以下」としか分からない。
  // その点に乱数をまぜると、実は悪い手を選んでしまうので、最善の手を選ぶ。乱数をまぜるのは、全部の手を正確に調べた弱い段階だけ
  if (!cfg.exact) return scored[0].move;
  let best = null, bestScore = -Infinity;
  for (const r of scored) {
    const sc = r.score >= MATE - 50 ? r.score : r.score + (rng() * 2 - 1) * cfg.noise;
    if (sc > bestScore) { bestScore = sc; best = r.move; }
  }
  return best;
}
