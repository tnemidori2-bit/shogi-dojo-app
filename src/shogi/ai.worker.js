// AI の探索を、画面とは別のスレッドで行う（考えている間も画面が止まらない）
import { chooseMove, analyze } from './ai.js';
import { legalMoves } from './engine.js';
import { sameMove } from './engine.js';

self.onmessage = (e) => {
  const { id, type, pieces } = e.data;
  try {
    if (type === 'move') {
      const move = chooseMove({ ...e.data.game, pieces }, e.data.level, Math.random, e.data.book);
      self.postMessage({ id, type, move });
    } else if (type === 'hint') {
      const scored = analyze(e.data.game.board, e.data.game.hands, e.data.game.turn, pieces, { depth: 3, time: 1200, quiesce: 3 });
      self.postMessage({ id, type, move: scored.length ? scored[0].move : null });
    } else if (type === 'review') {
      // 自分の手ごとに、ほかの手と点を比べる。悪かった手の場所を見つける
      const out = [];
      e.data.entries.forEach((en, i) => {
        const scored = analyze(en.board, en.hands, en.side, pieces, { depth: 2, time: 700, quiesce: 2, exact: true });
        if (!scored.length) return;
        const best = scored[0];
        const played = scored.find((r) => sameMove(r.move, en.move));
        const loss = played ? best.score - played.score : 0;
        out.push({ index: en.index, loss, best: best.move, bestCaptures: !!(best.move.from && en.board[best.move.to.y][best.move.to.x]) });
        if (i % 4 === 3) self.postMessage({ id, type: 'progress', done: i + 1, total: e.data.entries.length });
      });
      self.postMessage({ id, type, out });
    }
  } catch (err) {
    self.postMessage({ id, type: 'error', message: String(err && err.message || err) });
  }
};
