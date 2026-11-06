import { T } from '../text.js';
import { sfx } from '../core/audio.js';
import * as W from '../games/werewolf.js';
import { frame, wire, result } from './cardgames.js';

const w = T.wolf;
const html = String.raw;

// cfg.n: 5 か 7（にんずう）
export function mountWerewolf(root, nav, cfg = {}) {
  const n = cfg.n || 5;
  const { el, body, status } = frame(root, T.cards.werewolf, 'wolfgame', 'werewolf');
  let s, timer = null, dead = false, menu = null, lieTarget = null;
  const name = (i) => w.names[i];
  const role = (i) => w.roles[W.roleOf(s, i)];
  const me = () => s.players[0];

  function logLines() {
    const out = [];
    for (let d = 1; d <= s.day; d++) {
      out.push(`<div class="wl-day">${w.day(d)}</div>`);
      for (const r of s.private[0] || []) if (r.day === d) out.push(`<div class="wl-line priv">${w.myDivine(name(r.target), r.wolf)}</div>`);
      for (const e of s.events.filter((x) => x.day === d && x.t === 'dawn')) out.push(`<div class="wl-line ev">${d === 1 ? w.dawnFirst : e.victim === null ? w.dawnNone : w.dawn(name(e.victim))}</div>`);
      for (const x of s.statements.filter((y) => y.day === d)) {
        const t = x.t === 'co' ? w.sayCo(name(x.p), name(x.target), x.wolf) : x.t === 'suspect' ? w.saySuspect(name(x.p), name(x.target)) : x.t === 'trust' ? w.sayTrust(name(x.p), name(x.target)) : w.saySilent(name(x.p));
        out.push(`<div class="wl-line${x.p === 0 ? ' mine' : ''}">${t}</div>`);
      }
      for (const e of s.events.filter((x) => x.day === d && x.t === 'out')) {
        out.push(`<div class="wl-line ev">${w.out(name(e.target), e.tie)}</div><div class="wl-line small">${w.votes(e.votes.map(([a, b]) => `${name(a)}→${name(b)}`).join('、'))}</div>`);
      }
    }
    return out.join('');
  }

  const btns = (ids, act) => ids.map((i) => `<button class="btn" type="button" data-act="${act}" data-t="${i}">${name(i)}</button>`).join('');

  function controls() {
    if (s.winner) return '';
    if (!me().alive) return `<div class="cg-msg">${w.dead}</div>`;
    if (s.phase === 'night') {
      const k = W.nightKind(s, 0);
      if (k && W.nightTargets(s, 0).length) return `<div class="cg-msg">${w.nightPick[k]}</div><div class="actions wrap">${btns(W.nightTargets(s, 0), 'night')}</div>`;
      return `<div class="cg-msg">${w.sleepHint}</div><div class="actions"><button class="btn big" type="button" data-act="sleep">${w.sleep}</button></div>`;
    }
    if (s.phase === 'day' && W.speaker(s) === 0) {
      const others = W.alive(s).filter((i) => i !== 0);
      if (menu === 'suspect' || menu === 'trust' || menu === 'lie') return `<div class="cg-msg">${w.pickWho}</div><div class="actions wrap">${btns(others, menu)}<button class="btn small" type="button" data-act="cancel">${w.cancel}</button></div>`;
      if (menu === 'lieResult') return `<div class="cg-msg">${w.lieResult}</div><div class="actions wrap"><button class="btn" type="button" data-act="lieWolf">${w.isWolf}</button><button class="btn" type="button" data-act="lieHuman">${w.isHuman}</button><button class="btn small" type="button" data-act="cancel">${w.cancel}</button></div>`;
      const last = (s.private[0] || []).at(-1), canReport = W.roleOf(s, 0) === 'seer' && last && last.day === s.day;
      return html`<div class="cg-msg">${w.talkHint}</div><div class="actions wrap">
        <button class="btn" type="button" data-act="m-suspect">${w.mSuspect}</button>
        <button class="btn" type="button" data-act="m-trust">${w.mTrust}</button>
        ${canReport ? `<button class="btn" type="button" data-act="report">${w.mReport}</button>` : ''}
        ${W.roleOf(s, 0) === 'wolf' ? `<button class="btn" type="button" data-act="m-lie">${w.mLie}</button>` : ''}
        <button class="btn" type="button" data-act="silent">${w.mSilent}</button></div>`;
    }
    if (s.phase === 'vote') return `<div class="cg-msg">${w.votePick}</div><div class="actions wrap">${btns(W.alive(s).filter((i) => i !== 0), 'vote')}</div>`;
    return '';
  }

  function draw() {
    const r = W.roleOf(s, 0), pt = W.partners(s, 0);
    status.textContent = s.winner ? '' : w.status(s.day, w.phase[s.phase]);
    const chips = s.players.map((p) => `<span class="wchip${p.alive ? '' : ' dead'}${W.speaker(s) === p.id && s.phase === 'day' ? ' now' : ''}">${name(p.id)}${p.alive ? '' : ' ✕'}</span>`).join('');
    const final = s.winner ? result(
      W.humanWon(s) ? w.youWon : w.youLost,
      s.winner === 'villagers' ? w.winVillagers : w.winWolves,
      `<div class="wl-line small">${w.rolesAre(s.players.map((p) => `${name(p.id)}=${role(p.id)}`).join('、'))}</div>`,
    ) : '';
    body.innerHTML = html`
      <div class="wchips">${chips}</div>
      <div class="cg-msg wrole"><span>${w.youAre(role(0))}${pt.length ? `<br>${w.partner(pt.map(name).join('、'))}` : ''}<br><small>${w.roleHelp[r]}</small></span></div>
      <div class="wlog">${logLines()}</div>
      ${controls()}${final}`;
    const log = body.querySelector('.wlog');
    if (log) log.scrollTop = log.scrollHeight;
  }

  function step() {
    clearTimeout(timer);
    menu = null;
    draw();
    if (dead || s.winner) return;
    const auto = (fn, ms) => { timer = setTimeout(() => { if (!dead) { fn(); sfx('tap'); step(); } }, ms); };
    if (s.phase === 'night') {
      if (!me().alive) auto(() => { s = W.night(s); }, 900);
    } else if (s.phase === 'day') {
      const p = W.speaker(s);
      if (p !== 0 || !me().alive) auto(() => { s = W.speak(s, W.cpuSpeak(s, p)); }, 1000);
    } else if (s.phase === 'vote') {
      if (!me().alive) auto(() => { s = W.vote(s); }, 1000);
    }
  }
  const go = (fn) => { s = fn(); sfx('tap'); step(); };
  function reset() { s = W.newGame(n); step(); }

  wire(el, nav, reset, (b) => {
    const a = b.dataset.act, t = b.dataset.t === undefined ? null : Number(b.dataset.t);
    if (s.winner || !a) return;
    if (a === 'sleep') return go(() => W.night(s));
    if (a === 'night') return go(() => W.night(s, { 0: t }));
    if (a === 'vote') return go(() => W.vote(s, { 0: t }));
    if (s.phase !== 'day' || W.speaker(s) !== 0) return;
    if (a === 'm-suspect' || a === 'm-trust' || a === 'm-lie') { menu = a.slice(2); draw(); return; }
    if (a === 'cancel') { menu = null; draw(); return; }
    if (a === 'silent') return go(() => W.speak(s, { t: 'silent' }));
    if (a === 'suspect' || a === 'trust') return go(() => W.speak(s, { t: a, target: t }));
    if (a === 'report') { const last = s.private[0].at(-1); return go(() => W.speak(s, { t: 'co', target: last.target, wolf: last.wolf })); }
    if (a === 'lie') { lieTarget = t; menu = 'lieResult'; draw(); return; }
    if (a === 'lieWolf' || a === 'lieHuman') return go(() => W.speak(s, { t: 'co', target: lieTarget, wolf: a === 'lieWolf' }));
  });
  reset();
  return () => { dead = true; clearTimeout(timer); el.remove(); };
}
