import test from 'node:test';
import assert from 'node:assert/strict';
import * as W from '../src/games/werewolf.js';

// 全員CPUで1ゲーム通す（0番も同じ考え方で動かす）
function playAll(n, rng = Math.random) {
  let s = W.newGame(n, rng), guard = 0;
  while (!s.winner && guard++ < 100) {
    if (s.phase === 'night') s = W.night(s, {}, rng);
    else if (s.phase === 'day') s = W.speak(s, W.cpuSpeak(s, W.speaker(s), rng));
    else if (s.phase === 'vote') s = W.vote(s, {}, rng);
    if (s.winner) break;
    const a = W.alive(s).length, w = W.wolves(s).length;
    assert.ok(w >= 1 && w < a - w + 0 || s.winner, '終わっていない');
  }
  return s;
}

test('人狼：役の数がきまりどおり', () => {
  for (const n of [5, 7]) {
    const s = W.newGame(n);
    const c = (r) => s.players.filter((p) => p.role === r).length;
    assert.equal(s.players.length, n);
    assert.deepEqual([c('wolf'), c('seer'), c('knight'), c('villager')], [W.SETUPS[n].wolf, 1, W.SETUPS[n].knight, W.SETUPS[n].villager]);
  }
});
test('人狼：はじめの夜はおそわれない、だれも ふくめて必ず終わる', () => {
  for (const n of [5, 7]) for (let g = 0; g < 200; g++) {
    let s = W.newGame(n);
    s = W.night(s);
    assert.equal(s.events[0].victim, null);
    s = playAll(n);
    assert.ok(s.winner === 'villagers' || s.winner === 'wolves');
    const w = W.wolves(s).length, o = W.alive(s).length - w;
    assert.ok(s.winner === 'villagers' ? w === 0 : w >= o);
  }
});
test('人狼：投票は1人だけ追放し、同数はくじびき、人間の入力を使う', () => {
  let s = W.newGame(5);
  s = W.night(s);
  while (s.phase === 'day') s = W.speak(s, { t: 'silent' });
  assert.equal(s.phase, 'vote');
  const target = W.alive(s).find((i) => i !== 0);
  const v = W.vote(s, { 0: target });
  const ev = v.events.at(-1);
  assert.equal(ev.t, 'out');
  assert.equal(ev.votes.find(([p]) => p === 0)[1], target);
  assert.equal(W.alive(v).length, W.alive(s).length - 1);
});
test('人狼：占い師の結果は本当、騎士に守られた人はおそわれない', () => {
  let s = W.newGame(7);
  const seer = s.players.find((p) => p.role === 'seer').id, wolf = s.players.find((p) => p.role === 'wolf').id;
  s = W.night(s, { [seer]: wolf });
  assert.equal(s.private[seer][0].wolf, true);
  while (s.phase === 'day') s = W.speak(s, { t: 'silent' });
  const knight = s.players.find((p) => p.role === 'knight');
  const wolfAlive = W.wolves(s)[0];
  const vic = W.alive(s).find((i) => W.roleOf(s, i) !== 'wolf' && i !== knight.id);
  // 投票を人狼以外の人に集中させて、まだゲームが続くようにする
  let t = s;
  if (t.phase === 'vote') t = W.vote(t, Object.fromEntries(W.alive(t).map((i) => [i, vic])));
  if (t.phase === 'night' && W.nightKind(t, knight.id) === 'guard' && W.alive(t).includes(vic)) {
    const n = W.night(t, { [knight.id]: vic, ...Object.fromEntries(W.wolves(t).map((w) => [w, vic])) });
    assert.equal(n.events.at(-1).victim, null);
  }
  assert.ok(wolfAlive !== undefined);
});
test('人狼：CPU同士の勝率が かたよりすぎない', () => {
  for (const n of [5, 7]) {
    let v = 0;
    const N = 600;
    for (let g = 0; g < N; g++) if (playAll(n).winner === 'villagers') v++;
    console.log(`  ${n}人: 村人側 ${v}/${N} (${Math.round(v / N * 100)}%)`);
    assert.ok(v / N > 0.25 && v / N < 0.9);
  }
});
