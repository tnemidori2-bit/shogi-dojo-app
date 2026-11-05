import { T } from '../text.js';
import { unlock, sfx } from '../core/audio.js';
import { askPersistent } from '../core/storage.js';

export function mountStart(root, nav) {
  const el = document.createElement('div');
  el.className = 'screen center start';
  el.innerHTML = `<div class="logo"><span class="logo-piece">王</span><br>${T.title}</div><button class="btn big" type="button">${T.start}</button><button class="btn small back-games" type="button">${T.back}</button>`;
  el.querySelector('.back-games').addEventListener('click', () => nav.games());
  el.querySelector('.btn.big').addEventListener('click', () => { unlock(); sfx('tap'); askPersistent(); nav.profile(); });
  root.appendChild(el);
  return () => el.remove();
}
