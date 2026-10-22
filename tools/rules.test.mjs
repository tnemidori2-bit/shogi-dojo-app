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
test('平手: 飛は先手が2八（右）・角は8八（左）、後手は飛が8二・角が2二', () => {
  const b = initialBoard();
  assert.deepEqual([b[7][1].t, b[7][7].t], ['kaku', 'hi']);
  assert.deepEqual([b[1][1].t, b[1][7].t], ['hi', 'kaku']);
  assert.ok(b[7].every((c) => !c || c.s === 0) && b[1].every((c) => !c || c.s === 1));
});
test('平手: 先手の角は最初は動けない、飛は横にだけ動ける', () => {
  assert.deepEqual(movesFor(initialBoard(), 1, 7, pieces), []);
  assert.deepEqual(at(movesFor(initialBoard(), 7, 7, pieces)), ['2,7', '3,7', '4,7', '5,7', '6,7', '8,7']);
});
test('平手: 先手の銀・金・桂の初手', () => {
  const b = initialBoard();
  assert.deepEqual(at(movesFor(b, 2, 8, pieces)), ['2,7', '3,7']); // 銀（左隣の飛の場所は自分の駒）
  assert.deepEqual(at(movesFor(b, 3, 8, pieces)), ['2,7', '3,7', '4,7']); // 金
  assert.deepEqual(movesFor(b, 1, 8, pieces), []); // 桂は前の2ますが自分の歩
});
test('7六歩のあと角道が開き、敵の歩まで届いて取れる', () => {
  const b = applyMove(initialBoard(), { x: 2, y: 6 }, { x: 2, y: 5 });
  const m = at(movesFor(b, 1, 7, pieces));
  assert.ok(m.includes('2,6') && m.includes('6,2')); // 6二でなく、敵の歩（3三）まで
  assert.ok(!m.includes('7,1'));
});
test('飛は敵の駒までで止まり、取れる', () => {
  const b = initialBoard();
  b[6][7] = null; // 2筋の歩をどける
  const m = at(movesFor(b, 7, 7, pieces));
  assert.ok(m.includes('7,2')); // 敵の歩を取れる
  assert.ok(!m.includes('7,1')); // その先（敵の角）へは行けない
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

// ---- ドリル ----
import { makeQuestion, judge, applyStreak, starsOf } from '../src/shogi/drills.js';
const drillDir = new URL('../public/data/drills/', import.meta.url);
const drillIds = JSON.parse(readFileSync(new URL('index.json', drillDir))).drills;

// 再現できる乱数
function seeded(seed) { let s = seed; return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; }; }

for (const id of drillIds) {
  test(`ドリル ${id}: 問題が作れて、答えが正しい（500問）`, () => {
    const drill = JSON.parse(readFileSync(new URL(`${id}.json`, drillDir)));
    assert.ok(drill.pool.every((p) => pieces[p.replace('+', '')]));
    const rng = seeded(12345);
    for (let i = 0; i < 500; i++) {
      const q = makeQuestion(drill, pieces, rng);
      assert.ok(q.answers.length >= 1);
      assert.ok(judge(q, q.type === 'moves' ? q.answers : q.answers[0]).ok);
      if (q.type === 'moves') assert.ok(!judge(q, []).ok);
      else {
        // 答えでない選び方があり、それを選ぶと不正解（とれる問題は取れない敵の駒、王手は王手にならない合法手）
        const isAns = (m) => q.answers.some((a) => a.x === m.x && a.y === m.y);
        let wrong;
        if (q.type === 'capture') {
          q.board.forEach((r, y) => r.forEach((c, x) => { if (c && c.s === 1 && !isAns({ x, y })) wrong = { x, y }; }));
        } else wrong = q.legal.find((m) => !isAns(m));
        assert.ok(wrong && !judge(q, wrong).ok);
      }
    }
  });
}
test('ドリル: 王手の問題は、最初から王手になっていない', () => {
  const rng = seeded(7);
  const drill = { type: 'check', pool: ['kyo', 'kei', 'gin', 'kin', 'kaku', 'hi', '+kaku', '+hi'] };
  for (let i = 0; i < 300; i++) {
    const q = makeQuestion(drill, pieces, rng);
    let king = null;
    q.board.forEach((r, y) => r.forEach((c, x) => { if (c && c.t === 'gyoku') king = { x, y }; }));
    assert.ok(!movesFor(q.board, q.from.x, q.from.y, pieces).some((m) => m.x === king.x && m.y === king.y));
  }
});
test('連続正解: 途切れたら0、ヒントは数えず途切れもしない、★は3・5・8', () => {
  let r = applyStreak(null, ['ok', 'ok', 'ok', 'ng', 'ok']);
  assert.equal(r.best, 3); assert.equal(r.streak, 1); assert.equal(r.stars, 1);
  r = applyStreak(r, ['ok', 'hint', 'ok', 'ok', 'ok']);
  assert.equal(r.streak, 5); assert.equal(r.best, 5); assert.equal(r.stars, 2); assert.equal(r.plays, 2);
  assert.deepEqual([2, 3, 4, 5, 7, 8].map(starsOf), [0, 1, 1, 2, 2, 3]);
});
