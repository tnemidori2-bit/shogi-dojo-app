import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseBoard } from '../src/shogi/rules.js';
import { legalMoves, inCheck, validAttack, sameMove, findKing, applyFull } from '../src/shogi/engine.js';
import { startGame, playMove, undoMoves, resign, HANDICAPS, posKey, newGame } from '../src/shogi/game.js';
import { chooseMove, LEVELS } from '../src/shogi/ai.js';
import { parseUsi } from '../src/shogi/usi.js';

const pieces = Object.fromEntries(JSON.parse(readFileSync(new URL('../public/data/pieces.json', import.meta.url))).pieces.map((p) => [p.id, p]));
function seeded(seed) { let s = seed; return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; }; }
const count = (b) => b.flat().filter(Boolean).length;

test('駒落ち: 上手（後手）の駒だけが減り、上手が先に指す', () => {
  const none = newGame('none');
  assert.equal(count(none.board), 40); assert.equal(none.turn, 0);
  const expect = { kyo: 39, kaku: 39, hi: 39, two: 38 };
  for (const [k, n] of Object.entries(expect)) {
    const g = newGame(k);
    assert.equal(count(g.board), n, k);
    assert.equal(g.turn, 1, k + ': 駒落ちは上手が先');
    assert.equal(g.board.flat().filter((c) => c && c.s === 0).length, 20, k + ': 下手の駒は減らない');
  }
  // 角落ちで消えるのは後手の角、飛車落ちで消えるのは後手の飛
  assert.ok(!newGame('kaku').board.flat().some((c) => c && c.s === 1 && c.t === 'kaku'));
  assert.ok(!newGame('hi').board.flat().some((c) => c && c.s === 1 && c.t === 'hi'));
  assert.ok(!newGame('two').board.flat().some((c) => c && c.s === 1 && (c.t === 'hi' || c.t === 'kaku')));
  // 香落ちは、先手から見て右上（1一）の香
  assert.equal(newGame('kyo').board[0][8], null); assert.ok(newGame('kyo').board[0][0]);
});

test('対局: 手を指すと手番が替わり、記録が残る。玉は取れない', () => {
  let g = startGame('none', pieces);
  g = playMove(g, parseUsi('7g7f'));
  assert.equal(g.turn, 1); assert.equal(g.history.length, 1);
  g = playMove(g, parseUsi('3c3d'));
  assert.equal(g.turn, 0); assert.equal(g.result, null);
  assert.ok(legalMoves(g.board, g.hands, 0, pieces).every((m) => !(m.to.x === findKing(g.board, 1).x && m.to.y === findKing(g.board, 1).y)));
});

test('対局: 詰ませると、そこで終わる（頭金）', () => {
  const g0 = startGame('none', pieces);
  const board = parseBoard(['........k', '.........', '.......S.', '.........', '.........', '.........', '.........', '.........', '....K....'].map((r) => r.split('').join(' ')));
  let g = { ...g0, board, hands: [{ kin: 1 }, {}], turn: 0, history: [], counts: {} };
  g = playMove(g, { from: null, to: { x: 8, y: 1 }, drop: 'kin', promote: false });
  assert.deepEqual(g.result, { type: 'checkmate', winner: 0 });
});

test('対局: 同じ形が4回で千日手（引き分け）', () => {
  let g = startGame('none', pieces);
  const seq = ['2h3h', '8b7b', '3h2h', '7b8b']; // 飛が行って帰る（先手・後手）
  for (let i = 0; i < 3; i++) for (const u of seq) { if (!g.result) g = playMove(g, parseUsi(u)); }
  assert.equal(g.result?.type, 'repetition');
  assert.equal(g.result.winner, undefined);
});

test('対局: 待った（直前の手を取り消す）と、投了', () => {
  let g = startGame('none', pieces);
  for (const u of ['7g7f', '3c3d', '2g2f', '8c8d']) g = playMove(g, parseUsi(u));
  const back = undoMoves(g, 2);
  assert.equal(back.history.length, 2); assert.equal(back.turn, 0);
  assert.equal(posKey(back.board, back.hands, back.turn), posKey(undoMoves(g, 2).board, back.hands, 0));
  assert.deepEqual(resign(g, 0).result, { type: 'resign', winner: 1 });
});

test('AI: どの強さでも、合法手を返す（平手・駒落ち・途中の局面）', () => {
  const rng = seeded(1);
  for (const h of ['none', 'kaku', 'two']) {
    let g = startGame(h, pieces);
    for (let i = 0; i < 24 && !g.result; i++) {
      const level = ['weak', 'normal', 'strong'][i % 3];
      const m = chooseMove(g, level, rng);
      assert.ok(legalMoves(g.board, g.hands, g.turn, pieces).some((x) => sameMove(x, m)), `${h} ${i}手目 ${level}`);
      g = playMove(g, m);
    }
  }
});

test('AI: 「ふつう」「つよい」は、1手で詰む手を見つける（つめしょうぎ10問）', () => {
  const set = JSON.parse(readFileSync(new URL('../public/data/tsume/mate1.json', import.meta.url)));
  const g0 = startGame('none', pieces);
  for (const p of set.problems.slice(0, 10)) {
    const board = parseBoard(p.board);
    const hands = [{ ...p.hands.sente }, { ...p.hands.gote }];
    for (const level of ['normal', 'strong']) {
      const m = chooseMove({ ...g0, board, hands, turn: 0 }, level, seeded(3));
      // つめしょうぎの盤には後手の駒が玉しかなく、「動けない」形も勝ちとして選ぶことがある。どちらでも、相手が指せなくなる手
      const r = applyFull(board, hands, m, 0);
      assert.ok(validAttack(board, hands, m, 1, pieces) || legalMoves(r.board, r.hands, 1, pieces).length === 0, `${p.id} ${level}`);
    }
  }
});

test('AI: 強さの順（よわい < ふつう）— 数局指して、ふつうが勝ち越す', () => {
  let normalWins = 0;
  for (let i = 0; i < 4; i++) {
    const swap = i % 2 === 1;
    const lv = swap ? ['weak', 'normal'] : ['normal', 'weak'];
    const rng = seeded(100 + i);
    let g = startGame('none', pieces);
    while (!g.result && g.history.length < 200) g = playMove(g, chooseMove(g, lv[g.turn], rng));
    const w = g.result?.winner;
    if (w !== undefined && lv[w] === 'normal') normalWins++;
  }
  assert.ok(normalWins >= 3, `ふつうの勝ち: ${normalWins}/4`);
});

test('AI: 持ち時間の上限（つよい）を守る', () => {
  const g = startGame('none', pieces);
  const t = Date.now();
  chooseMove(g, 'strong', seeded(5));
  assert.ok(Date.now() - t < LEVELS.strong.time + 800);
});
