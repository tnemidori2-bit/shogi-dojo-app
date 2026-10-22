import { T } from '../text.js';
import { state } from '../core/store.js';
import { loadJson, loadPieces } from '../core/data.js';
import { defOf, SIZE } from '../shogi/rules.js';
import { makeQuestion, judge } from '../shogi/drills.js';
import { sfx } from '../core/audio.js';
import { toast } from '../ui.js';

const same = (a, b) => a.x === b.x && a.y === b.y;
const has = (arr, c) => arr.some((a) => same(a, c));

export async function mountDrill(root, nav, drillId) {
  const el = document.createElement('div');
  el.className = 'screen lesson-screen';
  root.appendChild(el);
  let drill, pieces;
  try {
    [drill, pieces] = await Promise.all([loadJson(`drills/${drillId}.json`), loadPieces()]);
  } catch (e) {
    console.warn(e); toast(T.loadFailed); nav.home();
    return () => el.remove();
  }
  const hard = state.person?.difficulty === 'hard';
  const rounds = drill.rounds;
  const results = []; // 'ok' | 'hint' | 'ng'
  let qi = 0;
  let q, picked, sel, hinted, answered, verdict, msg;

  el.innerHTML = `
    <div class="topbar"><button class="btn small" type="button" id="quit">${T.quit}</button><span id="count"></span></div>
    <div class="message" id="msg"></div>
    <div class="actions" id="actions"></div>
    <div class="board" id="board"></div>`;
  const boardEl = el.querySelector('#board');

  function newQuestion() {
    q = makeQuestion(drill, pieces);
    picked = q.type === 'moves' ? [] : null;
    sel = false; hinted = false; answered = false; verdict = null;
    msg = drill.ask;
    draw();
  }

  function draw() {
    el.querySelector('#msg').textContent = msg;
    el.querySelector('#count').textContent = T.question(qi + 1, rounds);
    let html = '';
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
      const c = q.board[y][x];
      const at = { x, y };
      const cls = ['cell'];
      const isFrom = same(at, q.from);
      if (isFrom) cls.push('sel');
      if (q.type === 'moves' && picked.some((p) => same(p, at))) cls.push('mark');
      if (q.type !== 'moves' && picked && same(picked, at)) cls.push('mark');
      if (q.type === 'check' && sel && !answered && !hard && has(q.legal, at)) cls.push('target');
      if (hinted && !answered && has(q.answers, at)) cls.push(q.type === 'capture' ? 'ans-ring' : 'target');
      if (answered) {
        if (has(verdict.missed, at)) cls.push(q.type === 'capture' ? 'ans-ring' : 'ans');
        if (has(verdict.extra, at)) cls.push('bad');
      }
      let p = '';
      if (c) {
        const d = defOf(c, pieces);
        const k = c.s === 1 && d.kanjiGote ? d.kanjiGote : d.kanji;
        p = `<span class="piece ${c.s === 1 ? 'gote' : 'sente'} ${c.p ? 'promoted' : ''} ${isFrom ? '' : 'dim0'}">${k}</span>`;
      }
      html += `<button type="button" class="${cls.join(' ')}" data-x="${x}" data-y="${y}" aria-label="${x + 1},${y + 1}">${p}</button>`;
    }
    boardEl.innerHTML = html;
    const act = el.querySelector('#actions');
    const last = qi + 1 >= rounds;
    let h = '';
    if (answered) h = `<button class="btn big" type="button" id="next">${last ? T.finish : T.nextQ}</button>`;
    else {
      if (q.type === 'moves') h += `<button class="btn big" type="button" id="done">${T.done}</button>`;
      if (!hard) h += `<button class="btn" type="button" id="hint">${T.hint}</button>`;
    }
    act.innerHTML = h;
    act.querySelector('#done')?.addEventListener('click', () => submit(picked));
    act.querySelector('#hint')?.addEventListener('click', () => { hinted = true; sfx('select'); msg = { moves: T.hintMoves, capture: T.hintCapture, check: T.hintCheck }[q.type]; draw(); });
    act.querySelector('#next')?.addEventListener('click', () => {
      sfx('tap');
      if (last) nav.drillResult(drillId, results); else { qi++; newQuestion(); }
    });
  }

  function submit(choice) {
    verdict = judge(q, choice);
    answered = true;
    if (verdict.ok) {
      results.push(hinted ? 'hint' : 'ok');
      msg = hinted ? T.correctHint : T.correct; sfx('clear');
    } else {
      results.push('ng');
      msg = { moves: T.wrongMoves, capture: T.wrongCapture, check: T.wrongCheck }[q.type]; sfx('no');
    }
    draw();
  }

  boardEl.addEventListener('click', (e) => {
    const b = e.target.closest('.cell');
    if (!b || answered) return;
    const at = { x: Number(b.dataset.x), y: Number(b.dataset.y) };
    if (q.type === 'moves') {
      if (same(at, q.from)) return;
      const i = picked.findIndex((p) => same(p, at));
      if (i >= 0) picked.splice(i, 1); else picked.push(at);
      sfx('select'); draw(); return;
    }
    if (q.type === 'capture') {
      const c = q.board[at.y][at.x];
      if (!c || c.s !== 1) { sfx('no'); return; }
      picked = at; sfx('select'); submit(at); return;
    }
    // check：青い駒をタップ → 行き先をタップ
    if (same(at, q.from)) { sel = true; sfx('select'); msg = drill.ask; draw(); return; }
    if (!sel) { sfx('no'); msg = T.pickPieceFirst; draw(); return; }
    if (!has(q.legal, at)) { sfx('no'); msg = T.cantMove; draw(); return; }
    picked = at; sfx('move'); submit(at);
  });
  el.querySelector('#quit').addEventListener('click', () => { sfx('tap'); nav.home(); });
  if (import.meta.env.DEV) window.__drill = () => ({ q, results });
  newQuestion();
  return () => el.remove();
}
