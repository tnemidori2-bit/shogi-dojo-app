// オセロのルール（画面に依存しない）。石は 0=空き, 1=黒, 2=白
export const SIZE = 8;
const DIRS = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
const opp = (p) => 3 - p;
const inside = (r, c) => r >= 0 && r < SIZE && c >= 0 && c < SIZE;

// そこに置いたとき裏返る石の位置の一覧（置けないなら空）
export function flipsAt(b, r, c, p) {
  if (b[r * SIZE + c] !== 0) return [];
  const out = [];
  for (const [dr, dc] of DIRS) {
    const line = [];
    let y = r + dr, x = c + dc;
    while (inside(y, x) && b[y * SIZE + x] === opp(p)) { line.push(y * SIZE + x); y += dr; x += dc; }
    if (line.length && inside(y, x) && b[y * SIZE + x] === p) out.push(...line);
  }
  return out;
}

export function legalMoves(b, p) {
  const out = [];
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
    const f = flipsAt(b, r, c, p);
    if (f.length) out.push({ r, c, flips: f });
  }
  return out;
}

export function count(b) {
  let black = 0, white = 0;
  for (const v of b) { if (v === 1) black++; else if (v === 2) white++; }
  return { black, white };
}

export function newState() {
  const b = new Array(SIZE * SIZE).fill(0);
  b[3 * SIZE + 3] = 2; b[3 * SIZE + 4] = 1; b[4 * SIZE + 3] = 1; b[4 * SIZE + 4] = 2;
  return { b, turn: 1, last: null, result: null, passed: null, moves: 0 };
}

function finish(b) {
  const { black, white } = count(b);
  return black > white ? 'black' : white > black ? 'white' : 'draw';
}

// 1手打つ。置けないなら null。パスは passed に入る（パスしたのは誰か）
export function play(s, r, c) {
  if (s.result) return null;
  const flips = flipsAt(s.b, r, c, s.turn);
  if (!flips.length) return null;
  const b = s.b.slice();
  b[r * SIZE + c] = s.turn;
  for (const i of flips) b[i] = s.turn;
  const next = { b, turn: opp(s.turn), last: r * SIZE + c, result: null, passed: null, moves: s.moves + 1 };
  if (!legalMoves(b, next.turn).length) {
    if (legalMoves(b, s.turn).length) { next.passed = next.turn; next.turn = s.turn; }
    else next.result = finish(b);
  }
  return next;
}

export function hints(s) {
  if (s.result) return new Set();
  return new Set(legalMoves(s.b, s.turn).map((m) => m.r * SIZE + m.c));
}

const isCorner = (r, c) => (r === 0 || r === SIZE - 1) && (c === 0 || c === SIZE - 1);
// 隅の隣（X打ち・C打ち）。隅がすでに埋まっていれば危なくない
function isDanger(b, r, c) {
  for (const cr of [0, SIZE - 1]) for (const cc of [0, SIZE - 1]) {
    if (Math.abs(r - cr) <= 1 && Math.abs(c - cc) <= 1 && !(r === cr && c === cc) && b[cr * SIZE + cc] === 0) return true;
  }
  return false;
}

// 場所の重み（隅が高く、隅の隣が低い）。上の左4分の1だけ書いて、折り返して使う
const Q = [[100, -20, 10, 5], [-20, -50, -2, -2], [10, -2, -1, -1], [5, -2, -1, -1]];
const WEIGHT = new Array(SIZE * SIZE).fill(0).map((_, i) => {
  const r = Math.floor(i / SIZE), c = i % SIZE;
  return Q[r < 4 ? r : 7 - r][c < 4 ? c : 7 - c];
});
const countMoves = (b, p) => legalMoves(b, p).length;
// p から見た盤の点数：場所の重み＋置ける場所の数の差
function evalBoard(b, p) {
  let v = 0;
  for (let i = 0; i < b.length; i++) { if (b[i] === p) v += WEIGHT[i]; else if (b[i] === opp(p)) v -= WEIGHT[i]; }
  return v + 5 * (countMoves(b, p) - countMoves(b, opp(p)));
}
function applyMove(b, m, p) {
  const nb = b.slice();
  nb[m.r * SIZE + m.c] = p;
  for (const i of m.flips) nb[i] = p;
  return nb;
}
// p の番で depth 手先まで読んだときの、p から見た点数（アルファ・ベータ法）
function negamax(b, p, depth, alpha, beta) {
  const moves = legalMoves(b, p);
  if (!moves.length) {
    if (!countMoves(b, opp(p))) { const n = count(b); return (p === 1 ? n.black - n.white : n.white - n.black) * 200; }
    return -negamax(b, opp(p), depth, -beta, -alpha); // パス
  }
  if (depth === 0) return evalBoard(b, p);
  let best = -Infinity;
  for (const m of moves) {
    const v = -negamax(applyMove(b, m, p), opp(p), depth - 1, -beta, -alpha);
    if (v > best) best = v;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

const pickBest = (items, score, rng) => {
  const best = Math.max(...items.map(score));
  const top = items.filter((x) => score(x) === best);
  return top[Math.floor(rng() * top.length)];
};

// CPU。level 1=でたらめ 2=たくさん裏返す 3=隅を取り隅の隣を避ける 4=場所の重みと置ける数で1手先 5=4手先まで読む
export function cpuMove(s, rng = Math.random, level = 3) {
  const moves = legalMoves(s.b, s.turn);
  if (!moves.length) return null;
  let m;
  if (level <= 1) m = moves[Math.floor(rng() * moves.length)];
  else if (level === 2) m = pickBest(moves, (x) => x.flips.length, rng);
  else if (level === 3) m = pickBest(moves, (x) => (isCorner(x.r, x.c) ? 10000 : 0) - (isDanger(s.b, x.r, x.c) ? 1000 : 0) + x.flips.length, rng);
  else if (level === 4) m = pickBest(moves, (x) => evalBoard(applyMove(s.b, x, s.turn), s.turn), rng);
  else m = pickBest(moves, (x) => -negamax(applyMove(s.b, x, s.turn), opp(s.turn), 3, -Infinity, Infinity), rng);
  return [m.r, m.c];
}
