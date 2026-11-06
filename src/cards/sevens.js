// 七並べ（4人：人が0番、CPUが1〜3番）。最初に手札の7はぜんぶ場に出す。パスの回数に制限は無い。いちばん先に手札がなくなった人の勝ち
export const SUITS = ['♠', '♥', '♦', '♣'];
export const suitColor = (s) => (s === 1 || s === 2 ? 'red' : 'black');
export const rankLabel = (r) => ({ 1: 'A', 11: 'J', 12: 'Q', 13: 'K' }[r] || String(r));

export function shuffle(arr, rng = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

export function newGame(rng = Math.random) {
  const deck = [];
  for (let s = 0; s < 4; s++) for (let r = 1; r <= 13; r++) deck.push({ s, r });
  const d = shuffle(deck, rng);
  const hands = [[], [], [], []];
  d.forEach((c, i) => hands[i % 4].push(c));
  const board = [0, 1, 2, 3].map(() => new Array(13).fill(false));
  for (const h of hands) for (let i = h.length - 1; i >= 0; i--) if (h[i].r === 7) { board[h[i].s][6] = true; h.splice(i, 1); }
  for (const h of hands) h.sort((a, b) => a.s - b.s || a.r - b.r);
  return { board, hands, turn: 0, winner: null, lastPlay: null, passes: [0, 0, 0, 0] };
}

// 場に出せる札か
export function canPlay(board, c) {
  if (board[c.s][c.r - 1]) return false;
  return (c.r > 1 && board[c.s][c.r - 2]) || (c.r < 13 && board[c.s][c.r]);
}
export const playable = (s, p) => s.hands[p].filter((c) => canPlay(s.board, c));

function advance(s) {
  let t = s.turn;
  do { t = (t + 1) % 4; } while (!s.hands[t].length && t !== s.turn);
  s.turn = t;
}

// 札を出す。出せなければ null
export function play(s, p, card) {
  if (s.winner !== null || s.turn !== p) return null;
  const i = s.hands[p].findIndex((c) => c.s === card.s && c.r === card.r);
  if (i < 0 || !canPlay(s.board, card)) return null;
  const n = { ...s, board: s.board.map((r) => r.slice()), hands: s.hands.map((h) => h.slice()), passes: s.passes.slice() };
  n.hands[p].splice(i, 1);
  n.board[card.s][card.r - 1] = true;
  n.lastPlay = { p, card, pass: false };
  if (!n.hands[p].length) n.winner = p; else advance(n);
  return n;
}

// パス。出せる札があるときはできない
export function pass(s, p) {
  if (s.winner !== null || s.turn !== p || playable(s, p).length) return null;
  const n = { ...s, passes: s.passes.slice(), lastPlay: { p, card: null, pass: true } };
  n.passes[p]++;
  advance(n);
  return n;
}

// CPU：出せる札のうち、自分の手札の続きの札をひらける（となりの札を自分が持っている）ものを優先。なければ、でたらめ
export function cpuChoose(s, p, rng = Math.random) {
  const cards = playable(s, p);
  if (!cards.length) return null;
  const own = (c) => s.hands[p].some((h) => h.s === c.s && (h.r === c.r - 1 || h.r === c.r + 1));
  const good = cards.filter(own);
  const pool = good.length ? good : cards;
  return pool[Math.floor(rng() * pool.length)];
}
