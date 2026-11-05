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

// 簡単なCPU：石を取れるなら取る／アタリの自分の石を逃がす／それ以外は石の近くのランダムな手。自分の目は埋めない
export function cpuMove(s, rng = Math.random) {
  const me = s.turn;
  const cands = [];
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
    const t = tryPlay(s, r, c);
    if (!t) continue;
    let sc = t.captured * 100;
    const g = group(t.b, r, c);
    // アタリ（呼吸点1）の自分の石につながる手は、呼吸点が増えるなら加点
    for (const [dy, dx] of NB) {
      const y = r + dy, x = c + dx;
      if (inside(y, x) && s.b[y * SIZE + x] === me && group(s.b, y, x).libs === 1 && g.libs >= 2) sc += 60;
    }
    // 相手の石をアタリにする手
    for (const [dy, dx] of NB) {
      const y = r + dy, x = c + dx;
      if (inside(y, x) && t.b[y * SIZE + x] === opp(me) && group(t.b, y, x).libs === 1) sc += 20;
    }
    // 自分の目（まわりが全部自分の石か盤の外）は埋めない
    const own = NB.every(([dy, dx]) => !inside(r + dy, c + dx) || s.b[(r + dy) * SIZE + c + dx] === me);
    if (own) continue;
    // 石が近いほど少し加点。端すぎる場所は少し減点
    let near = 0;
    for (let y = r - 2; y <= r + 2; y++) for (let x = c - 2; x <= c + 2; x++) if (inside(y, x) && s.b[y * SIZE + x]) near++;
    sc += Math.min(near, 6) + (r === 0 || c === 0 || r === SIZE - 1 || c === SIZE - 1 ? -3 : 0) + rng() * 2;
    cands.push({ r, c, sc });
  }
  const sc = score(s.b);
  const ahead = me === 1 ? sc.black > sc.white + KOMI : sc.white + KOMI > sc.black;
  if (!cands.length || (s.passes === 1 && ahead) || s.moves > 120) return null; // null = パス
  const best = Math.max(...cands.map((x) => x.sc));
  const m = cands.find((x) => x.sc === best);
  return [m.r, m.c];
}
