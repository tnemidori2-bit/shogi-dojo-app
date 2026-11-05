import { T } from '../text.js';
import { sfx } from '../core/audio.js';
import { createBoard } from '../games/board.js';
import * as go from '../games/go.js';
import { LESSONS, judge } from '../games/golessons.js';

const DONE_KEY = 'go-lessons-done';
// 「できた」の印は、この端末のブラウザにだけ覚えておく（保存の形は変えない）
function loadDone() { try { return new Set(JSON.parse(localStorage.getItem(DONE_KEY) || '[]')); } catch { return new Set(); } }
function saveDone(set) { try { localStorage.setItem(DONE_KEY, JSON.stringify([...set])); } catch { /* 保存できなくても遊べる */ } }

export function mountGoLesson(root, nav) {
  const g = T.games;
  const el = document.createElement('div');
  el.className = 'screen boardgame golesson';
  root.appendChild(el);
  let timer = null, dead = false;
  const done = loadDone();

  function list() {
    clearTimeout(timer);
    el.innerHTML = `<div class="topbar"><button class="btn small" type="button" data-act="home">${T.back}</button><span>${g.goLesson}</span><span></span></div>
      <div class="lessons">${LESSONS.map((l, i) => `<button class="lesson" type="button" data-i="${i}"><span class="lt">${i + 1}. ${l.title}</span><span class="stars">${done.has(l.id) ? '★' : ''}</span></button>`).join('')}</div>`;
  }

  function open(i) {
    const lesson = LESSONS[i];
    const base = go.newState();
    for (const [r, c, p] of lesson.stones) base.b[r * go.SIZE + c] = p;
    let s = base, locked = false;
    el.innerHTML = `<div class="topbar"><button class="btn small" type="button" data-act="list">${T.back}</button><span>${i + 1}. ${lesson.title}</span><span></span></div>
      <div class="gmsg lesson-msg"></div><div class="gwrap"></div>
      <div class="actions"><button class="btn" type="button" data-act="retry">${g.retry}</button><button class="btn big hidden" type="button" data-act="next"></button></div>`;
    const msg = el.querySelector('.lesson-msg'), next = el.querySelector('[data-act=next]');
    const board = createBoard(go.SIZE, 'gomoku', tap);
    el.querySelector('.gwrap').appendChild(board.el);
    next.textContent = i + 1 < LESSONS.length ? g.nextLesson : g.toGame;
    next.dataset.go = i + 1 < LESSONS.length ? String(i + 1) : 'play';
    const draw = () => board.render({ stones: s.b, last: s.last, over: locked });
    const say = (t, cls = '') => { msg.className = `gmsg lesson-msg ${cls}`; msg.textContent = t; };
    function reset() { clearTimeout(timer); s = base; locked = false; say(lesson.intro); next.classList.add('hidden'); draw(); }
    function tap(r, c) {
      if (locked) return;
      const n = go.play(s, r, c);
      if (!n) {
        if (lesson.goal.type === 'illegal' && lesson.goal.cell[0] === r && lesson.goal.cell[1] === c) return success(s);
        say(g.cantPlace, 'pass'); return;
      }
      sfx('tap');
      if (lesson.goal.type === 'illegal') { s = n; draw(); return fail(); }
      s = n; draw();
      judge(lesson, base, n, r, c) ? success(n) : fail();
    }
    function success() {
      locked = true; draw();
      done.add(lesson.id); saveDone(done);
      say(lesson.ok, 'ok');
      next.classList.remove('hidden');
    }
    function fail() {
      locked = true; draw();
      say(lesson.ng || g.tryAgain, 'pass');
      timer = setTimeout(() => { if (!dead) reset(); }, 1800);
    }
    reset();
  }

  el.addEventListener('click', (ev) => {
    const b = ev.target.closest('button');
    if (!b) return;
    sfx('tap');
    if (b.dataset.act === 'home') nav.games();
    else if (b.dataset.act === 'list') list();
    else if (b.dataset.act === 'retry') { const i = el.querySelector('.topbar span')?.textContent; open(Number.parseInt(i, 10) - 1); }
    else if (b.dataset.act === 'next') { b.dataset.go === 'play' ? nav.boardgame({ game: 'go', vs: 'cpu' }) : open(Number(b.dataset.go)); }
    else if (b.dataset.i !== undefined) open(Number(b.dataset.i));
  });

  list();
  return () => { dead = true; clearTimeout(timer); el.remove(); };
}
