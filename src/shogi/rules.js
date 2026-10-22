// 将棋のルール本体。画面に依存しない（Node でもテストできる）。
// 盤は board[y][x]。y=0 が後手側の一番上、x=0 が左端。駒は {t:駒id, s:0=先手|1=後手, p:true=成り} か null。

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


// 盤面の文字列（9行・空白区切り）から盤を作る。大文字=先手、小文字=後手、'+'つき=成り、'.'=空き
export function parseBoard(rows) {
  return rows.map((row) => row.trim().split(/\s+/).map((c) => {
    if (c === '.') return null;
    const promoted = c.startsWith('+');
    const ch = promoted ? c.slice(1) : c;
    const cell = { t: CODE[ch.toLowerCase()], s: ch === ch.toLowerCase() ? 1 : 0 };
    if (promoted) cell.p = true;
    return cell;
  }));
}

export function initialBoard() {
  return parseBoard(HIRATE);
}

export const inside = (x, y) => x >= 0 && x < SIZE && y >= 0 && y < SIZE;

// 駒の動き（成っていれば成りの動き）。kanji も一緒に返る
export function defOf(cell, pieces) {
  const base = pieces[cell.t];
  return cell.p ? { ...base, ...base.promote } : base;
}

// 敵陣（相手側の3だん）
export const inZone = (y, side) => (side === 0 ? y <= 2 : y >= SIZE - 3);

// この動きで「成れる」か
export function canPromote(board, from, to, pieces) {
  const cell = board[from.y][from.x];
  if (!cell || cell.p || !pieces[cell.t].promote) return false;
  return inZone(from.y, cell.s) || inZone(to.y, cell.s);
}

// 成らないと、次に動けなくなる（行きどころのない駒）か
export function mustPromote(board, from, to) {
  const cell = board[from.y][from.x];
  const far = cell.s === 0 ? to.y : SIZE - 1 - to.y; // 敵の一番奥から数えた段（0が最奥）
  if (cell.t === 'fu' || cell.t === 'kyo') return far === 0;
  if (cell.t === 'kei') return far <= 1;
  return false;
}

// (x,y) にいる駒が動ける行き先の一覧 [{x,y}]。pieces は pieces.json を id で引ける形。
export function movesFor(board, x, y, pieces) {
  const cell = board[y][x];
  if (!cell) return [];
  const def = defOf(cell, pieces);
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

export function applyMove(board, from, to, promote = false) {
  const next = board.map((r) => r.slice());
  next[to.y][to.x] = promote ? { ...next[from.y][from.x], p: true } : next[from.y][from.x];
  next[from.y][from.x] = null;
  return next;
}
