// 囲碁レッスン。黒（じぶん）が1手うって、goal を満たせば「できた」。白は動かない
// stones: [行, 列, 色] の配列（1=黒, 2=白）。goal の type:
//   place … どこでもよい／cells … 指定の点のどれか／capture … 石を n 個以上とる
//   atari … 白のかたまりが呼吸点1つになる／escape … stone の黒が呼吸点2つ以上になる／illegal … 指定の点が「おけない」と分かる
import { group } from './go.js';

export const LESSONS = [
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
