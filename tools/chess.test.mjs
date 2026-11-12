import test from 'node:test';
import assert from 'node:assert/strict';
import { Chess, parseUci, chooseMove, fallbackMove, resultOf, squares, needsPromotion, BLUNDER_RATE } from '../src/games/chess.js';

const play = (c, ...moves) => moves.forEach((m) => c.move(m));

test('キャスリング：キング側とクイーン側が指せる', () => {
  const c = new Chess('r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1');
  const m = c.moves({ verbose: true }).map((x) => x.san);
  assert.ok(m.includes('O-O') && m.includes('O-O-O'));
  c.move('O-O');
  assert.equal(c.get('g1').type, 'k');
  assert.equal(c.get('f1').type, 'r');
});

test('アンパッサン：直前に2マス進んだポーンを斜めに取れる', () => {
  const c = new Chess();
  play(c, 'e4', 'a6', 'e5', 'd5');
  const ep = c.moves({ verbose: true }).find((m) => m.from === 'e5' && m.to === 'd6');
  assert.ok(ep && ep.flags.includes('e'));
  c.move({ from: 'e5', to: 'd6' });
  assert.equal(c.get('d5'), undefined); // 取られた側のポーンが消える
});

test('昇格：昇格が必要な手を見分け、クイーン・ナイトなどになれる', () => {
  const c = new Chess('8/P6k/8/8/8/8/8/K7 w - - 0 1');
  assert.equal(needsPromotion(c, 'a7', 'a8'), true);
  assert.equal(needsPromotion(c, 'a1', 'a2'), false);
  c.move({ from: 'a7', to: 'a8', promotion: 'n' });
  assert.equal(c.get('a8').type, 'n');
});

test('チェックメイト：フールズメイトで黒の勝ち', () => {
  const c = new Chess();
  play(c, 'f3', 'e5', 'g4', 'Qh4#');
  assert.deepEqual(resultOf(c), { kind: 'mate', winner: 'b' });
});

test('ステイルメイト：引き分け', () => {
  const c = new Chess('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1');
  assert.deepEqual(resultOf(c), { kind: 'stalemate', winner: null });
});

test('引き分け：同一局面3回・駒不足・50手', () => {
  const c = new Chess();
  play(c, 'Nf3', 'Nf6', 'Ng1', 'Ng8', 'Nf3', 'Nf6', 'Ng1', 'Ng8');
  assert.equal(resultOf(c).kind, 'repetition');
  assert.equal(resultOf(new Chess('8/8/4k3/8/8/4K3/8/8 w - - 0 1')).kind, 'material');
  assert.equal(resultOf(new Chess('8/8/4k3/8/8/4K3/7R/8 w - - 100 80')).kind, 'fifty');
  assert.equal(resultOf(new Chess()), null);
});

test('squares：白視点は a1 が左下、黒視点は反転', () => {
  const w = squares(new Chess());
  assert.equal(w[0].square, 'a8'); assert.equal(w[56].square, 'a1'); assert.equal(w[60].piece.type, 'k');
  const b = squares(new Chess(), true);
  assert.equal(b[0].square, 'h1'); assert.equal(b[63].square, 'a8');
});

test('parseUci と chooseMove：エンジンの手を使う／うっかりを混ぜる／でたらめな手は捨てる', () => {
  assert.deepEqual(parseUci('e2e4'), { from: 'e2', to: 'e4', promotion: undefined });
  assert.equal(parseUci('(none)'), null);
  const c = new Chess();
  // rng が常に 0.99 → うっかりしない → エンジンの手
  assert.deepEqual(chooseMove(c, 'e2e4', () => 0.99), { from: 'e2', to: 'e4', promotion: undefined });
  // rng が 0 → うっかり（合法手の先頭）
  const m = chooseMove(c, 'e2e4', () => 0);
  assert.ok(c.moves({ verbose: true }).some((x) => x.from === m.from && x.to === m.to));
  // 合法でない手が来ても、必ず合法手を返す
  const bad = chooseMove(c, 'e2e5', () => 0.99);
  assert.ok(c.moves({ verbose: true }).some((x) => x.from === bad.from && x.to === bad.to));
  assert.equal(chooseMove(new Chess('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1'), 'h8h7'), null);
});

test('fallbackMove：いつも合法手を返す（エンジンなしの代わり）', () => {
  for (let i = 0; i < 50; i++) {
    const c = new Chess();
    for (let k = 0; k < 40 && !c.isGameOver(); k++) {
      const m = fallbackMove(c);
      assert.ok(m);
      c.move(m);
    }
  }
});

test('入門級の設定：うっかり率は0より大きく1より小さい', () => {
  assert.ok(BLUNDER_RATE > 0 && BLUNDER_RATE < 1);
});
