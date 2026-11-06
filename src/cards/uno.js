// UNO（4人：人が0番、CPUが1〜3番）。色か数字・記号が同じ札を出す。スキップ・リバース・ドロー2・ワイルド・ワイルドドロー4。
// かんたんにするため、ドローの重ね出しは無し、ワイルドドロー4のチャレンジも無し。引いた札が出せるなら、すぐ出してよい
export const COLORS = ['R', 'Y', 'G', 'B'];
import { shuffle } from './sevens.js';
export { shuffle };

export function makeDeck() {
  const d = [];
  for (const c of COLORS) {
    d.push({ c, v: 0 });
    for (let n = 1; n <= 9; n++) d.push({ c, v: n }, { c, v: n });
    for (const v of ['skip', 'rev', 'd2']) d.push({ c, v }, { c, v });
  }
  for (let i = 0; i < 4; i++) d.push({ c: 'W', v: 'w' }, { c: 'W', v: 'w4' });
  return d;
}

export function newGame(rng = Math.random) {
  const deck = shuffle(makeDeck(), rng);
  const hands = [0, 1, 2, 3].map(() => deck.splice(0, 7));
  let first = deck.findIndex((c) => typeof c.v === 'number');
  const top = deck.splice(first, 1)[0];
  return { deck, discard: [top], hands, turn: 0, dir: 1, color: top.c, winner: null, drew: null, log: null };
}

export const top = (s) => s.discard[s.discard.length - 1];
export const canPlay = (s, c) => c.c === 'W' || c.c === s.color || c.v === top(s).v;
export const playable = (s, p) => s.hands[p].filter((c) => canPlay(s, c) && (s.drew === null || s.drew === c));
const next = (s, from, steps = 1) => ((from + s.dir * steps) % 4 + 4) % 4;

function drawCards(s, p, n) {
  for (let i = 0; i < n; i++) {
    if (!s.deck.length) {
      const keep = s.discard.pop();
      s.deck = shuffle(s.discard, Math.random);
      s.discard = [keep];
      if (!s.deck.length) return;
    }
    s.hands[p].push(s.deck.pop());
  }
}

const clone = (s) => ({ ...s, deck: s.deck.slice(), discard: s.discard.slice(), hands: s.hands.map((h) => h.slice()) });

// 札を出す。ワイルドは color（R/Y/G/B）を決める。出せなければ null
export function play(s, p, card, color) {
  if (s.winner !== null || s.turn !== p) return null;
  const i = s.hands[p].indexOf(card);
  if (i < 0 || !canPlay(s, card) || (s.drew !== null && s.drew !== card)) return null;
  if (card.c === 'W' && !COLORS.includes(color)) return null;
  const n = clone(s);
  n.hands[p].splice(i, 1);
  n.discard.push(card);
  n.color = card.c === 'W' ? color : card.c;
  n.drew = null;
  n.log = { p, card, color: n.color };
  if (!n.hands[p].length) { n.winner = p; return n; }
  let t = next(n, p);
  if (card.v === 'rev') { n.dir = -n.dir; t = next(n, p); }
  if (card.v === 'skip') t = next(n, p, 2);
  if (card.v === 'd2') { drawCards(n, t, 2); t = next(n, t); }
  if (card.v === 'w4') { drawCards(n, t, 4); t = next(n, t); }
  n.turn = t;
  return n;
}

// 山札から1枚引く。出せない札なら、そのままパス。出せる札なら、そのターンのうちに出してよい（出さずにパスもできる）
export function draw(s, p) {
  if (s.winner !== null || s.turn !== p || s.drew !== null || playable(s, p).length) return null;
  const n = clone(s);
  drawCards(n, p, 1);
  const c = n.hands[p][n.hands[p].length - 1];
  n.log = { p, draw: true };
  if (c && canPlay(n, c)) n.drew = c; else n.turn = next(n, p);
  return n;
}

// 引いた札を出さずにパス
export function passAfterDraw(s, p) {
  if (s.winner !== null || s.turn !== p || s.drew === null) return null;
  return { ...s, drew: null, turn: next(s, p), log: { p, pass: true } };
}

// CPU：次の人の手札が少ないときは、ドロー2・スキップ・ワイルドドロー4を優先。ふだんは色のそろう数字を優先し、ワイルドは最後に取っておく
export function cpuChoose(s, p, rng = Math.random) {
  const cards = playable(s, p);
  if (!cards.length) return null;
  const nxt = s.hands[next(s, p)].length;
  const rank = (c) => {
    if (c.c === 'W') return c.v === 'w4' ? (nxt <= 2 ? 6 : 0) : 1;
    if (['d2', 'skip', 'rev'].includes(c.v)) return nxt <= 2 ? 5 : 3;
    return c.c === s.color ? 4 : 2;
  };
  const best = Math.max(...cards.map(rank));
  const pool = cards.filter((c) => rank(c) === best);
  const card = pool[Math.floor(rng() * pool.length)];
  let color = null;
  if (card.c === 'W') {
    const cnt = { R: 0, Y: 0, G: 0, B: 0 };
    for (const h of s.hands[p]) if (h.c !== 'W') cnt[h.c]++;
    color = COLORS.reduce((a, b) => (cnt[b] > cnt[a] ? b : a), COLORS[Math.floor(rng() * 4)]);
  }
  return { card, color };
}
