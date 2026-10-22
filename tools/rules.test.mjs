import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initialBoard, parseBoard, movesFor, applyMove, canPromote, mustPromote, defOf, SIZE } from '../src/shogi/rules.js';

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

const lessonDir = new URL('../public/data/lessons/', import.meta.url);
const lessonIds = JSON.parse(readFileSync(new URL('index.json', lessonDir))).lessons;

// 先手の動きだけで目標に届くか、幅優先で探す（解があることの確認）
function solvable(lesson) {
  const goal = lesson.goal;
  const start = parseBoard(lesson.board);
  const key = (b, n) => JSON.stringify(b) + n;
  let frontier = [{ b: start, n: 0 }];
  const seen = new Set([key(start, 0)]);
  for (let depth = 0; depth < 12; depth++) {
    const next = [];
    for (const { b, n } of frontier) {
      for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
        const c = b[y][x];
        if (!c || c.s !== 0 || !lesson.allow.includes(c.t)) continue;
        for (const to of movesFor(b, x, y, pieces)) {
          const cap = !!b[to.y][to.x];
          const options = lesson.promote && canPromote(b, { x, y }, to, pieces)
            ? (mustPromote(b, { x, y }, to) ? [true] : [true, false]) : [false];
          for (const pr of options) {
            let m = n;
            if (goal.type === 'moves') m++; else if (goal.type === 'capture' && cap) m++; else if (goal.type === 'promote' && pr) m++;
            if (m >= goal.n) return depth + 1;
            const nb = applyMove(b, { x, y }, to, pr);
            const k = key(nb, m);
            if (!seen.has(k)) { seen.add(k); next.push({ b: nb, n: m }); }
          }
        }
      }
    }
    frontier = next;
  }
  return 0;
}

for (const id of lessonIds) {
  test(`レッスン ${id}: 盤が正しく、目標に届く手順がある`, () => {
    const lesson = JSON.parse(readFileSync(new URL(`${id}.json`, lessonDir)));
    assert.equal(lesson.board.length, 9);
    assert.ok(lesson.board.every((r) => r.trim().split(/\s+/).length === 9));
    assert.ok(lesson.allow.every((t) => pieces[t]));
    const n = solvable(lesson);
    assert.ok(n > 0, `${id} は解けない`);
  });
}

test('成り: 成った角は馬、飛は龍の動きになる', () => {
  const b = parseBoard(['. . . . . . . . .','. . . . . . . . .','. . . . . . . . .','. . . . . . . . .','. . . . +B . . . .','. . . . . . . . .','. . . . . . . . .','. . . . . . . . .','. . . . . . . . .']);
  const m = at(movesFor(b, 4, 4, pieces));
  assert.ok(m.includes('4,3') && m.includes('5,4') && m.includes('0,0')); // 縦横1ます＋ななめ遠く
  assert.equal(defOf(b[4][4], pieces).kanji, '馬');
  const b2 = parseBoard(['. . . . . . . . .','. . . . . . . . .','. . . . . . . . .','. . . . . . . . .','. . . . +R . . . .','. . . . . . . . .','. . . . . . . . .','. . . . . . . . .','. . . . . . . . .']);
  const m2 = at(movesFor(b2, 4, 4, pieces));
  assert.ok(m2.includes('5,3') && m2.includes('4,0') && !m2.includes('6,2')); // ななめは1ますだけ
});
test('成り: 敵陣に入る・出るときだけ成れる。歩は最奥で必ず成る', () => {
  const b = parseBoard(['. . . . . . . . .','. . . . . . . . .','. . . . . . . . .','. . . . P . . . .','. . . . . . . . .','. . . . . . . . .','. . . . . . . . .','. . . . . . . . .','. . . . . . . . .']);
  assert.ok(canPromote(b, { x: 4, y: 3 }, { x: 4, y: 2 }, pieces));
  const g = parseBoard(['. . . . . . . . .','. . . . . . . . .','. . . . S . . . .','. . . . . . . . .','. . . . S . . . .','. . . . . . . . .','. . . . . . . . .','. . . . . . . . .','. . . . . . . . .']);
  assert.ok(canPromote(g, { x: 4, y: 2 }, { x: 3, y: 3 }, pieces)); // 敵陣から出るときも成れる
  assert.ok(!canPromote(g, { x: 4, y: 4 }, { x: 3, y: 3 }, pieces)); // 敵陣の外どうしでは成れない
  const c = parseBoard(['. . . . . . . . .','. . . . . . . . .','. . . . . . . . .','. . . . . . . . .','. . . . . . . . .','. . . . P . . . .','. . . . . . . . .','. . . . . . . . .','. . . . . . . . .']);
  assert.ok(!canPromote(c, { x: 4, y: 5 }, { x: 4, y: 4 }, pieces));
  const d = parseBoard(['. . . . . . . . .','. . . . P . . . .','. . . . . . . . .','. . . . . . . . .','. . . . . . . . .','. . . . . . . . .','. . . . . . . . .','. . . . . . . . .','. . . . . . . . .']);
  assert.ok(mustPromote(d, { x: 4, y: 1 }, { x: 4, y: 0 }));
  assert.ok(!mustPromote(c, { x: 4, y: 5 }, { x: 4, y: 4 }));
});
test('金と玉は成れない', () => {
  const b = parseBoard(['. . . . . . . . .','. . . . . . . . .','. . . . G . . . .','. . . . . . . . .','. . . . . . . . .','. . . . . . . . .','. . . . . . . . .','. . . . . . . . .','. . . . . . . . .']);
  assert.ok(!canPromote(b, { x: 4, y: 2 }, { x: 4, y: 1 }, pieces));
});
