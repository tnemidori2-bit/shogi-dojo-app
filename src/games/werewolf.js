// 人狼（0番が人、のこりがCPU）。画面にも文字にも触れない、ルールとCPUの考え方だけの部品。
// 5人：人狼1・占い師1・村人3 ／ 7人：人狼2・占い師1・騎士1・村人3
// はじめの夜は おそわれない。ついほうされた人の役は、ゲームが終わるまで分からない（占い師の結果が いちばんの手がかり）
export const SETUPS = {
  5: { wolf: 1, seer: 1, knight: 0, villager: 3 },
  7: { wolf: 2, seer: 1, knight: 1, villager: 3 },
};

const clone = (s) => structuredClone(s);
const shuffle = (a, rng) => {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; }
  return r;
};
const pickOne = (a, rng) => a[Math.floor(rng() * a.length)];

export const roleOf = (s, i) => s.players[i].role;
export const alive = (s) => s.players.filter((p) => p.alive).map((p) => p.id);
export const wolves = (s) => s.players.filter((p) => p.alive && p.role === 'wolf').map((p) => p.id);
export const partners = (s, p) => (roleOf(s, p) === 'wolf' ? s.players.filter((x) => x.role === 'wolf' && x.id !== p).map((x) => x.id) : []);

export function newGame(n = 5, rng = Math.random) {
  const c = SETUPS[n];
  const roles = shuffle([...Array(c.wolf).fill('wolf'), 'seer', ...Array(c.knight).fill('knight'), ...Array(c.villager).fill('villager')], rng);
  return { n, players: roles.map((role, id) => ({ id, role, alive: true })), day: 1, phase: 'night', private: {}, statements: [], events: [], speakers: [], talk: 0, winner: null };
}

function checkEnd(s) {
  const w = wolves(s).length, others = alive(s).length - w;
  if (w === 0) s.winner = 'villagers';
  else if (w >= others) s.winner = 'wolves';
  if (s.winner) s.phase = 'end';
}
export const humanWon = (s, p = 0) => (s.winner === 'wolves') === (roleOf(s, p) === 'wolf');

// ---- CPUの「だれがあやしいか」 ----
// 占い師が名乗り出た人（co）の言うことを どこまで信じるかを、役ごとに変える
function claimersOf(s, o) { return [...new Set(s.statements.filter((x) => x.t === 'co' && x.p !== o).map((x) => x.p))]; }
// 村人側のCPUが信じる占い師。自分を「人狼」と言った人は にせもの。のこりが2人以上なら、見る人ごとに決める
export function believedSeer(s, o) {
  const cl = claimersOf(s, o);
  const ok = cl.filter((c) => !s.statements.some((x) => x.t === 'co' && x.p === c && x.target === o && x.wolf));
  if (!ok.length) return null;
  return ok.length === 1 ? ok[0] : ok[(o + s.day) % ok.length];
}

export function suspicion(s, o, rng = Math.random) {
  const sc = s.players.map(() => rng() * 12);
  const role = roleOf(s, o), st = s.statements;
  for (const x of st) {
    if (x.p === o) continue;
    if (x.t === 'suspect') { if (x.target === o) sc[x.p] += 10; else sc[x.target] += 6; }
    if (x.t === 'trust') sc[x.target] -= 6;
  }
  const cl = claimersOf(s, o);
  if (role === 'seer') {
    for (const r of s.private[o] || []) sc[r.target] += r.wolf ? 100 : -100;
    for (const c of cl) sc[c] += 100;
  } else if (role === 'wolf') {
    const pt = partners(s, o);
    for (const c of cl) if (!pt.includes(c)) sc[c] += 40 + (st.some((x) => x.t === 'co' && x.p === c && x.target === o && x.wolf) ? 60 : 0);
    for (const w of pt) sc[w] -= 100;
  } else {
    const b = believedSeer(s, o);
    for (const c of cl) {
      if (st.some((x) => x.t === 'co' && x.p === c && x.target === o && x.wolf)) sc[c] += 60;
      else if (c !== b) sc[c] += 25;
    }
    if (b !== null) sc[b] -= 15;
    for (const x of st) if (x.t === 'co' && x.p === b && x.target !== o) sc[x.target] += x.wolf ? 40 : -20;
  }
  return sc;
}

// ---- 夜 ----
export function nightKind(s, p) {
  if (!s.players[p].alive) return null;
  const r = roleOf(s, p);
  if (r === 'seer') return 'divine';
  if (s.day > 1 && r === 'wolf') return 'attack';
  if (s.day > 1 && r === 'knight') return 'guard';
  return null;
}
export function nightTargets(s, p) {
  const k = nightKind(s, p);
  if (!k) return [];
  return alive(s).filter((i) => i !== p && (k !== 'attack' || roleOf(s, i) !== 'wolf') && (k !== 'divine' || !(s.private[p] || []).some((r) => r.target === i)));
}
export function cpuNightAction(s, p, rng = Math.random) {
  const t = nightTargets(s, p), k = nightKind(s, p);
  if (!t.length) return null;
  if (k === 'divine') { const sc = suspicion(s, p, rng); return t.reduce((a, b) => (sc[b] > sc[a] ? b : a)); }
  if (k === 'attack') {
    const seers = claimersOf(s, p).filter((c) => t.includes(c));
    return seers.length && rng() < 0.8 ? pickOne(seers, rng) : pickOne(t, rng);
  }
  const b = believedSeer(s, p);
  return b !== null && t.includes(b) ? b : pickOne(t, rng);
}
// inputs: { 人の番号: えらんだ相手 }。ないものはCPUが決める
export function night(s, inputs = {}, rng = Math.random) {
  const n = clone(s);
  for (const p of alive(n)) {
    if (nightKind(n, p) !== 'divine') continue;
    const t = p in inputs ? inputs[p] : cpuNightAction(n, p, rng);
    if (t !== null && t !== undefined) (n.private[p] ||= []).push({ day: n.day, target: t, wolf: roleOf(n, t) === 'wolf' });
  }
  let victim = null;
  if (n.day > 1) {
    const ws = wolves(n);
    const human = ws.find((w) => inputs[w] != null);
    const target = human !== undefined ? inputs[human] : cpuNightAction(n, ws[0], rng);
    const guards = alive(n).filter((p) => nightKind(n, p) === 'guard').map((p) => (p in inputs ? inputs[p] : cpuNightAction(n, p, rng)));
    victim = guards.includes(target) ? null : target;
  }
  n.events.push({ day: n.day, t: 'dawn', victim });
  if (victim !== null) n.players[victim].alive = false;
  checkEnd(n);
  if (!n.winner) {
    const a = alive(n), k = n.day % a.length;
    n.speakers = a.slice(k).concat(a.slice(0, k));
    n.talk = 0; n.phase = 'day';
  }
  return n;
}

// ---- 昼の話し合い（statement: {t:'co',target,wolf} {t:'suspect',target} {t:'trust',target} {t:'silent'}） ----
export const speaker = (s) => (s.phase === 'day' ? s.speakers[s.talk] : null);
export function speak(s, st) {
  const n = clone(s);
  n.statements.push({ ...st, day: n.day, p: n.speakers[n.talk] });
  n.talk++;
  if (n.talk >= n.speakers.length) n.phase = 'vote';
  return n;
}
export function cpuSpeak(s, p, rng = Math.random) {
  const role = roleOf(s, p), others = alive(s).filter((i) => i !== p);
  if (role === 'seer') {
    const last = (s.private[p] || []).at(-1);
    if (last && last.day === s.day && rng() < 0.95) return { t: 'co', target: last.target, wolf: last.wolf };
  }
  const sc = suspicion(s, p, rng);
  const byScore = [...others].sort((a, b) => sc[b] - sc[a]);
  if (role === 'wolf') {
    const pt = partners(s, p);
    const claimed = s.statements.some((x) => x.t === 'co' && x.p === p);
    const partnerClaimed = s.statements.some((x) => x.t === 'co' && pt.includes(x.p));
    if (claimed || (!partnerClaimed && rng() < 0.7)) {
      const target = pickOne(others, rng);
      return { t: 'co', target, wolf: !pt.includes(target) && rng() < 0.7 };
    }
    const r = rng();
    const good = byScore.filter((i) => roleOf(s, i) !== 'wolf');
    if (r < 0.7 && good.length) return { t: 'suspect', target: pickOne(good.slice(0, 3), rng) };
    if (r < 0.85 && pt.length) return { t: 'trust', target: pickOne(pt, rng) };
    return { t: 'silent' };
  }
  const r = rng();
  if (r < 0.6) return { t: 'suspect', target: byScore[0] };
  if (r < 0.9) return { t: 'trust', target: byScore.at(-1) };
  return { t: 'silent' };
}

// ---- 投票 ----
export const cpuVote = (s, p, rng = Math.random) => {
  const sc = suspicion(s, p, rng);
  return alive(s).filter((i) => i !== p).reduce((a, b) => (sc[b] > sc[a] ? b : a));
};
export function vote(s, inputs = {}, rng = Math.random) {
  const n = clone(s);
  const votes = alive(n).map((p) => [p, p in inputs ? inputs[p] : cpuVote(n, p, rng)]);
  const count = {};
  for (const [, t] of votes) count[t] = (count[t] || 0) + 1;
  const top = Math.max(...Object.values(count));
  const tied = Object.keys(count).filter((k) => count[k] === top).map(Number);
  const out = tied.length > 1 ? pickOne(tied, rng) : tied[0];
  n.events.push({ day: n.day, t: 'out', target: out, votes, tie: tied.length > 1 });
  n.players[out].alive = false;
  checkEnd(n);
  if (!n.winner) { n.day++; n.phase = 'night'; }
  return n;
}
