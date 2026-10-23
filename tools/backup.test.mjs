import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBackup, parseBackup, migratePerson, migrateFamily, APP } from '../src/core/backup.js';
import { defaultFamily, defaultPerson, defaultSettings, DATA_VERSION } from '../src/core/store.js';

const sample = () => {
  const person = defaultPerson();
  person.lessons.fu = { clears: 3, stars: 3 };
  person.tsume['mate1-01'] = { solves: 2, best: 4200, misses: 1 };
  person.match.wins.weak = 2;
  const family = { ...defaultFamily(), level: 4, exp: 40, turns: 12, tsume: { 'mate1-01': { ms: 4200, icon: 'cat', name: 'たろう', at: 1 } } };
  return {
    family,
    profiles: [{ id: 'a1', icon: 'cat', name: 'たろう', lastPlayed: 1700000000000 }, { id: 'b2', icon: 'bear', name: '', lastPlayed: null }],
    persons: { a1: person, b2: defaultPerson() },
    settings: { ...defaultSettings(), volume: 0.4 },
  };
};

test('書き出して読み込むと、同じ記録に戻る', () => {
  const s = sample();
  const r = parseBackup(JSON.stringify(buildBackup(s)));
  assert.ok(r.ok);
  assert.deepEqual(r.data.profiles, s.profiles);
  assert.deepEqual(r.data.persons.a1.lessons, s.persons.a1.lessons);
  assert.deepEqual(r.data.persons.a1.tsume, s.persons.a1.tsume);
  assert.equal(r.data.persons.a1.match.wins.weak, 2);
  assert.deepEqual(r.data.family.tsume, s.family.tsume);
  assert.equal(r.data.family.level, 4);
  assert.equal(r.data.settings.volume, 0.4);
});

test('古い形式（あとから増えた項目が無い）でも読める', () => {
  const old = { app: APP, version: 1, family: { level: 2, exp: 7, turns: 3 }, profiles: [{ id: 'x', icon: 'turtle', name: 'はなこ' }], persons: { x: { lessons: { fu: { clears: 1, stars: 1 } } } } };
  const r = parseBackup(JSON.stringify(old));
  assert.ok(r.ok);
  const p = r.data.persons.x;
  for (const k of ['lessons', 'drills', 'tsume', 'openings']) assert.equal(typeof p[k], 'object');
  assert.equal(p.lessons.fu.stars, 1);
  assert.deepEqual(p.match.prefs, { level: 'weak', side: 0, handicap: 'none' });
  assert.deepEqual(r.data.family.tsume, {});
  assert.equal(r.data.settings.lastExport, null);
});

test('おかしなファイルは、理由つきで断る', () => {
  const good = buildBackup(sample());
  const bad = (mut) => parseBackup(JSON.stringify(mut(JSON.parse(JSON.stringify(good)))));
  assert.equal(parseBackup('これはJSONではない').reason, 'json');
  assert.equal(parseBackup('x'.repeat(4 * 1024 * 1024)).reason, 'size');
  assert.equal(bad((d) => { d.app = 'kazoku-no-shima'; return d; }).reason, 'app');
  assert.equal(bad((d) => { d.version = DATA_VERSION + 1; return d; }).reason, 'version');
  assert.equal(bad((d) => { d.family = []; return d; }).reason, 'family');
  assert.equal(bad((d) => { d.profiles = Array.from({ length: 7 }, (_, i) => ({ id: 'p' + i, icon: 'cat', name: '' })); return d; }).reason, 'profiles');
  assert.equal(bad((d) => { d.profiles[1].id = d.profiles[0].id; return d; }).reason, 'profiles');
  assert.equal(bad((d) => { d.profiles[0].icon = 'dragon'; return d; }).reason, 'profiles');
  assert.equal(bad((d) => { d.profiles[0].name = 'あ'.repeat(9); return d; }).reason, 'profiles');
  assert.equal(bad((d) => { d.persons = 5; return d; }).reason, 'persons');
});

test('プロフィールにない人の記録は、読み込まない／記録のない人は、初期の記録', () => {
  const d = buildBackup(sample());
  d.persons.ghost = migratePerson({ lessons: { fu: { clears: 9, stars: 3 } } });
  delete d.persons.b2;
  const r = parseBackup(JSON.stringify(d));
  assert.ok(r.ok);
  assert.equal(r.data.persons.ghost, undefined);
  assert.deepEqual(r.data.persons.b2.lessons, {});
});

test('migrate は、足りない項目を足すだけで、あるものは消さない', () => {
  const f = migrateFamily({ level: 3, exp: 10, turns: 1, extra: 'keep' });
  assert.equal(f.extra, 'keep'); assert.deepEqual(f.tsume, {});
  const p = migratePerson({ difficulty: 'hard', lessons: { fu: { stars: 2 } }, match: { wins: { weak: 1 } } });
  assert.equal(p.difficulty, 'hard'); assert.equal(p.match.wins.weak, 1); assert.equal(p.match.plays, 0);
});
