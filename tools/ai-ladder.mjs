// 強さの段階どうしの対戦： node ladder.mjs <強い側> <弱い側> <局数> <開始番号>  （新しい ai.js の LEVELS どうし）
import { readFileSync } from 'node:fs';
import { startGame, playMove } from '../src/shogi/game.js';
import { legalMoves } from '../src/shogi/engine.js';
import * as AI from '../src/shogi/ai.js';
const pieces = Object.fromEntries(JSON.parse(readFileSync(new URL('../public/data/pieces.json', import.meta.url))).pieces.map(p => [p.id, p]));
function seeded(seed) { let s = seed; return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; }; }
const [hi, lo, count = 4, start = 0] = process.argv.slice(2);
const cfg = (n) => ({ ...AI.LEVELS[n], book: 0 });
let hw = 0, lw = 0, dr = 0;
for (let k = 0; k < Number(count); k++) {
  const i = k + Number(start);
  const hiSente = i % 2 === 0;
  const rng = seeded(700 + Math.floor(i / 2));
  let g = startGame('none', pieces);
  while (!g.result && g.history.length < 220) {
    let m;
    if (g.history.length < 4) { const ms = legalMoves(g.board, g.hands, g.turn, pieces); m = ms[Math.floor(rng() * ms.length)]; }
    else m = AI.chooseMove(g, ((g.turn === 0) === hiSente) ? cfg(hi) : cfg(lo), rng, null);
    if (!m) { g = { ...g, result: { type: 'nomove', winner: 1 - g.turn } }; break; }
    g = playMove(g, m);
  }
  const w = g.result?.winner, hiSide = hiSente ? 0 : 1;
  if (w === undefined) dr++; else if (w === hiSide) hw++; else lw++;
}
console.log(`${hi} ${hw} - ${lw} ${lo}  (引分/未了 ${dr})  開始${start} ${count}局`);
