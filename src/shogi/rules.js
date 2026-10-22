// 将棋のルール本体。画面に依存しない（Node でもテストできる）。
// 盤は board[y][x]。y=0 が後手側の一番上、x=0 が左端。駒は {t:駒id, s:0=先手|1=後手} か null。

export const SIZE = 9;

const HIRATE = [
  'l n s g k g s n l',
  '. b . . . . . r .',
  'p p p p p p p p p',
  '. . . . . . . . .',
  '. . . . . . . . .',
  '. . . . . . . . .',
  'P P P P P P P P P',
  '. R . . . . . B .',
  'L N S G K G S N L',
];
const CODE = { p: 'fu', l: 'kyo', n: 'kei', s: 'gin', g: 'kin', b: 'kaku', r: 'hi', k: 'gyoku' };

export function initialBoard() {
  return HIRATE.map((row) => row.split(' ').map((c) => {
    if (c === '.') return null;
    const lower = c === c.toLowerCase();
    return { t: CODE[c.toLowerCase()], s: lower ? 1 : 0 };
  }));
}

export const inside = (x, y) => x >= 0 && x < SIZE && y >= 0 && y < SIZE;

// (x,y) にいる駒が動ける行き先の一覧 [{x,y}]。pieces は pieces.json を id で引ける形。
export function movesFor(board, x, y, pieces) {
  const cell = board[y][x];
  if (!cell) return [];
  const def = pieces[cell.t];
  const f = cell.s === 0 ? 1 : -1; // 後手は上下反転
  const out = [];
  for (const [dx, dy] of def.steps) {
    const nx = x + dx * f, ny = y + dy * f;
    if (!inside(nx, ny)) continue;
    const t = board[ny][nx];
    if (!t || t.s !== cell.s) out.push({ x: nx, y: ny });
  }
  for (const [dx, dy] of def.slides) {
    let nx = x + dx * f, ny = y + dy * f;
    while (inside(nx, ny)) {
      const t = board[ny][nx];
      if (t) { if (t.s !== cell.s) out.push({ x: nx, y: ny }); break; }
      out.push({ x: nx, y: ny });
      nx += dx * f; ny += dy * f;
    }
  }
  return out;
}

export function applyMove(board, from, to) {
  const next = board.map((r) => r.slice());
  next[to.y][to.x] = next[from.y][from.x];
  next[from.y][from.x] = null;
  return next;
}
