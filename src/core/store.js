// 小さな store：1つのオブジェクト＋変更通知。
export const ANIMALS = [
  { id: 'turtle', emoji: '🐢', label: 'かめ' },
  { id: 'fish', emoji: '🐟', label: 'さかな' },
  { id: 'chick', emoji: '🐥', label: 'ひよこ' },
  { id: 'rabbit', emoji: '🐰', label: 'うさぎ' },
  { id: 'bear', emoji: '🐻', label: 'くま' },
  { id: 'cat', emoji: '🐱', label: 'ねこ' },
];
export const MAX_PROFILES = 6;
export const NAME_MAX = 8;
export const DATA_VERSION = 1;

// 家族みんなで共有するデータ
export const defaultFamily = () => ({
  version: DATA_VERSION,
  level: 1,
  exp: 0,
  turns: 0, // 「番」＝誰かが遊びを1回終えた数
  tsume: {}, // 家族ベスト：問題id → { ms, icon, name, at }
  createdAt: Date.now(),
});

// 人ごとのデータ。lessons[id] = { clears, stars }、drills[id] = { streak, best, stars, plays, correct }
export const defaultPerson = () => ({
  version: DATA_VERSION,
  difficulty: 'normal',
  lessons: {},
  drills: {},
  tsume: {}, // 問題id → { solves, best(ミリ秒), misses }
  plays: 0,
});

export const defaultSettings = () => ({ version: DATA_VERSION, volume: 0.7, defaultDifficulty: 'normal' });

export const state = {
  ready: false,
  family: defaultFamily(),
  profiles: [], // [{id, icon, name, lastPlayed}]
  settings: defaultSettings(),
  currentId: null,
  person: null,
};

const listeners = new Set();
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function emit(what = 'change') { for (const fn of listeners) fn(what, state); }

export const currentProfile = () => state.profiles.find((p) => p.id === state.currentId) || null;
export const animalOf = (icon) => ANIMALS.find((a) => a.id === icon) || ANIMALS[0];
