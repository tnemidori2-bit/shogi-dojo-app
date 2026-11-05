// オセロ・五目並べ共通の盤。ルールは持たず、タップされたマスの行・列を渡すだけ
// kind: 'othello'（緑の格子）| 'gomoku'（線の交点に石）
export function createBoard(size, kind, onTap) {
  const el = document.createElement('div');
  el.className = `gboard ${kind}`;
  el.style.setProperty('--n', size);
  el.setAttribute('role', 'grid');
  const cells = [];
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'gcell' + (r === 0 ? ' t' : '') + (r === size - 1 ? ' b' : '') + (c === 0 ? ' l' : '') + (c === size - 1 ? ' r' : '');
    b.setAttribute('aria-label', `${r + 1}行${c + 1}列`);
    b.addEventListener('click', () => onTap(r, c));
    el.appendChild(b);
    cells.push(b);
  }
  // 状態から描き直す。stones: 0/1/2 の配列、hints: Set、last: 直前の手の添字、over: 終局後なら true
  function render({ stones, hints = new Set(), last = null, over = false }) {
    for (let i = 0; i < cells.length; i++) {
      const v = stones[i], b = cells[i];
      const key = `${v}|${hints.has(i)}|${last === i}`;
      if (b._key !== key) {
        b._key = key;
        b.innerHTML = v ? `<span class="stone s${v}${last === i ? ' last' : ''}"></span>` : hints.has(i) ? '<span class="hint"></span>' : '';
      }
      b.disabled = over;
    }
  }
  return { el, render };
}
