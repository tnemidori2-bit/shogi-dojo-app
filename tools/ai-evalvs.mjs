// 評価だけを変えた2つの設定を、同じ探索で対戦させる： node evalvs.mjs '<A の重み(JSON)>' '<B の重み(JSON)>' <局数> [深さ] [時間ms]
import { readFileSync } from 'node:fs';
import { startGame, playMove } from '../src/shogi/game.js';
import { legalMoves } from '../src/shogi/engine.js';
import * as AI from '../src/shogi/ai.js';
const pieces = Object.fromEntries(JSON.parse(readFileSync(new URL('../public/data/pieces.json', import.meta.url))).pieces.map(p => [p.id, p]));
function seeded(seed) { let s = seed; return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; }; }
const [aj, bj, count = 8, depth = 3, time = 500] = process.argv.slice(2);
const mk = (j) => ({ ...AI.EW_OLD, ...JSON.parse(j) });
const cfgOf = (j) => ({ depth: Number(depth), time: Number(time), noise: 6, random: 0, quiesce: 3, exact: false, book: 0, ew: mk(j) });
const A = cfgOf(aj), B = cfgOf(bj);
let aw = 0, bw = 0, dr = 0;
for (let i = 0; i < Number(count); i++) {
  const aSente = i % 2 === 0;
  const rng = seeded(900 + Math.floor(i / 2)); // 同じ序盤で、先手後手を入れかえる
  let g = startGame('none', pieces);
  while (!g.result && g.history.length < 200) {
    let m;
    if (g.history.length < 6) { const ms = legalMoves(g.board, g.hands, g.turn, pieces); m = ms[Math.floor(rng() * ms.length)]; }
    else m = AI.chooseMove(g, ((g.turn === 0) === aSente) ? A : B, rng, null);
    if (!m) { g = { ...g, result: { type: 'nomove', winner: 1 - g.turn } }; break; }
    g = playMove(g, m);
  }
  const w = g.result?.winner;
  const aSide = aSente ? 0 : 1;
  if (w === undefined) dr++; else if (w === aSide) aw++; else bw++;
}
console.log(`A ${aw} - ${bw} B  (引分/未了 ${dr})   A=${aj}  B=${bj}`);
