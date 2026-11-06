// スピード（2人：人が0番、CPUが1番）。順番は無く、同時に打つ。山札は2つ、手札から「となりの数」（A と K もとなり）を重ねる
// ならべ方：52枚を 25枚ずつ（手札4＋引く山21）と、場の山に1枚ずつ。手札がなくなる（引く山もなくなる）と勝ち
export const HAND = 4;
export { shuffle, SUITS, suitColor, rankLabel } from './sevens.js';
import { shuffle } from './sevens.js';

export function newGame(rng = Math.random) {
  const deck = [];
  for (let s = 0; s < 4; s++) for (let r = 1; r <= 13; r++) deck.push({ s, r });
  const d = shuffle(deck, rng);
  const mk = () => { const cards = d.splice(0, 25); return { hand: cards.slice(0, HAND), draw: cards.slice(HAND) }; };
  const players = [mk(), mk()];
  return { piles: [[d.pop()], [d.pop()]], players, winner: null, flips: 0 };
}

export const fits = (card, top) => { const d = Math.abs(card.r - top.r); return d === 1 || d === 12; };
export const top = (s, i) => s.piles[i][s.piles[i].length - 1];

// 手札の i 番目を、場の山 pile に出す。出せなければ null
export function play(s, p, i, pile) {
  if (s.winner !== null) return null;
  const card = s.players[p].hand[i];
  if (!card || !fits(card, top(s, pile))) return null;
  const players = s.players.map((x) => ({ hand: x.hand.slice(), draw: x.draw.slice() }));
  const piles = s.piles.map((x) => x.slice());
  players[p].hand.splice(i, 1);
  piles[pile].push(card);
  while (players[p].hand.length < HAND && players[p].draw.length) players[p].hand.push(players[p].draw.pop());
  const n = { ...s, players, piles };
  if (!players[p].hand.length && !players[p].draw.length) n.winner = p;
  return n;
}

export function movesFor(s, p) {
  const out = [];
  s.players[p].hand.forEach((c, i) => [0, 1].forEach((pile) => { if (fits(c, top(s, pile))) out.push({ i, pile }); }));
  return out;
}
export const stuck = (s) => s.winner === null && !movesFor(s, 0).length && !movesFor(s, 1).length;

// どちらも出せないとき：それぞれ、引く山のいちばん上を場にひらく（人は左、CPUは右の山）。引く山が空なら手札から
export function flip(s) {
  const players = s.players.map((x) => ({ hand: x.hand.slice(), draw: x.draw.slice() }));
  const piles = s.piles.map((x) => x.slice());
  for (const p of [0, 1]) {
    const x = players[p];
    const c = x.draw.length ? x.draw.pop() : x.hand.pop();
    if (c) piles[p].push(c);
  }
  const n = { ...s, players, piles, flips: s.flips + 1 };
  for (const p of [0, 1]) if (!players[p].hand.length && !players[p].draw.length && n.winner === null) n.winner = p;
  return n;
}

export const remaining = (s, p) => s.players[p].hand.length + s.players[p].draw.length;
