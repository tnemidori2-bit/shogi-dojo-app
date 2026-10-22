// 手順を「7g7f」のような短い書き方（USI）で持つための読み書き。画面に依存しない。
// 筋 file は 1〜9（左端が9筋）、段は a〜i（上が a）。x = 9 - file、y = 段の順番。
// 打つ手は「P*5e」。成りは行き先のあとに「+」。
import { SIZE, canPromote } from './rules.js';
import { legalMoves, sameMove } from './engine.js';

const CODE = { P: 'fu', L: 'kyo', N: 'kei', S: 'gin', G: 'kin', B: 'kaku', R: 'hi' };
const KANJI_NUM = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
const sq = (f, r) => ({ x: 9 - Number(f), y: r.charCodeAt(0) - 97 });

// USI の1手を、盤の上の手（move）に変える
export function parseUsi(usi) {
  if (usi[1] === '*') {
    return { from: null, to: sq(usi[2], usi[3]), drop: CODE[usi[0]], promote: false };
  }
  return { from: sq(usi[0], usi[1]), to: sq(usi[2], usi[3]), drop: null, promote: usi.endsWith('+') };
}

// 盤の上の手を、USI に戻す（テスト用）
export function toUsi(m) {
  const f = (p) => `${9 - p.x}${String.fromCharCode(97 + p.y)}`;
  if (m.drop) return `${Object.keys(CODE).find((k) => CODE[k] === m.drop)}*${f(m.to)}`;
  return f(m.from) + f(m.to) + (m.promote ? '+' : '');
}

// 「▲7六歩」「△同角」のような名前を作る。board は指す前の盤、prevTo は直前の手の行き先
export function moveLabel(move, board, side, pieces, prevTo) {
  const mark = side === 0 ? '▲' : '△';
  const dest = prevTo && prevTo.x === move.to.x && prevTo.y === move.to.y
    ? '同' : `${9 - move.to.x}${KANJI_NUM[move.to.y]}`;
  if (move.drop) return `${mark}${dest}${pieces[move.drop].kanji}打`;
  const c = board[move.from.y][move.from.x];
  const base = c.p ? pieces[c.t].promote.kanji : pieces[c.t].kanji;
  return `${mark}${dest}${base}${move.promote ? '成' : ''}`;
}

// 盤から、手が合法手の中にあるか調べて返す（なければ null）
export function findLegal(board, hands, side, pieces, move) {
  return legalMoves(board, hands, side, pieces).find((m) => sameMove(m, move)) || null;
}

export { SIZE, canPromote };
