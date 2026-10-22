import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initialBoard, movesFor, applyMove } from '../src/shogi/rules.js';

const pieces = Object.fromEntries(JSON.parse(readFileSync(new URL('../public/data/pieces.json', import.meta.url))).pieces.map((p) => [p.id, p]));
const at = (m) => m.map((t) => `${t.x},${t.y}`).sort();

test('平手: 駒の数は40', () => {
  assert.equal(initialBoard().flat().filter(Boolean).length, 40);
});
test('平手: 先手の歩は1ます前だけ', () => {
  assert.deepEqual(at(movesFor(initialBoard(), 4, 6, pieces)), ['4,5']);
});
test('平手: 後手の歩は下へ進む', () => {
  assert.deepEqual(at(movesFor(initialBoard(), 4, 2, pieces)), ['4,3']);
});
test('平手: 先手の角は最初は動けない、飛は横にだけ動ける', () => {
  assert.deepEqual(movesFor(initialBoard(), 7, 7, pieces), []);
  assert.deepEqual(at(movesFor(initialBoard(), 1, 7, pieces)), ['0,7', '2,7', '3,7', '4,7', '5,7', '6,7']);
});
test('平手: 先手の銀・金・桂の初手', () => {
  const b = initialBoard();
  assert.deepEqual(at(movesFor(b, 2, 8, pieces)), ['2,7', '3,7']); // 銀（左隣の飛の場所は自分の駒）
  assert.deepEqual(at(movesFor(b, 3, 8, pieces)), ['2,7', '3,7', '4,7']); // 金
  assert.deepEqual(movesFor(b, 1, 8, pieces), []); // 桂は前の2ますが自分の歩
});
test('歩を進めたあと角道が開く', () => {
  const b = applyMove(initialBoard(), { x: 6, y: 6 }, { x: 6, y: 5 });
  const m = at(movesFor(b, 7, 7, pieces));
  assert.ok(m.includes('6,6') && m.includes('2,2')); // 敵の歩まで届いて取れる
  assert.ok(!m.includes('1,1'));
});
test('飛は敵の駒までで止まり、取れる', () => {
  const b = initialBoard();
  b[6][1] = null; // 縦の歩をどける
  const m = at(movesFor(b, 1, 7, pieces));
  assert.ok(m.includes('1,2')); // 敵の歩を取れる
  assert.ok(!m.includes('1,1')); // その先へは行けない
});
