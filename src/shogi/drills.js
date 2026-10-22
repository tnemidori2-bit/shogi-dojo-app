// ドリルの問題を作る（画面に依存しない）。乱数を差し替えられるので、Node でも確かめられる。
import { SIZE, movesFor, applyMove } from './rules.js';

const rnd = (rng, n) => Math.floor(rng() * n);
const pick = (rng, a) => a[rnd(rng, a.length)];
const emptyBoard = () => Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
const parsePool = (s) => (s.startsWith('+') ? { t: s.slice(1), p: true } : { t: s });
const same = (a, b) => a.x === b.x && a.y === b.y;

function randomFree(rng, board) {
  for (let i = 0; i < 200; i++) {
    const x = rnd(rng, SIZE), y = rnd(rng, SIZE);
    if (!board[y][x]) return { x, y };
  }
  return null;
}
function place(board, at, t, s, p) {
  board[at.y][at.x] = p ? { t, s, p: true } : { t, s };
}

const ENEMY_POOL = ['fu', 'fu', 'kyo', 'kei', 'gin', 'kin', 'kaku', 'hi'];

// drill: { type, pool }。返り値: { type, board, from, answers:[{x,y}], legal:[{x,y}], piece }
export function makeQuestion(drill, pieces, rng = Math.random) {
  for (let attempt = 0; attempt < 1000; attempt++) {
    const board = emptyBoard();
    const spec = parsePool(pick(rng, drill.pool));
    const from = randomFree(rng, board);
    place(board, from, spec.t, 0, spec.p);

    if (drill.type === 'moves') {
      for (let i = rnd(rng, 3); i > 0; i--) { const a = randomFree(rng, board); place(board, a, 'fu', 0); } // 自分の歩（ふさがれる）
      for (let i = 1 + rnd(rng, 3); i > 0; i--) { const a = randomFree(rng, board); place(board, a, pick(rng, ['fu', 'kin', 'gin']), 1); } // 敵の駒（取れる）
      const answers = movesFor(board, from.x, from.y, pieces);
      if (answers.length >= 2 && answers.length <= 12) return { type: 'moves', board, from, answers, legal: answers, piece: spec };
    } else if (drill.type === 'capture') {
      const n = 3 + rnd(rng, 3);
      for (let i = 0; i < n; i++) { const a = randomFree(rng, board); place(board, a, pick(rng, ENEMY_POOL), 1); }
      const moves = movesFor(board, from.x, from.y, pieces);
      const answers = moves.filter((m) => board[m.y][m.x]); // 敵の駒がいる行き先＝取れる
      if (answers.length >= 1 && answers.length <= n - 1) return { type: 'capture', board, from, answers, legal: moves, piece: spec };
    } else if (drill.type === 'check') {
      const k = randomFree(rng, board);
      place(board, k, 'gyoku', 1);
      for (let i = rnd(rng, 3); i > 0; i--) { const a = randomFree(rng, board); place(board, a, 'fu', 1); }
      const moves = movesFor(board, from.x, from.y, pieces);
      if (moves.some((m) => same(m, k))) continue; // 最初から王手になっている問題は避ける
      const answers = moves.filter((to) => {
        const nb = applyMove(board, from, to);
        return movesFor(nb, to.x, to.y, pieces).some((m) => same(m, k));
      });
      if (answers.length >= 1 && answers.length < moves.length) return { type: 'check', board, from, answers, legal: moves, piece: spec };
    }
  }
  throw new Error('問題が作れません: ' + JSON.stringify(drill));
}

// 答え合わせ。moves は選んだ全マス、capture と check は選んだ1マス
export function judge(q, picked) {
  const has = (arr, c) => arr.some((a) => same(a, c));
  if (q.type === 'moves') {
    const missed = q.answers.filter((a) => !has(picked, a));
    const extra = picked.filter((p) => !has(q.answers, p));
    return { ok: missed.length === 0 && extra.length === 0, missed, extra };
  }
  const ok = has(q.answers, picked);
  return { ok, missed: ok ? [] : q.answers, extra: ok ? [] : [picked] };
}

// 連続正解の数え方。results: 'ok' | 'hint' | 'ng' の並び。ヒントを使った正解は数えず、途切れもしない。
export function applyStreak(rec, results) {
  const out = { ...{ streak: 0, best: 0, stars: 0, plays: 0, correct: 0 }, ...rec };
  for (const r of results) {
    if (r === 'ng') out.streak = 0;
    else if (r === 'ok') { out.streak++; out.correct++; out.best = Math.max(out.best, out.streak); }
    else out.correct++;
  }
  out.plays++;
  out.stars = starsOf(out.best);
  return out;
}

// れんぞく せいかい 3 / 5 / 8 で ★1 / ★2 / ★3
export const STAR_STEPS = [3, 5, 8];
export const starsOf = (best) => STAR_STEPS.filter((n) => best >= n).length;
