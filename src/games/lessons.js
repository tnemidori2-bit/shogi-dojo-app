// 囲碁レッスン。黒（じぶん）が1手うって、goal を満たせば「できた」。白は動かない
// stones: [行, 列, 色] の配列（1=黒, 2=白）。goal の type:
//   place … どこでもよい／cells … 指定の点のどれか／capture … 石を n 個以上とる
//   atari … 白のかたまりが呼吸点1つになる／escape … stone の黒が呼吸点2つ以上になる／illegal … 指定の点が「おけない」と分かる
import { group } from './go.js';
import * as othello from './othello.js';
import * as gomoku from './gomoku.js';
import * as goRules from './go.js';

export const GO_LESSONS = [
  { id: 'place', title: '石を おいてみよう', stones: [],
    intro: '碁は 線と線の まじわる ところに 石を おくよ。すきな ところを タップしてみよう',
    goal: { type: 'place' }, ok: 'じょうず！ 黒と白が かわりばんこに 1手ずつ うつよ。', ng: '' },
  { id: 'liberty', title: 'こきゅうてん', stones: [[4, 4, 2]],
    intro: '白い石の となりの 空いた 点を「こきゅうてん」というよ（いきを するところ）。ひとつ ふさいでみよう',
    goal: { type: 'cells', cells: [[3, 4], [5, 4], [4, 3], [4, 5]] }, ok: 'そう！ こきゅうてんが 4つ→3つに へったね。', ng: '白い石の となりを ふさいでね' },
  { id: 'capture1', title: '石を とろう', stones: [[4, 4, 2], [3, 4, 1], [5, 4, 1], [4, 3, 1]],
    intro: '白い石の こきゅうてんが ぜんぶ なくなると とれるよ。白の のこりの 1つを ふさごう',
    goal: { type: 'capture', n: 1 }, ok: 'とれた！ こきゅうてんが ぜんぶ ふさがると 石は とられるよ。', ng: '白い石の のこりの こきゅうてんを さがしてね' },
  { id: 'corner', title: 'すみは 2つで とれる', stones: [[0, 0, 2], [0, 1, 1]],
    intro: 'すみの 石は こきゅうてんが 2つしかないよ。黒が 1つ ふさいだ。のこりを ふさごう',
    goal: { type: 'capture', n: 1 }, ok: 'すみの 石は とりやすいね。', ng: '白い石の となりの 空いた 点だよ' },
  { id: 'atari', title: 'アタリ', stones: [[4, 4, 2], [3, 4, 1], [5, 4, 1]],
    intro: 'こきゅうてんが のこり 1つに なることを「アタリ」というよ。白を アタリに しよう',
    goal: { type: 'atari' }, ok: 'アタリ！ つぎに ふさげば とれるよ。', ng: '白の こきゅうてんを あと 1つに しよう' },
  { id: 'escape', title: 'にげよう', stones: [[4, 4, 1], [3, 4, 2], [5, 4, 2], [4, 3, 2]],
    intro: '黒が アタリに されちゃった！ つぎに とられるよ。にげ道を あけよう',
    goal: { type: 'escape', stone: [4, 4] }, ok: 'にげられた！ のびて こきゅうてんが ふえたね。', ng: 'まだ アタリのまま。にげ道に 石を おいてね' },
  { id: 'capture2', title: 'つながった 石も とれる', stones: [[4, 4, 2], [4, 5, 2], [3, 4, 1], [3, 5, 1], [5, 4, 1], [5, 5, 1], [4, 3, 1]],
    intro: 'つながった 石は ひとつの かたまり。ぜんぶの こきゅうてんを ふさぐと まとめて とれるよ',
    goal: { type: 'capture', n: 2 }, ok: '2こ まとめて とれた！', ng: '白の かたまりの のこりの こきゅうてんを さがしてね' },
  { id: 'suicide', title: 'おけない ところ', stones: [[0, 1, 2], [1, 0, 2]],
    intro: '石を おいたとき じぶんの 石の こきゅうてんが ゼロに なる ところ（とれる石も ない）には おけないよ。左上の すみに おいてみよう',
    goal: { type: 'illegal', cell: [0, 0] }, ok: 'おけなかったね。「じさつしゅ」は ルールで きんしだよ。', ng: '左上の すみ（いちばん 角）を タップしてね' },
];

// 1手うったあとの判定。before/after は go.js の状態、(r,c) はうった場所
export function judge(lesson, before, after, r, c) {
  const g = lesson.goal;
  if (g.type === 'place') return true;
  if (g.type === 'flips') return othello.count(after.b).black - othello.count(before.b).black - 1 >= g.n;
  if (g.type === 'win') return after.result === 'black';
  if (g.type === 'cells') return g.cells.some(([y, x]) => y === r && x === c);
  if (g.type === 'capture') return after.caps[1] >= g.n;
  if (g.type === 'atari') {
    for (let i = 0; i < after.b.length; i++) {
      if (after.b[i] === 2 && group(after.b, Math.floor(i / 9), i % 9).libs === 1) return true;
    }
    return false;
  }
  if (g.type === 'escape') return group(after.b, g.stone[0], g.stone[1]).libs >= 2;
  return false;
}

// ---- オセロ（8x8）。start:'initial' は最初の配置から ----
export const OTHELLO_LESSONS = [
  { id: 'o-flip', title: 'はさんで ひっくりかえす', start: 'initial', stones: [],
    intro: '相手の石を 自分の石ではさむと ひっくりかえせるよ。ひかっている ところに 1つ おいてみよう',
    goal: { type: 'place' }, ok: 'ひっくりかえった！ 黒が ふえたね。', ng: '' },
  { id: 'o-diag', title: 'ななめも はさめる', stones: [[3, 3, 2], [4, 4, 1]],
    intro: 'たて・よこだけじゃなくて ななめでも はさめるよ。ひかっている ところに おいてみよう',
    goal: { type: 'place' }, ok: 'ななめでも ひっくりかえせたね。', ng: '' },
  { id: 'o-many', title: 'たくさん ひっくりかえそう', stones: [[4, 0, 1], [4, 1, 2], [4, 2, 2], [4, 3, 2], [0, 7, 1], [1, 7, 2]],
    intro: 'おける ところが 2つ あるよ。たくさん ひっくりかえせる ほうを えらぼう',
    goal: { type: 'flips', n: 3 }, ok: '3まいも ひっくりかえった！ ふつうは たくさん とれる ほうが いいよ。', ng: 'もうひとつの ばしょの ほうが たくさん とれるよ' },
  { id: 'o-corner', title: 'かどを とろう', stones: [[0, 1, 2], [0, 2, 1], [4, 4, 2], [4, 5, 1]],
    intro: 'いちばん すみの「かど」は ぜったいに ひっくりかえされない、いちばん だいじな ばしょ。かどに おこう',
    goal: { type: 'cells', cells: [[0, 0]] }, ok: 'かどを とれた！ かどの石は もう ひっくりかえらないよ。', ng: 'かどに おける ところが あるよ' },
  { id: 'o-x', title: 'かどの ななめどなりは あぶない', stones: [[2, 2, 2], [3, 3, 1], [6, 4, 2], [7, 4, 1]],
    intro: 'かどの ななめ となり（X）に おくと、相手に かどを とられやすいよ。X ではない ほうを えらぼう',
    goal: { type: 'cells', cells: [[5, 4]] }, ok: 'あんぜんな ばしょを えらべたね。', ng: 'X に おくと 相手に かどを とられやすいよ。ほかの ばしょを えらぼう' },
];

// ---- 五目並べ（15x15）。黒が1手うって、5つ並べる・止める・伸ばす ----
export const GOMOKU_LESSONS = [
  { id: 'g-five', title: '5つ ならべよう', stones: [[7, 3, 1], [7, 4, 1], [7, 5, 1], [7, 6, 1], [8, 3, 2], [8, 4, 2], [6, 6, 2]],
    intro: 'たて・よこ・ななめ、どれかに おなじ いろを 5つ ならべたら かち。黒の 4つの はしに 1つ たそう',
    goal: { type: 'win' }, ok: '5つ ならんだ！ かち！', ng: '黒の 4つの はし（左か 右）に おこう' },
  { id: 'g-diag', title: 'ななめでも かち', stones: [[3, 3, 1], [4, 4, 1], [5, 5, 1], [6, 6, 1], [3, 4, 2], [4, 5, 2], [5, 6, 2]],
    intro: 'ななめに ならべても おなじ。黒の ななめの 4つの はしに おこう',
    goal: { type: 'win' }, ok: 'ななめで 5つ！', ng: 'ななめの はしに おこう' },
  { id: 'g-block4', title: '相手の 4つを とめよう', stones: [[7, 3, 2], [7, 4, 2], [7, 5, 2], [7, 6, 2], [7, 2, 1], [9, 9, 1]],
    intro: '白が 4つ ならんでる！ 左は ふさがってるけど、右が あいているよ。5つに される まえに ふさごう',
    goal: { type: 'cells', cells: [[7, 7]] }, ok: 'とめた！ 4つ ならんだら すぐ ふさごう。', ng: '白の 4つの 右はしを ふさごう' },
  { id: 'g-open4', title: '3つを 4つにしよう', stones: [[7, 5, 1], [7, 6, 1], [7, 7, 1], [5, 5, 2], [9, 9, 2]],
    intro: '黒が 3つ ならんで、りょうがわが あいているよ。りょうがわが あいた 4つを つくると、どちらか かならず 5つに できるよ',
    goal: { type: 'cells', cells: [[7, 4], [7, 8]] }, ok: 'りょうがわが あいた 4つ！ 相手は 1つしか とめられないから かちだよ。', ng: '3つの すぐ となりに おいてね' },
  { id: 'g-block3', title: '相手の 3つも とめよう', stones: [[7, 5, 2], [7, 6, 2], [7, 7, 2], [5, 5, 1], [9, 9, 1]],
    intro: '白が りょうがわが あいた 3つを つくったよ。ほうっておくと 4つに なって とめられなくなる。いまのうちに ふさごう',
    goal: { type: 'cells', cells: [[7, 4], [7, 8]] }, ok: 'はやめに とめられたね。3つの うちに ふさぐのが コツ。', ng: '白の 3つの はしを ふさごう' },
];

export const LESSON_SETS = { go: GO_LESSONS, othello: OTHELLO_LESSONS, gomoku: GOMOKU_LESSONS };
export const LESSONS = GO_LESSONS; // 互換（囲碁）

// レッスン開始時の盤の状態を作る
export function startState(game, lesson) {
  const rules = { go: goRules, othello, gomoku }[game];
  const s = rules.newState();
  if (lesson.start === 'initial') return s;
  s.b.fill(0);
  for (const [r, c, p] of lesson.stones) s.b[r * rules.SIZE + c] = p;
  return s;
}
