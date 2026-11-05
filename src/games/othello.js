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

// 簡単なCPU：隅 > 隅の隣を避ける > 裏返せる石が多い手。同点は乱数
export function cpuMove(s, rng = Math.random) {
  const moves = legalMoves(s.b, s.turn);
  if (!moves.length) return null;
  const score = (m) => (isCorner(m.r, m.c) ? 10000 : 0) - (isDanger(s.b, m.r, m.c) ? 1000 : 0) + m.flips.length;
  const best = Math.max(...moves.map(score));
  const top = moves.filter((m) => score(m) === best);
  const m = top[Math.floor(rng() * top.length)];
  return [m.r, m.c];
}
