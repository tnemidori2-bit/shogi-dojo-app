// 持ち駒・打つ手・王手・詰みまでを扱うルール。画面に依存しない。
// 手 move = { from:{x,y}|null, to:{x,y}, drop:駒id|null, promote:bool }。side 0=先手（攻め）, 1=後手（玉）。
// hands[side] = { 駒id: 数 }
import { SIZE, movesFor, canPromote, mustPromote, inside } from './rules.js';

export const HAND_ORDER = ['hi', 'kaku', 'kin', 'gin', 'kei', 'kyo', 'fu'];
export const emptyHands = () => [{}, {}];

export function findKing(board, side) {
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    const c = board[y][x];
    if (c && c.s === side && c.t === 'gyoku') return { x, y };
  }
  return null;
}

// (x,y) に by 側の駒の利きがあるか（敵の駒がいるマスは「取れる」ので利きに入る）
export function isAttacked(board, x, y, by, pieces) {
  for (let py = 0; py < SIZE; py++) for (let px = 0; px < SIZE; px++) {
    const c = board[py][px];
    if (!c || c.s !== by) continue;
    if (movesFor(board, px, py, pieces).some((m) => m.x === x && m.y === y)) return true;
  }
  return false;
}

export function inCheck(board, side, pieces) {
  const k = findKing(board, side);
  return k ? isAttacked(board, k.x, k.y, 1 - side, pieces) : false;
}

const cloneHands = (h) => [{ ...h[0] }, { ...h[1] }];

// 手を指した結果 { board, hands }。取った駒は（成りを戻して）持ち駒に入る
export function applyFull(board, hands, move, side) {
  const b = board.map((r) => r.slice());
  const h = cloneHands(hands);
  if (move.drop) {
    b[move.to.y][move.to.x] = { t: move.drop, s: side };
    h[side][move.drop] -= 1;
    if (h[side][move.drop] === 0) delete h[side][move.drop];
  } else {
    const piece = b[move.from.y][move.from.x];
    const cap = b[move.to.y][move.to.x];
    if (cap) h[side][cap.t] = (h[side][cap.t] || 0) + 1;
    b[move.to.y][move.to.x] = move.promote ? { ...piece, p: true } : piece;
    b[move.from.y][move.from.x] = null;
  }
  return { board: b, hands: h };
}

// 打てるマスか：二歩・行きどころのない駒を除く
function dropOk(board, t, side, x, y) {
  const far = side === 0 ? y : SIZE - 1 - y; // 敵の最奥から数えた段（0が最奥）
  if (t === 'fu' || t === 'kyo') { if (far === 0) return false; }
  if (t === 'kei' && far <= 1) return false;
  if (t === 'fu') {
    for (let yy = 0; yy < SIZE; yy++) {
      const c = board[yy][x];
      if (c && c.s === side && c.t === 'fu' && !c.p) return false;
    }
  }
  return true;
}

// 合法手の一覧。opts.checksOnly=true なら、相手に王手をかける手だけ。
// opts.skipUchifu=true は、打ち歩詰めの判定の中で無限に呼び合わないための印。
export function legalMoves(board, hands, side, pieces, opts = {}) {
  const out = [];
  const enemy = 1 - side;
  const ek = opts.checksOnly ? findKing(board, enemy) : null;
  const consider = (move) => {
    const r = applyFull(board, hands, move, side);
    if (inCheck(r.board, side, pieces)) return; // 自分の玉が取られる手は指せない
    if (opts.checksOnly && !inCheck(r.board, enemy, pieces)) return;
    if (move.drop === 'fu' && !opts.skipUchifu && inCheck(r.board, enemy, pieces)) {
      if (legalMoves(r.board, r.hands, enemy, pieces, { skipUchifu: true }).length === 0) return; // 打ち歩詰め
    }
    out.push(move);
  };
  // 盤の上の駒
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    const c = board[y][x];
    if (!c || c.s !== side) continue;
    for (const to of movesFor(board, x, y, pieces)) {
      const from = { x, y };
      if (canPromote(board, from, to, pieces)) {
        // mustPromote は先手視点の判定なので、後手のときは上下を反転して使う
        const must = side === 0 ? mustPromote(board, from, to) : mustPromoteGote(c, to);
        if (!must) consider({ from, to, drop: null, promote: false });
        consider({ from, to, drop: null, promote: true });
      } else consider({ from, to, drop: null, promote: false });
    }
  }
  // 持ち駒を打つ
  for (const t of HAND_ORDER) {
    if (!hands[side][t]) continue;
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
      if (board[y][x] || !dropOk(board, t, side, x, y)) continue;
      if (ek && !dropAttacks(board, t, side, x, y, ek, pieces)) continue; // 王手にならない打ち方は、早めに捨てる
      consider({ from: null, to: { x, y }, drop: t, promote: false });
    }
  }
  return out;
}

function mustPromoteGote(c, to) {
  const far = SIZE - 1 - to.y;
  if (c.t === 'fu' || c.t === 'kyo') return far === 0;
  if (c.t === 'kei') return far <= 1;
  return false;
}

// そこに駒を打ったら、相手の玉に利きが届くか（打ってすぐの王手かどうかの、安い下調べ）
function dropAttacks(board, t, side, x, y, king, pieces) {
  board[y][x] = { t, s: side };
  const hit = movesFor(board, x, y, pieces).some((m) => m.x === king.x && m.y === king.y);
  board[y][x] = null;
  return hit;
}

export const isCheckmate = (board, hands, side, pieces) =>
  inCheck(board, side, pieces) && legalMoves(board, hands, side, pieces).length === 0;

// ---- つめしょうぎの探索（攻めは先手 side=0、受けは後手 side=1）----

// 攻めの手 m が、あと k 手（この手を含む）で詰ませる手か
export function validAttack(board, hands, m, k, pieces) {
  const r = applyFull(board, hands, m, 0);
  if (!inCheck(r.board, 1, pieces)) return false;
  const replies = legalMoves(r.board, r.hands, 1, pieces);
  if (replies.length === 0) return true; // 詰み（打ち歩詰めは legalMoves が手から外している）
  if (k <= 1) return false;
  return replies.every((rep) => {
    const q = applyFull(r.board, r.hands, rep, 1);
    return winsIn(q.board, q.hands, k - 1, pieces);
  });
}

// 先手の番で、あと k 手以内に詰ませられるか
export function winsIn(board, hands, k, pieces) {
  return legalMoves(board, hands, 0, pieces, { checksOnly: true }).some((m) => validAttack(board, hands, m, k, pieces));
}

// あと k 手以内に詰ませる、最初の手の一覧
export function winningMoves(board, hands, k, pieces) {
  return legalMoves(board, hands, 0, pieces, { checksOnly: true }).filter((m) => validAttack(board, hands, m, k, pieces));
}

// 受けの返事：いちばん長く粘れる手を選ぶ（攻めの残り手数 k に対して）
export function bestDefense(board, hands, k, pieces) {
  const replies = legalMoves(board, hands, 1, pieces);
  let best = null, bestLen = -1;
  for (const rep of replies) {
    const q = applyFull(board, hands, rep, 1);
    let len = 1;
    while (len < k && !winsIn(q.board, q.hands, len, pieces)) len++;
    if (len > bestLen) { best = rep; bestLen = len; }
  }
  return best;
}

export const sameMove = (a, b) => a.drop === b.drop && a.promote === b.promote && a.to.x === b.to.x && a.to.y === b.to.y
  && ((!a.from && !b.from) || (a.from && b.from && a.from.x === b.from.x && a.from.y === b.from.y));

export { inside };
