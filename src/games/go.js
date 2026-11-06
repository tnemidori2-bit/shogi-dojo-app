// 囲碁（9路盤）のルール。画面に依存しない。石は 0=空き, 1=黒, 2=白
// 取り・自殺手の禁止・コウ（直前の盤面に戻す手の禁止）・パス・中国式（盤上の石＋地）の数え方。コミは白に7目
export const SIZE = 9;
export const KOMI = 7;
const opp = (p) => 3 - p;
const inside = (r, c) => r >= 0 && r < SIZE && c >= 0 && c < SIZE;
const NB = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const key = (b) => b.join('');

export function newState() {
  return { b: new Array(SIZE * SIZE).fill(0), turn: 1, last: null, result: null, passed: null, moves: 0, passes: 0, prev: null, caps: { 1: 0, 2: 0 }, detail: '' };
}

// (r,c) の石がつながっているかたまりと、その呼吸点（となりの空き）の数
export function group(b, r, c) {
  const p = b[r * SIZE + c];
  const seen = new Set([r * SIZE + c]), libs = new Set(), stack = [[r, c]];
  while (stack.length) {
    const [y, x] = stack.pop();
    for (const [dy, dx] of NB) {
      const ny = y + dy, nx = x + dx;
      if (!inside(ny, nx)) continue;
      const i = ny * SIZE + nx;
      if (b[i] === 0) libs.add(i);
      else if (b[i] === p && !seen.has(i)) { seen.add(i); stack.push([ny, nx]); }
    }
  }
  return { stones: [...seen], libs: libs.size };
}

// 置いてみる。置けなければ null。取った石の数も返す
function tryPlay(s, r, c) {
  if (!inside(r, c) || s.b[r * SIZE + c] !== 0) return null;
  const me = s.turn, b = s.b.slice();
  b[r * SIZE + c] = me;
  let captured = 0;
  for (const [dy, dx] of NB) {
    const y = r + dy, x = c + dx;
    if (inside(y, x) && b[y * SIZE + x] === opp(me)) {
      const g = group(b, y, x);
      if (g.libs === 0) { for (const i of g.stones) b[i] = 0; captured += g.stones.length; }
    }
  }
  if (group(b, r, c).libs === 0) return null; // 自殺手
  if (s.prev && key(b) === s.prev) return null; // コウ
  return { b, captured };
}

export function play(s, r, c) {
  if (s.result) return null;
  const t = tryPlay(s, r, c);
  if (!t) return null;
  const caps = { ...s.caps, [s.turn]: s.caps[s.turn] + t.captured };
  return { b: t.b, turn: opp(s.turn), last: r * SIZE + c, result: null, passed: null, moves: s.moves + 1, passes: 0, prev: key(s.b), caps, detail: '' };
}

// 盤上の石＋その色だけに囲まれた空き。戻り値は { black, white }
export function score(b) {
  let black = 0, white = 0;
  const seen = new Set();
  for (let i = 0; i < b.length; i++) {
    if (b[i] === 1) black++;
    else if (b[i] === 2) white++;
    else if (!seen.has(i)) {
      const region = [], borders = new Set(), stack = [i];
      seen.add(i);
      while (stack.length) {
        const j = stack.pop(); region.push(j);
        const y = Math.floor(j / SIZE), x = j % SIZE;
        for (const [dy, dx] of NB) {
          const ny = y + dy, nx = x + dx;
          if (!inside(ny, nx)) continue;
          const k = ny * SIZE + nx;
          if (b[k] === 0) { if (!seen.has(k)) { seen.add(k); stack.push(k); } } else borders.add(b[k]);
        }
      }
      if (borders.size === 1) { if (borders.has(1)) black += region.length; else white += region.length; }
    }
  }
  return { black, white };
}

// パス。2回続けたら終局（盤上の死んだ石は、取りきってからパスする約束）
export function pass(s) {
  if (s.result) return null;
  const n = { ...s, turn: opp(s.turn), last: null, passed: null, passes: s.passes + 1, prev: key(s.b), moves: s.moves + 1 };
  if (n.passes >= 2) {
    const sc = score(s.b), w = sc.white + KOMI;
    n.result = sc.black > w ? 'black' : w > sc.black ? 'white' : 'draw';
    n.detail = `黒 ${sc.black} ・ 白 ${sc.white} + コミ ${KOMI} = ${w}`;
  }
  return n;
}

export function hints() { return new Set(); }

const ownEye = (b, r, c, me) => NB.every(([dy, dx]) => !inside(r + dy, c + dx) || b[(r + dy) * SIZE + c + dx] === me);
const edge = (r, c) => r === 0 || c === 0 || r === SIZE - 1 || c === SIZE - 1;

// 打てる手（自分の目を埋めない）の一覧。点数は、石を取る・アタリを逃がす・相手をアタリにする・近くに石がある、など
function candidates(s, rng, selfAtariCheck) {
  const me = s.turn, out = [];
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
    const t = tryPlay(s, r, c);
    if (!t || ownEye(s.b, r, c, me)) continue;
    let sc = t.captured * 100;
    const g = group(t.b, r, c);
    for (const [dy, dx] of NB) {
      const y = r + dy, x = c + dx;
      if (!inside(y, x)) continue;
      if (s.b[y * SIZE + x] === me && group(s.b, y, x).libs === 1 && g.libs >= 2) sc += 60; // アタリの自分の石を逃がす
      if (t.b[y * SIZE + x] === opp(me) && group(t.b, y, x).libs === 1) sc += 20; // 相手をアタリにする
    }
    if (selfAtariCheck && g.libs === 1 && t.captured === 0) sc -= 80; // 自分からアタリになる手は避ける
    let near = 0;
    for (let y = r - 2; y <= r + 2; y++) for (let x = c - 2; x <= c + 2; x++) if (inside(y, x) && s.b[y * SIZE + x]) near++;
    sc += Math.min(near, 6) + (edge(r, c) ? -3 : 0) + rng() * 2;
    out.push({ r, c, sc, t });
  }
  return out;
}

// 盤が決まったあと、でたらめに打ち進めて、me から見た勝ち（1）か負け（0）を返す
function playout(s, me, rng) {
  let cur = s;
  for (let n = 0; n < 90 && cur.passes < 2; n++) {
    let moved = false;
    for (let k = 0; k < 24 && !moved; k++) {
      const r = Math.floor(rng() * SIZE), c = Math.floor(rng() * SIZE);
      if (cur.b[r * SIZE + c] !== 0 || ownEye(cur.b, r, c, cur.turn)) continue;
      const nx = play(cur, r, c);
      if (nx) { cur = nx; moved = true; }
    }
    if (!moved) cur = pass(cur);
  }
  const sc = score(cur.b), w = sc.white + KOMI;
  return (me === 1 ? sc.black > w : w > sc.black) ? 1 : 0;
}

// CPU。level 1=でたらめ 2=石を取れるなら取る 3=取る・逃げる・アタリにする 4=3＋自分からアタリにならない
//      5=有力な手を、でたらめな打ち進めの勝率で選ぶ。null を返したらパス。ms は5の考える時間
export function cpuMove(s, rng = Math.random, level = 3, ms = 900) {
  const me = s.turn;
  const sc0 = score(s.b);
  const ahead = me === 1 ? sc0.black > sc0.white + KOMI : sc0.white + KOMI > sc0.black;
  if ((s.passes === 1 && ahead) || s.moves > 120) return null;
  if (level <= 2) {
    const all = candidates(s, rng, false);
    if (!all.length) return null;
    if (level === 2) { const cap = all.filter((x) => x.t.captured > 0); if (cap.length) { const m = cap.reduce((a, b) => (b.t.captured > a.t.captured ? b : a)); return [m.r, m.c]; } }
    const m = all[Math.floor(rng() * all.length)];
    return [m.r, m.c];
  }
  const cands = candidates(s, rng, level >= 4);
  if (!cands.length) return null;
  cands.sort((a, b) => b.sc - a.sc);
  if (level <= 4) return [cands[0].r, cands[0].c];
  const top = cands.slice(0, 10).map((x) => ({ ...x, win: 0, n: 0 }));
  const start = Date.now();
  for (let k = 0; Date.now() - start < ms || k < top.length * 2; k++) {
    const x = top[k % top.length];
    const ns = { b: x.t.b, turn: opp(me), last: null, result: null, passed: null, moves: s.moves + 1, passes: 0, prev: key(s.b), caps: s.caps, detail: '' };
    x.win += playout(ns, me, rng); x.n++;
    if (k > 4000) break;
  }
  // 勝率に、石を取る・逃げるなどの点を少し足して選ぶ
  const best = top.reduce((a, b) => (b.win / b.n + b.sc / 2000 > a.win / a.n + a.sc / 2000 ? b : a));
  return [best.r, best.c];
}
