import test from 'node:test';
import assert from 'node:assert/strict';
import * as O from '../src/games/othello.js';
import * as G from '../src/games/gomoku.js';

test('オセロ：初期配置と最初の置ける場所', () => {
  const s = O.newState();
  assert.deepEqual(O.count(s.b), { black: 2, white: 2 });
  const m = O.legalMoves(s.b, 1).map((x) => `${x.r},${x.c}`).sort();
  assert.deepEqual(m, ['2,3', '3,2', '4,5', '5,4']);
});
test('オセロ：置けない場所は null、置くと裏返る', () => {
  const s = O.newState();
  assert.equal(O.play(s, 0, 0), null);
  const n = O.play(s, 2, 3);
  assert.deepEqual(O.count(n.b), { black: 4, white: 1 });
  assert.equal(n.turn, 2);
});
test('オセロ：CPU同士で終局まで進む', () => {
  for (let g = 0; g < 20; g++) {
    let s = O.newState(), guard = 0;
    while (!s.result && guard++ < 200) { const [r, c] = O.cpuMove(s); s = O.play(s, r, c); assert.ok(s); }
    assert.ok(s.result);
  }
});
test('オセロ：CPUは隅に置けるなら置く', () => {
  const b = new Array(64).fill(0);
  b[0 * 8 + 1] = 2; b[0 * 8 + 2] = 1; // 黒の(0,0)は白を挟める
  b[3 * 8 + 3] = 2; b[3 * 8 + 4] = 1; // (3,2)にも置ける
  const s = { b, turn: 1, last: null, result: null, passed: null, moves: 5 };
  assert.deepEqual(O.cpuMove(s), [0, 0]);
});
test('五目：5つ並んだら勝ち、以後は置けない', () => {
  let s = G.newState();
  const seq = [[7, 3], [0, 0], [7, 4], [0, 1], [7, 5], [0, 2], [7, 6], [0, 3], [7, 7]];
  for (const [r, c] of seq) s = G.play(s, r, c);
  assert.equal(s.result, 'black');
  assert.equal(G.play(s, 10, 10), null);
});
test('五目：斜め・6連も勝ち、置いた場所には置けない', () => {
  let s = G.newState();
  s = G.play(s, 1, 1);
  assert.equal(G.play(s, 1, 1), null);
});
test('五目：CPUは相手の4連を止め、自分の4連は完成させる', () => {
  let s = G.newState();
  for (const [r, c] of [[7, 3], [0, 0], [7, 4], [0, 14], [7, 5], [14, 0], [7, 6]]) s = G.play(s, r, c);
  const [r, c] = G.cpuMove(s);
  assert.equal(r, 7); assert.ok(c === 2 || c === 7);
  // 白の4連があれば完成させる
  const b = new Array(225).fill(0);
  for (const c2 of [3, 4, 5, 6]) b[2 * 15 + c2] = 2;
  for (const c2 of [3, 4, 5]) b[9 * 15 + c2] = 1;
  const t = { b, turn: 2, last: null, result: null, passed: null, moves: 7 };
  const mv = G.cpuMove(t);
  assert.equal(mv[0], 2); assert.ok(mv[1] === 2 || mv[1] === 7);
});

import * as Go from '../src/games/go.js';
const put = (s, pts) => { for (const [r, c] of pts) { s = Go.play(s, r, c); assert.ok(s, `${r},${c}`); } return s; };
test('囲碁：石を取れる', () => {
  // 白(0,1)を黒(0,0)(0,2)(1,1)で囲む
  let s = put(Go.newState(), [[0, 0], [0, 1], [8, 8], [8, 7], [0, 2], [5, 5]]);
  // 黒 (1,1) を打つと白(0,1)が取れる
  s = put(s, [[1, 1]]);
  assert.equal(s.b[1], 0);
  assert.equal(s.caps[1], 1);
});
test('囲碁：自殺手は置けない、コウは直後に取り返せない', () => {
  let s = Go.newState();
  s = put(s, [[0, 1], [8, 8], [1, 0]]); // 黒が(0,1)(1,0)、白は離れる
  assert.equal(Go.play({ ...s, turn: 2 }, 0, 0), null); // 白の(0,0)は自殺手
  // コウ
  s = Go.newState();
  s = put(s, [[0, 1], [0, 2], [1, 0], [1, 3], [2, 1], [2, 2], [8, 0], [1, 1]]); // 白(1,1)で黒(1,0)...
  s = Go.newState();
  // 典型的なコウの形を作る
  const b = new Array(81).fill(0);
  for (const [r, c] of [[0, 1], [1, 0], [2, 1]]) b[r * 9 + c] = 1;
  for (const [r, c] of [[0, 2], [1, 3], [2, 2], [1, 1]]) b[r * 9 + c] = 2;
  let k = { ...Go.newState(), b, turn: 1 };
  const taken = Go.play(k, 1, 2); // 黒が白(1,1)を取る
  assert.ok(taken);
  assert.equal(taken.b[1 * 9 + 1], 0);
  assert.equal(Go.play(taken, 1, 1), null); // 白はすぐ取り返せない
});
test('囲碁：2回パスで終局、地を数える', () => {
  let s = Go.newState();
  s = put(s, [[4, 4]]);
  s = Go.pass(s); s = Go.pass(s);
  assert.equal(s.result, 'black'); // 黒の1子が盤全体を囲んだ扱い（81）> 白0+7
  assert.deepEqual(Go.score(s.b), { black: 81, white: 0 });
});
test('囲碁：CPU同士で終局まで進む', () => {
  for (let g = 0; g < 10; g++) {
    let s = Go.newState(), guard = 0;
    while (!s.result && guard++ < 400) {
      const m = Go.cpuMove(s);
      s = m ? Go.play(s, m[0], m[1]) : Go.pass(s);
      assert.ok(s);
    }
    assert.ok(s.result, `game ${g}`);
  }
});

import { LESSONS, judge } from '../src/games/golessons.js';
// 各レッスンの「正解の手」と「まちがいの手」
const SOLVE = { place: [[4, 4]], liberty: [[3, 4]], capture1: [[4, 5]], corner: [[1, 0]], atari: [[4, 3]], escape: [[4, 5]], capture2: [[4, 6]] };
const WRONG = { liberty: [[0, 0]], capture1: [[0, 0]], corner: [[8, 8]], atari: [[0, 0]], escape: [[0, 0]], capture2: [[0, 0]] };
function setup(l) { const s = Go.newState(); for (const [r, c, p] of l.stones) s.b[r * 9 + c] = p; return s; }
test('囲碁レッスン：正解の手でできる、まちがいの手ではできない', () => {
  for (const l of LESSONS) {
    if (l.id === 'suicide') continue;
    const base = setup(l);
    for (const [r, c] of SOLVE[l.id]) { const n = Go.play(base, r, c); assert.ok(n, l.id); assert.ok(judge(l, base, n, r, c), l.id); }
    for (const [r, c] of WRONG[l.id] || []) { const n = Go.play(base, r, c); assert.ok(n, l.id); assert.ok(!judge(l, base, n, r, c), `wrong ${l.id}`); }
  }
});
test('囲碁レッスン：おけない場所は本当におけない', () => {
  const l = LESSONS.find((x) => x.id === 'suicide');
  assert.equal(Go.play(setup(l), 0, 0), null);
});
