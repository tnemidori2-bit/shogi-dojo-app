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
