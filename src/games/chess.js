import { Chess } from 'chess.js';

// チェスのルール判定は chess.js に任せる。ここは、画面とエンジンの間の小さな部品（画面にも通信にも触れない）
export { Chess };

// 入門級：エンジン（Stockfish）を最弱にしても入門者には強いので、この割合で「合法手からランダム」を指す。
// 数字を上げるほど弱くなる。実機で触って調整する
export const BLUNDER_RATE = 0.3;
export const ENGINE_DEPTH = 2;
export const ENGINE_SKILL = 0;

export const PIECE_NAMES = { p: 'ポーン', n: 'ナイト', b: 'ビショップ', r: 'ルーク', q: 'クイーン', k: 'キング' };

// "e7e8q" → { from, to, promotion }
export function parseUci(uci) {
  if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci || '')) return null;
  return { from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] };
}

// エンジンの手（uci）と、ときどきの「うっかり」手から、CPUが指す手を決める。
// 戻り値は chess.js の move に渡せる { from, to, promotion }。合法手が無ければ null
export function chooseMove(chess, uci, rng = Math.random, rate = BLUNDER_RATE) {
  const legal = chess.moves({ verbose: true });
  if (!legal.length) return null;
  const best = parseUci(uci);
  const ok = best && legal.find((m) => m.from === best.from && m.to === best.to && (m.promotion || '') === (best.promotion || ''));
  if (!ok || rng() < rate) {
    const pick = legal[Math.floor(rng() * legal.length)];
    return { from: pick.from, to: pick.to, promotion: pick.promotion };
  }
  return { from: ok.from, to: ok.to, promotion: ok.promotion };
}

// エンジンが使えないときの代わり：取れる駒があれば取る（高い駒を優先）。なければランダム
const VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
export function fallbackMove(chess, rng = Math.random) {
  const legal = chess.moves({ verbose: true });
  if (!legal.length) return null;
  const caps = legal.filter((m) => m.captured);
  const pool = caps.length && rng() < 0.7 ? caps.sort((a, b) => VALUE[b.captured] - VALUE[a.captured]).slice(0, 2) : legal;
  const m = pool[Math.floor(rng() * pool.length)];
  return { from: m.from, to: m.to, promotion: m.promotion };
}

// 対局の結果。続行中は null。{ kind: 'mate'|'stalemate'|'repetition'|'fifty'|'material'|'draw', winner: 'w'|'b'|null }
export function resultOf(chess) {
  if (chess.isCheckmate()) return { kind: 'mate', winner: chess.turn() === 'w' ? 'b' : 'w' };
  if (chess.isStalemate()) return { kind: 'stalemate', winner: null };
  if (chess.isThreefoldRepetition()) return { kind: 'repetition', winner: null };
  if (chess.isInsufficientMaterial()) return { kind: 'material', winner: null };
  if (chess.isDrawByFiftyMoves()) return { kind: 'fifty', winner: null };
  if (chess.isDraw()) return { kind: 'draw', winner: null };
  return null;
}

// 盤の8×8（上が黒側＝8段目）。各マス { square, piece: { type, color } | null }
export function squares(chess, flip = false) {
  const rows = chess.board();
  const out = [];
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const rr = flip ? 7 - r : r, cc = flip ? 7 - c : c;
    const cell = rows[rr][cc];
    out.push({ square: 'abcdefgh'[cc] + (8 - rr), piece: cell ? { type: cell.type, color: cell.color } : null });
  }
  return out;
}

// 昇格が必要な手か（from→to に昇格つきの合法手があるか）
export function needsPromotion(chess, from, to) {
  return chess.moves({ square: from, verbose: true }).some((m) => m.to === to && m.promotion);
}
