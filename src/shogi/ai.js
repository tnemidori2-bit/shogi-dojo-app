// 対局のAI。画面に依存しない。重い探索は ai.worker.js から呼ぶ。
// 探索：取る・成る・打つ手を並べ、アルファ・ベータ法で先読みする。玉を取られる手は、次の手で玉を取られて点が最低になる。
import { SIZE, movesFor, canPromote } from './rules.js';
import { legalMoves, HAND_ORDER, dropOk } from './engine.js';

const MATE = 1000000;
const VAL = { fu: 100, kyo: 300, kei: 350, gin: 500, kin: 600, kaku: 900, hi: 1100, gyoku: 50000 };
const PROMOTED = { fu: 600, kyo: 600, kei: 600, gin: 600, kaku: 1200, hi: 1400 };
const pv = (c) => (c.p ? PROMOTED[c.t] : VAL[c.t]);
const baseVal = (t) => VAL[t];

// 強さ：depth=先読みの深さ、time=考える時間の上限(ミリ秒)、noise=手の点にまぜる乱数の幅、random=でたらめに指す確率
export const LEVELS = {
  weak: { depth: 1, time: 300, noise: 320, random: 0.3, quiesce: 0 },
  normal: { depth: 2, time: 800, noise: 40, random: 0, quiesce: 3 },
  strong: { depth: 4, time: 2500, noise: 4, random: 0, quiesce: 4 },
};

function mustPromoteFor(c, to) {
  const far = c.s === 0 ? to.y : SIZE - 1 - to.y;
  if (c.t === 'fu' || c.t === 'kyo') return far === 0;
  if (c.t === 'kei') return far <= 1;
  return false;
}

function evaluate(b, h, side) {
  let score = 0;
  const kings = [null, null];
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    const c = b[y][x];
    if (!c) continue;
    const sign = c.s === side ? 1 : -1;
    if (c.t === 'gyoku') { kings[c.s] = { x, y }; continue; }
    let v = pv(c);
    const adv = c.s === 0 ? 8 - y : y; // 前に出た段数
    v += (c.t === 'fu' ? 4 : 1) * adv;
    score += sign * v;
  }
  for (const s of [0, 1]) {
    const sign = s === side ? 1 : -1;
    for (const t of Object.keys(h[s])) score += sign * Math.round(baseVal(t) * 1.05) * h[s][t];
    const k = kings[s];
    if (k) { // 玉の まわりの 味方（金銀）が多いほど安全
      let guard = 0;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const c = b[k.y + dy]?.[k.x + dx];
        if (c && c.s === s && (c.t === 'kin' || c.t === 'gin')) guard++;
      }
      const home = s === 0 ? k.y >= 6 : k.y <= 2;
      score += sign * (guard * 18 + (home ? 25 : -40));
    }
  }
  return score;
}

// 手の候補（盤の駒と持ち駒）。玉を取る手も含む（そのとき相手の玉が取れる＝直前の手が反則）
function genMoves(b, h, side, pieces, capturesOnly) {
  const out = [];
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    const c = b[y][x];
    if (!c || c.s !== side) continue;
    for (const to of movesFor(b, x, y, pieces)) {
      const cap = b[to.y][to.x];
      if (capturesOnly && !cap) continue;
      const from = { x, y };
      let order = (cap ? 10 * pv(cap) - baseVal(c.t) / 10 + 1000 : 0);
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
  out.sort((a, c) => c.order - a.order);
  return out;
}

function make(b, h, m, side) {
  if (m.drop) {
    b[m.to.y][m.to.x] = { t: m.drop, s: side };
    h[side][m.drop] -= 1;
    return { cap: null, piece: null };
  }
  const piece = b[m.from.y][m.from.x];
  const cap = b[m.to.y][m.to.x];
  if (cap) h[side][cap.t] = (h[side][cap.t] || 0) + 1;
  b[m.to.y][m.to.x] = m.promote ? { ...piece, p: true } : piece;
  b[m.from.y][m.from.x] = null;
  return { cap, piece };
}
function unmake(b, h, m, side, u) {
  if (m.drop) {
    b[m.to.y][m.to.x] = null;
    h[side][m.drop] += 1;
    return;
  }
  b[m.from.y][m.from.x] = u.piece;
  b[m.to.y][m.to.x] = u.cap;
  if (u.cap) h[side][u.cap.t] -= 1;
}

class Search {
  constructor(pieces, deadline, qdepth) { this.pieces = pieces; this.deadline = deadline; this.q = qdepth; this.nodes = 0; this.stopped = false; }
  tick() {
    if ((++this.nodes & 1023) === 0 && Date.now() > this.deadline) this.stopped = true;
    return this.stopped;
  }
  quiesce(b, h, side, alpha, beta, ply, qd) {
    const stand = evaluate(b, h, side);
    if (qd <= 0 || this.tick()) return stand;
    if (stand >= beta) return stand;
    if (stand > alpha) alpha = stand;
    for (const m of genMoves(b, h, side, this.pieces, true)) {
      const cap = b[m.to.y][m.to.x];
      if (cap.t === 'gyoku') return MATE - ply;
      const u = make(b, h, m, side);
      const score = -this.quiesce(b, h, 1 - side, -beta, -alpha, ply + 1, qd - 1);
      unmake(b, h, m, side, u);
      if (this.stopped) return 0;
      if (score >= beta) return score;
      if (score > alpha) alpha = score;
    }
    return alpha;
  }
  negamax(b, h, side, depth, alpha, beta, ply) {
    if (depth <= 0) return this.quiesce(b, h, side, alpha, beta, ply, this.q);
    if (this.tick()) return 0;
    let best = -MATE;
    for (const m of genMoves(b, h, side, this.pieces, false)) {
      const cap = m.from ? b[m.to.y][m.to.x] : null;
      if (cap && cap.t === 'gyoku') return MATE - ply;
      const u = make(b, h, m, side);
      const score = -this.negamax(b, h, 1 - side, depth - 1, -beta, -alpha, ply + 1);
      unmake(b, h, m, side, u);
      if (this.stopped) return 0;
      if (score > best) best = score;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }
    return best;
  }
}

const cloneBoard = (b) => b.map((r) => r.slice());
const cloneHands = (h) => [{ ...h[0] }, { ...h[1] }];

// 合法手すべてに点をつける（深さを順に深めて、時間までに終わった最後の深さの結果を返す）
export function analyze(board, hands, side, pieces, { depth, time, quiesce }) {
  const roots = legalMoves(board, hands, side, pieces).map((m) => ({ move: m, score: 0 }));
  if (roots.length === 0) return [];
  const b = cloneBoard(board), h = cloneHands(hands);
  const deadline = Date.now() + time;
  let result = roots.map((r) => ({ ...r }));
  for (let d = 1; d <= depth; d++) {
    const s = new Search(pieces, deadline, quiesce);
    const scored = [];
    let alpha = -MATE;
    for (const r of result) {
      const u = make(b, h, r.move, side);
      const score = -s.negamax(b, h, 1 - side, d - 1, -MATE, MATE, 1);
      unmake(b, h, r.move, side, u);
      if (s.stopped) break;
      scored.push({ move: r.move, score });
    }
    if (s.stopped && scored.length < result.length) { if (d === 1) result = scored.length ? scored : result; break; }
    scored.sort((a, c) => c.score - a.score);
    result = scored;
    if (result[0].score >= MATE - 50) break; // 詰みが見つかった
  }
  return result;
}

// 強さに応じて、1手を選ぶ。rng を差し替えれば、同じ結果を再現できる
export function chooseMove(game, level, rng = Math.random) {
  const cfg = LEVELS[level] || LEVELS.normal;
  const { board, hands, turn, pieces } = game;
  const scored = analyze(board, hands, turn, pieces, cfg);
  if (scored.length === 0) return null;
  if (cfg.random > 0 && rng() < cfg.random && scored[0].score < MATE - 50) {
    return scored[Math.floor(rng() * scored.length)].move;
  }
  let best = null, bestScore = -Infinity;
  for (const r of scored) {
    const s = r.score >= MATE - 50 ? r.score : r.score + (rng() * 2 - 1) * cfg.noise;
    if (s > bestScore) { bestScore = s; best = r.move; }
  }
  return best;
}
