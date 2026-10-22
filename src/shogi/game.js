// 1局の進行を管理する（画面に依存しない）。盤・持ち駒・手番・手の記録・勝ち負け・千日手。
import { initialBoard } from './rules.js';
import { applyFull, legalMoves, inCheck } from './engine.js';

// 駒落ち：上手（後手）から取りのぞく駒の位置 [x,y]。下手（先手）は人。駒落ちでは上手が先に指す。
export const HANDICAPS = {
  none: { label: 'なし', removed: [] },
  kyo: { label: '香落ち', removed: [[8, 0]] },
  kaku: { label: '角落ち', removed: [[7, 1]] },
  hi: { label: '飛車落ち', removed: [[1, 1]] },
  two: { label: '二枚落ち', removed: [[1, 1], [7, 1]] },
};
export const MAX_PLIES = 400;

export const posKey = (board, hands, turn) =>
  turn + '|' + board.map((r) => r.map((c) => (c ? c.t + c.s + (c.p ? '+' : '') : '.')).join(',')).join('/')
  + '|' + [0, 1].map((s) => Object.keys(hands[s]).sort().map((t) => t + hands[s][t]).join('')).join('/');

export function newGame(handicap = 'none') {
  const board = initialBoard();
  for (const [x, y] of HANDICAPS[handicap].removed) board[y][x] = null;
  const hands = [{}, {}];
  const turn = handicap === 'none' ? 0 : 1;
  return { handicap, board, hands, turn, history: [], counts: { [posKey(board, hands, turn)]: 1 }, result: null };
}

// 手を指した新しい局面を返す。result: { type:'checkmate'|'resign'|'repetition'|'moves', winner?:0|1 }
export function playMove(game, move) {
  const side = game.turn;
  const r = applyFull(game.board, game.hands, move, side);
  const turn = 1 - side;
  const key = posKey(r.board, r.hands, turn);
  const counts = { ...game.counts, [key]: (game.counts[key] || 0) + 1 };
  const history = [...game.history, { move, side, before: { board: game.board, hands: game.hands }, check: false }];
  let result = null;
  const check = inCheck(r.board, turn, game.pieces);
  history[history.length - 1].check = check;
  if (legalMoves(r.board, r.hands, turn, game.pieces).length === 0) result = { type: 'checkmate', winner: side };
  else if (counts[key] >= 4) result = { type: 'repetition' };
  else if (history.length >= MAX_PLIES) result = { type: 'moves' };
  return { ...game, board: r.board, hands: r.hands, turn, history, counts, result, check };
}

export const resign = (game, side) => ({ ...game, result: { type: 'resign', winner: 1 - side } });

// 直前の n 手を取り消す（最初から指し直して作る）
export function undoMoves(game, n) {
  const keep = game.history.slice(0, Math.max(0, game.history.length - n)).map((h) => h.move);
  let g = { ...newGame(game.handicap), pieces: game.pieces };
  for (const m of keep) g = playMove(g, m);
  return g;
}

export function startGame(handicap, pieces) {
  return { ...newGame(handicap), pieces, check: false };
}
