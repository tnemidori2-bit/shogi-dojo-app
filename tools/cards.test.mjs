import test from 'node:test';
import assert from 'node:assert/strict';
import * as Se from '../src/cards/sevens.js';
import * as Sp from '../src/cards/speed.js';
import * as U from '../src/cards/uno.js';

test('七並べ：7は最初から場にあり、全員がCPUでも必ず終わる・52枚が保たれる', () => {
  for (let g = 0; g < 50; g++) {
    let s = Se.newGame(), n = 0;
    assert.ok([0, 1, 2, 3].every((su) => s.board[su][6]));
    while (s.winner === null && n++ < 1000) {
      const c = Se.cpuChoose(s, s.turn);
      const nx = c ? Se.play(s, s.turn, c) : Se.pass(s, s.turn);
      assert.ok(nx, 'stuck');
      s = nx;
    }
    assert.notEqual(s.winner, null);
    const placed = s.board.flat().filter(Boolean).length;
    assert.equal(placed + s.hands.reduce((a, h) => a + h.length, 0), 52);
  }
});
test('七並べ：となりでない札は出せない、出せる札があるときパスできない', () => {
  const s = Se.newGame();
  const bad = { s: 0, r: 1 };
  assert.equal(Se.canPlay(s.board, bad), false);
  const p = s.turn;
  if (Se.playable(s, p).length) assert.equal(Se.pass(s, p), null);
});
test('スピード：A と K はとなり、2人のCPUで必ず終わる・52枚が保たれる', () => {
  assert.ok(Sp.fits({ r: 1 }, { r: 13 }) && Sp.fits({ r: 5 }, { r: 6 }) && !Sp.fits({ r: 5 }, { r: 7 }));
  for (let g = 0; g < 30; g++) {
    let s = Sp.newGame(), n = 0;
    while (s.winner === null && n++ < 3000) {
      let moved = false;
      for (const p of [0, 1]) {
        if (s.winner !== null) break;
        const m = Sp.movesFor(s, p);
        if (m.length) { s = Sp.play(s, p, m[0].i, m[0].pile); moved = true; }
      }
      if (!moved) s = Sp.flip(s);
    }
    assert.notEqual(s.winner, null, `game ${g}`);
    const total = s.piles.flat().length + [0, 1].reduce((a, p) => a + Sp.remaining(s, p), 0);
    assert.equal(total, 52);
  }
});
test('UNO：デッキは108枚', () => { assert.equal(U.makeDeck().length, 108); });
test('UNO：4人のCPUで必ず終わる・カードの総数が保たれる', () => {
  for (let g = 0; g < 50; g++) {
    let s = U.newGame(), n = 0;
    while (s.winner === null && n++ < 3000) {
      const p = s.turn, ch = U.cpuChoose(s, p);
      let nx;
      if (ch) nx = U.play(s, p, ch.card, ch.color);
      else if (s.drew !== null) nx = U.passAfterDraw(s, p);
      else nx = U.draw(s, p);
      assert.ok(nx, 'illegal');
      s = nx;
    }
    assert.notEqual(s.winner, null, `game ${g}`);
    assert.equal(s.deck.length + s.discard.length + s.hands.reduce((a, h) => a + h.length, 0), 108);
  }
});
test('UNO：ドロー2は次の人が2枚引いて飛ばされる', () => {
  const s = U.newGame();
  s.color = 'R'; s.discard = [{ c: 'R', v: 3 }];
  const d2 = { c: 'R', v: 'd2' };
  s.hands[0].push(d2);
  const before = s.hands[1].length;
  const n = U.play(s, 0, d2);
  assert.equal(n.hands[1].length, before + 2);
  assert.equal(n.turn, 2);
});
test('UNO：色や数字が合わない札は出せない', () => {
  const s = U.newGame();
  s.color = 'R'; s.discard = [{ c: 'R', v: 3 }];
  const bad = { c: 'B', v: 5 };
  s.hands[0].push(bad);
  assert.equal(U.play(s, 0, bad), null);
});
