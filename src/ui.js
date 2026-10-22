import { T } from './text.js';
import { state, subscribe } from './core/store.js';

let timer = null;
export function toast(msg, ms = 1800) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(timer);
  timer = setTimeout(() => t.classList.remove('show'), ms);
}
subscribe((what) => { if (what === 'saveError') toast(T.saveFailed); });
export { state };
