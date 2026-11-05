// 五目並べのルール（画面に依存しない）。石は 0=空き, 1=黒, 2=白。連珠の禁じ手は無し
export const SIZE = 15;
const DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]];
const opp = (p) => 3 - p;
const inside = (r, c) => r >= 0 && r < SIZE && c >= 0 && c < SIZE;

export function newState() {
  return { b: new Array(SIZE * SIZE).fill(0), turn: 1, last: null, result: null, passed: null, moves: 0 };
}

// (r,c) に p を置いたと仮定したとき、方向 (dr,dc) の連の長さと、空いている端の数
function run(b, r, c, p, dr, dc) {
  let len = 1, ends = 0;
  let y = r + dr, x = c + dc;
  while (inside(y, x) && b[y * SIZE + x] === p) { len++; y += dr; x += dc; }
  if (inside(y, x) && b[y * SIZE + x] === 0) ends++;
  y = r - dr; x = c - dc;
  while (inside(y, x) && b[y * SIZE + x] === p) { len++; y -= dr; x -= dc; }
  if (inside(y, x) && b[y * SIZE + x] === 0) ends++;
  return { len, ends };
}

function wins(b, r, c, p) {
  return DIRS.some(([dr, dc]) => run(b, r, c, p, dr, dc).len >= 5);
}

export function play(s, r, c) {
  if (s.result || !inside(r, c) || s.b[r * SIZE + c] !== 0) return null;
  const b = s.b.slice();
  b[r * SIZE + c] = s.turn;
  const moves = s.moves + 1;
  const next = { b, turn: opp(s.turn), last: r * SIZE + c, result: null, passed: null, moves };
  if (wins(b, r, c, s.turn)) next.result = s.turn === 1 ? 'black' : 'white';
  else if (moves === SIZE * SIZE) next.result = 'draw';
  return next;
}

export function hints() { return new Set(); }

// 連の点数。両端が空いている連を高く評価する
function lineScore(len, ends, own) {
  if (len >= 5) return own ? 100000 : 10000;
  if (ends === 0) return 0;
  if (len === 4) return own ? 900 : 800;
  if (len === 3) return ends === 2 ? (own ? 300 : 200) : (own ? 20 : 15);
  if (len === 2) return ends === 2 ? (own ? 10 : 8) : 2;
  return 0;
}

function near(b, r, c) {
  let n = 0;
  for (let y = r - 2; y <= r + 2; y++) for (let x = c - 2; x <= c + 2; x++) {
    if (inside(y, x) && b[y * SIZE + x] !== 0) n++;
  }
  return n;
}

export function cpuMove(s, rng = Math.random) {
  const me = s.turn, you = opp(me);
  if (s.moves === 0) return [7, 7];
  let best = -1, top = [];
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
    if (s.b[r * SIZE + c] !== 0) continue;
    let sc = near(s.b, r, c);
    for (const [dr, dc] of DIRS) {
      const a = run(s.b, r, c, me, dr, dc), o = run(s.b, r, c, you, dr, dc);
      sc += lineScore(a.len, a.ends, true) + lineScore(o.len, o.ends, false);
    }
    if (sc > best) { best = sc; top = [[r, c]]; } else if (sc === best) top.push([r, c]);
  }
  return top.length ? top[Math.floor(rng() * top.length)] : null;
}
