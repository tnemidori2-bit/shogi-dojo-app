// 五目並べのルール（画面に依存しない）。石は 0=空き, 1=黒, 2=白。連珠の禁じ手は無し
export const SIZE = 15;
const DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]];
const opp = (p) => 3 - p;
const inside = (r, c) => r >= 0 && r < SIZE && c >= 0 && c < SIZE;

export function newState() {
  return { b: new Array(SIZE * SIZE).fill(0), turn: 1, last: null, result: null, passed: null, moves: 0 };
}

// (r,c) に p を置いたと仮定したとき、方向 (dr,dc) の連の長さと、空いている端の数
export function run(b, r, c, p, dr, dc) {
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

// (r,c) に me が置いたときの点数（自分の連と、相手を止める価値）
function evalCell(b, r, c, me) {
  const you = opp(me);
  let sc = near(b, r, c);
  for (const [dr, dc] of DIRS) {
    const a = run(b, r, c, me, dr, dc), o = run(b, r, c, you, dr, dc);
    sc += lineScore(a.len, a.ends, true) + lineScore(o.len, o.ends, false);
  }
  return sc;
}

// (r,c) に p が置いたときの、p 自身の攻めの点数だけ（相手を止める価値は含めない）
function attackCell(b, r, c, p) {
  let sc = 0;
  for (const [dr, dc] of DIRS) { const a = run(b, r, c, p, dr, dc); sc += lineScore(a.len, a.ends, true); }
  return sc;
}

function emptyCells(b, onlyNear) {
  const out = [];
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
    if (b[r * SIZE + c] === 0 && (!onlyNear || near(b, r, c) > 0)) out.push([r, c]);
  }
  return out;
}

const pick = (arr, rng) => arr[Math.floor(rng() * arr.length)];

// そこに置くと p が5つ並ぶ場所
function fiveCells(b, cells, p) {
  return cells.filter(([r, c]) => DIRS.some(([dr, dc]) => run(b, r, c, p, dr, dc).len >= 5));
}

// CPU。level 1=石の近くにでたらめ 2=5つ並べる・相手の5つ止めだけする 3=点数評価（ときどきうっかり）
//      4=点数評価 5=点数評価＋相手の返し手を1手読む
export function cpuMove(s, rng = Math.random, level = 4) {
  const me = s.turn, you = opp(me);
  if (s.moves === 0) return [7, 7];
  const cells = emptyCells(s.b, true);
  if (!cells.length) { const all = emptyCells(s.b, false); return all.length ? pick(all, rng) : null; }
  if (level <= 1) return pick(cells, rng);
  if (level === 2) {
    const win = fiveCells(s.b, cells, me);
    if (win.length) return pick(win, rng);
    const block = fiveCells(s.b, cells, you);
    return block.length ? pick(block, rng) : pick(cells, rng);
  }
  const scored = cells.map(([r, c]) => ({ r, c, sc: evalCell(s.b, r, c, me) }));
  if (level === 3) {
    if (rng() < 0.4) return pick(cells, rng); // ときどき、うっかり別の場所に打つ
    const top = Math.max(...scored.map((x) => x.sc));
    const m = pick(scored.filter((x) => x.sc === top), rng);
    return [m.r, m.c];
  }
  if (level === 4) {
    const top = Math.max(...scored.map((x) => x.sc));
    const m = pick(scored.filter((x) => x.sc === top), rng);
    return [m.r, m.c];
  }
  // level 5: 点数の高い候補を何手か選び、置いたあとの相手の最良の返し手を引いて比べる
  scored.sort((a, b) => b.sc - a.sc);
  let best = null;
  for (const x of scored.slice(0, 10)) {
    if (x.sc >= 100000) return [x.r, x.c]; // 自分の5つ
    const b2 = s.b.slice(); b2[x.r * SIZE + x.c] = me;
    let reply = 0;
    for (const [r, c] of emptyCells(b2, true)) reply = Math.max(reply, attackCell(b2, r, c, you));
    const v = x.sc - 0.9 * reply + rng();
    if (!best || v > best.v) best = { r: x.r, c: x.c, v };
  }
  return [best.r, best.c];
}
