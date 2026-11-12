import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { toSfen, positionCommand } from '../src/shogi/sfen.js';
import { newGame, playMove } from '../src/shogi/game.js';
import { toUsi, parseUsi } from '../src/shogi/usi.js';

const pieces = Object.fromEntries(JSON.parse(readFileSync(new URL('../public/data/pieces.json', import.meta.url), 'utf8')).pieces.map((p) => [p.id, p]));
const start = (h = 'none') => ({ ...newGame(h), pieces });

test('平手のはじめの局面', () => {
  const g = start();
  assert.equal(toSfen(g.board, g.hands, g.turn), 'lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1');
});

test('駒落ち：上手（後手）が先に指す。角落ち・二枚落ち', () => {
  const k = start('kaku'); assert.equal(toSfen(k.board, k.hands, k.turn), 'lnsgkgsnl/1r7/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL w - 1');
  const t = start('two'); assert.equal(toSfen(t.board, t.hands, t.turn), 'lnsgkgsnl/9/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL w - 1');
  const ky = start('kyo'); assert.equal(toSfen(ky.board, ky.hands, ky.turn), 'lnsgkgsn1/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL w - 1');
});

test('手を指したあと：持ち駒と成りが SFEN に出る（角交換）', () => {
  let g = start();
  for (const u of ['7g7f', '3c3d', '8h2b+', '3a2b']) g = playMove(g, parseUsi(u));
  assert.equal(toSfen(g.board, g.hands, g.turn), 'lnsgkg1nl/1r5s1/pppppp1pp/6p2/9/2P6/PP1PPPPPP/7R1/LNSGKGSNL b Bb 1');
});

test('持ち駒が複数・順番（飛角金銀桂香歩）', () => {
  const g = start();
  const hands = [{ fu: 3, hi: 1, kin: 2 }, { kaku: 1, kyo: 2 }];
  assert.match(toSfen(g.board, hands, 0), / b R2G3Pb2l 1$/);
});

test('position コマンド：初期局面＋手', () => {
  const g = start();
  assert.equal(positionCommand(g, []), 'position sfen lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1');
  assert.ok(positionCommand(g, ['7g7f', '3c3d']).endsWith(' moves 7g7f 3c3d'));
  assert.equal(toUsi(parseUsi('P*5e')), 'P*5e');
});
