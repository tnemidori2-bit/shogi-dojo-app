// CPUの強さの段階（オセロ・五目並べ・囲碁）。勝つと次の段階が開く
// 進み具合は、この端末のブラウザにだけ覚える（将棋の保存の形は変えない）
export const LEVEL_COUNT = 5;
const KEY = 'board-levels';

function load() { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { return {}; } }
function save(o) { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch { /* 保存できなくても遊べる */ } }

// いちばん高くクリアした段階（0=まだ）
export function clearedLevel(game) { const n = Number(load()[game]); return Number.isFinite(n) ? Math.min(Math.max(n, 0), LEVEL_COUNT) : 0; }
// 遊べる最大の段階
export function unlockedLevel(game) { return Math.min(clearedLevel(game) + 1, LEVEL_COUNT); }
// level に勝ったときの記録。新しく次が開いたら true
export function recordWin(game, level) {
  const before = clearedLevel(game);
  if (level <= before) return false;
  const o = load(); o[game] = level; save(o);
  return level < LEVEL_COUNT;
}
