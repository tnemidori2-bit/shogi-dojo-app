// つめしょうぎの問題集を作る：  node tools/make-tsume.mjs
// 乱数で局面を作り、探索で「ちょうど N 手で詰む」ものだけを残して JSON に書き出す（結果は同じ乱数の種なら毎回同じ）。
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { SIZE } from '../src/shogi/rules.js';
import { legalMoves, winningMoves, winsIn, bestDefense, applyFull, inCheck, emptyHands } from '../src/shogi/engine.js';

const pieces = Object.fromEntries(JSON.parse(readFileSync(new URL('../public/data/pieces.json', import.meta.url))).pieces.map((p) => [p.id, p]));
const CODE = { fu: 'p', kyo: 'l', kei: 'n', gin: 's', kin: 'g', kaku: 'b', hi: 'r', gyoku: 'k' };

function seeded(seed) { let s = seed; return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; }; }
const rnd = (rng, n) => Math.floor(rng() * n);
const pick = (rng, a) => a[rnd(rng, a.length)];

function toRows(board) {
  return board.map((row) => row.map((c) => {
    if (!c) return '.';
    const ch = CODE[c.t];
    return (c.p ? '+' : '') + (c.s === 0 ? ch.toUpperCase() : ch);
  }).join(' '));
}
const moveJson = (m) => ({ from: m.from ? [m.from.x, m.from.y] : null, to: [m.to.x, m.to.y], drop: m.drop || null, promote: !!m.promote });

function randomPosition(rng) {
  const board = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
  const free = (x, y) => x >= 0 && x < SIZE && y >= 0 && y < SIZE && !board[y][x];
  const cols = (s, x) => board.some((r) => r[x] && r[x].s === s && r[x].t === 'fu' && !r[x].p);
  // 後手の玉：上の2だん
  const k = { x: rnd(rng, SIZE), y: rnd(rng, 2) };
  board[k.y][k.x] = { t: 'gyoku', s: 1 };
  // 後手の守り駒
  for (let i = rnd(rng, 4); i > 0; i--) {
    const x = k.x + rnd(rng, 5) - 2, y = k.y + rnd(rng, 4) - 1;
    const t = pick(rng, ['fu', 'fu', 'kin', 'gin', 'kyo', 'kei']);
    if (!free(x, y)) continue;
    if (t === 'fu' && cols(1, x)) continue;
    board[y][x] = { t, s: 1 };
  }
  // 先手の盤上の駒
  const onBoard = 1 + rnd(rng, 3);
  for (let i = 0; i < onBoard; i++) {
    const x = rnd(rng, SIZE), y = rnd(rng, 6);
    const t = pick(rng, ['kin', 'gin', 'kei', 'kyo', 'kaku', 'hi', 'fu', 'kin', 'gin']);
    if (!free(x, y)) continue;
    if (t === 'fu' && (y === 0 || cols(0, x))) continue;
    if (t === 'kyo' && y === 0) continue;
    if (t === 'kei' && y <= 1) continue;
    board[y][x] = { t, s: 0 };
  }
  // 先手の持ち駒
  const hands = emptyHands();
  for (let i = rnd(rng, 3); i > 0; i--) { const t = pick(rng, ['kin', 'gin', 'hi', 'kaku', 'kyo', 'kei', 'fu']); hands[0][t] = (hands[0][t] || 0) + 1; }
  const material = board.flat().filter((c) => c && c.s === 0).length + Object.values(hands[0]).reduce((a, b) => a + b, 0);
  const defenders = board.flat().filter((c) => c && c.s === 1 && c.t !== 'gyoku').length;
  if (material < 2) return null;
  if (inCheck(board, 1, pieces)) return null;
  return { board, hands, material, defenders };
}

function principalVariation(board, hands, k) {
  const line = [];
  let b = board, h = hands, left = k;
  while (left >= 1) {
    const win = winningMoves(b, h, left, pieces);
    const m = win[0];
    line.push(moveJson(m));
    const r = applyFull(b, h, m, 0);
    const replies = legalMoves(r.board, r.hands, 1, pieces);
    if (replies.length === 0) break;
    const rep = bestDefense(r.board, r.hands, left - 1, pieces);
    line.push(moveJson(rep));
    const q = applyFull(r.board, r.hands, rep, 1);
    b = q.board; h = q.hands; left--;
  }
  return line;
}

function make({ attackerMoves, count, seed, maxSolutions, label }) {
  const rng = seeded(seed);
  const found = [], seen = new Set();
  let tries = 0;
  const t0 = Date.now();
  while (found.length < count && tries < 3000000 && Date.now() - t0 < 20 * 60 * 1000) {
    tries++;
    const p = randomPosition(rng);
    if (!p) continue;
    const { board, hands } = p;
    const key = JSON.stringify(toRows(board)) + JSON.stringify(hands);
    if (seen.has(key)) continue;
    // 手数がちょうど N：それより短くは詰まない
    let ok = true;
    for (let j = 1; j < attackerMoves && ok; j++) if (winsIn(board, hands, j, pieces)) ok = false;
    if (!ok) continue;
    const win = winningMoves(board, hands, attackerMoves, pieces);
    if (win.length < 1 || win.length > maxSolutions) continue;
    seen.add(key);
    found.push({ board: toRows(board), hands: { sente: hands[0], gote: hands[1] }, difficulty: p.material + p.defenders, solutions: win.length, solution: principalVariation(board, hands, attackerMoves) });
    if (found.length % 5 === 0) console.error(`${label}: ${found.length}/${count}（${tries}局面を調べた）`);
  }
  console.error(`${label}: ${found.length}問できた（${tries}局面、${Math.round((Date.now() - t0) / 1000)}秒）`);
  found.sort((a, b) => a.difficulty - b.difficulty || a.solutions - b.solutions);
  return found;
}

mkdirSync(new URL('../public/data/tsume/', import.meta.url), { recursive: true });
const sets = [
  { id: 'mate1', title: '1手詰め', moves: 1, attackerMoves: 1, count: 30, seed: 20261022, maxSolutions: 2, starAt: [5, 15, 30] },
  { id: 'mate3', title: '3手詰め', moves: 3, attackerMoves: 2, count: 20, seed: 20261023, maxSolutions: 2, starAt: [3, 8, 20], unlock: { set: 'mate1', solved: 10 } },
];
const only = process.argv[2];
for (const s of sets) {
  if (only && only !== s.id) continue;
  const list = make({ ...s, label: s.id });
  const out = {
    id: s.id, title: s.title, moves: s.moves, starAt: s.starAt, ...(s.unlock ? { unlock: s.unlock } : {}),
    problems: list.map((p, i) => ({ id: `${s.id}-${String(i + 1).padStart(2, '0')}`, no: i + 1, board: p.board, hands: p.hands, solution: p.solution })),
  };
  writeFileSync(new URL(`../public/data/tsume/${s.id}.json`, import.meta.url), JSON.stringify(out, null, 1) + '\n');
}
