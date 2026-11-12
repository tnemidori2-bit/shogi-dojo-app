// 局面を SFEN（将棋エンジンに局面を伝える文字の形）に変える。画面に依存しない。
// 盤は board[y][x]（y=0 が後手側の一番上、x=0 が左端＝9筋）。駒は {t, s:0=先手|1=後手, p:成り} か null。
const LETTER = { fu: 'P', kyo: 'L', kei: 'N', gin: 'S', kin: 'G', kaku: 'B', hi: 'R', gyoku: 'K' };
const HAND_ORDER = ['hi', 'kaku', 'kin', 'gin', 'kei', 'kyo', 'fu']; // SFENの持ち駒は R B G S N L P の順

export function toSfen(board, hands, turn, ply = 1) {
  const rows = board.map((row) => {
    let out = '', blank = 0;
    for (const c of row) {
      if (!c) { blank++; continue; }
      if (blank) { out += blank; blank = 0; }
      const ch = LETTER[c.t];
      out += (c.p ? '+' : '') + (c.s === 0 ? ch : ch.toLowerCase());
    }
    return out + (blank || '');
  });
  let hand = '';
  for (const side of [0, 1]) {
    for (const t of HAND_ORDER) {
      const n = (hands[side] && hands[side][t]) || 0;
      if (!n) continue;
      const ch = side === 0 ? LETTER[t] : LETTER[t].toLowerCase();
      hand += (n > 1 ? n : '') + ch;
    }
  }
  return `${rows.join('/')} ${turn === 0 ? 'b' : 'w'} ${hand || '-'} ${ply}`;
}

// 対局のはじめの局面から、エンジンに送る「position」の文字を作る。usiMoves はこれまでの手（"7g7f" など）
export function positionCommand(initial, usiMoves) {
  const base = `position sfen ${toSfen(initial.board, initial.hands, initial.turn)}`;
  return usiMoves.length ? `${base} moves ${usiMoves.join(' ')}` : base;
}
