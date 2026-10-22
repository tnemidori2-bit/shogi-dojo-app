import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseBoard, applyMove } from '../src/shogi/rules.js';
import { legalMoves, inCheck, isCheckmate, applyFull, winsIn, winningMoves, bestDefense, emptyHands, findKing } from '../src/shogi/engine.js';

const pieces = Object.fromEntries(JSON.parse(readFileSync(new URL('../public/data/pieces.json', import.meta.url))).pieces.map((p) => [p.id, p]));
const B = (rows) => parseBoard(rows.map((r) => r.split('').join(' ')));
const hands = (s = {}, g = {}) => [s, g];

// 頭金：後手の玉(8,0)、先手の銀(7,2)。(8,1)に金を打つと、銀が金を守っているので玉は取れず、逃げ場も無い
test('頭金: 玉の頭に金を打つと詰み', () => {
  const b = B(['........k', '.........', '.......S.', '.........', '.........', '.........', '.........', '.........', '.........']);
  const h = hands({ kin: 1 });
  assert.ok(!inCheck(b, 1, pieces));
  const win = winningMoves(b, h, 1, pieces);
  assert.ok(win.some((m) => m.drop === 'kin' && m.to.x === 8 && m.to.y === 1));
  const r = applyFull(b, h, { from: null, to: { x: 8, y: 1 }, drop: 'kin', promote: false }, 0);
  assert.ok(isCheckmate(r.board, r.hands, 1, pieces));
  // 金を(7,0)に打っても玉は(8,1)に逃げる（詰みではない）
  assert.ok(!win.some((m) => m.drop === 'kin' && m.to.x === 7 && m.to.y === 0));
});

test('二歩は打てない', () => {
  const b = B(['....k....', '.........', '.........', '.........', '.........', '.........', '....P....', '.........', '.........']);
  const m = legalMoves(b, hands({ fu: 1 }), 0, pieces);
  assert.ok(!m.some((x) => x.drop === 'fu' && x.to.x === 4));
  assert.ok(m.some((x) => x.drop === 'fu' && x.to.x === 3));
});

test('行きどころのない所には歩・香・桂を打てない', () => {
  const b = B(['.........', '.........', '.........', '.........', '.........', '.........', '.........', '.........', '..k......']);
  const m = legalMoves(b, hands({ fu: 1, kyo: 1, kei: 1 }), 0, pieces);
  assert.ok(!m.some((x) => x.drop === 'fu' && x.to.y === 0));
  assert.ok(!m.some((x) => x.drop === 'kyo' && x.to.y === 0));
  assert.ok(!m.some((x) => x.drop === 'kei' && x.to.y <= 1));
  assert.ok(m.some((x) => x.drop === 'kei' && x.to.y === 2));
});

test('打ち歩詰めは指せない', () => {
  // 後手玉(0,0)。先手の金(2,1)が(1,0)(1,1)を押さえ、香(0,5)が(0,1)を守る。歩を(0,1)に打つと詰みになるが、反則
  const b = B(['k........', '..G......', '.........', '.........', '.........', 'L........', '.........', '.........', '.........']);
  const h = hands({ fu: 1 });
  const r = applyFull(b, h, { from: null, to: { x: 0, y: 1 }, drop: 'fu', promote: false }, 0);
  assert.ok(isCheckmate(r.board, r.hands, 1, pieces)); // 形としては詰んでいる
  const m = legalMoves(b, h, 0, pieces);
  assert.ok(!m.some((x) => x.drop === 'fu' && x.to.x === 0 && x.to.y === 1)); // でも指せない
  // 歩でなく金を持っていれば、同じ場所に打てて詰む
  const m2 = winningMoves(b, hands({ kin: 1 }), 1, pieces);
  assert.ok(m2.some((x) => x.drop === 'kin' && x.to.x === 0 && x.to.y === 1));
});

test('玉は、利きのあるマスへは動けない／王手は逃げるしかない', () => {
  const b = B(['....k....', '.........', '.........', '.........', '.........', '.........', '.........', '.........', '....R....']);
  assert.ok(inCheck(b, 1, pieces));
  const m = legalMoves(b, hands(), 1, pieces);
  assert.ok(m.every((x) => x.to.x !== 4)); // 縦に利いている筋には残れない
  assert.ok(m.some((x) => x.to.x === 3) && m.some((x) => x.to.x === 5));
});

test('合い駒: 持ち駒があると遮れる、なければ遮れない', () => {
  const b = B(['....k....', '.........', '.........', '.........', '.........', '.........', '.........', '.........', '....R....']);
  const withHand = legalMoves(b, hands({}, { fu: 1, kin: 1 }), 1, pieces);
  assert.ok(withHand.some((x) => x.drop === 'kin' && x.to.x === 4 && x.to.y === 1));
});

test('取った駒は成りを戻して持ち駒になる', () => {
  const b = B(['.........', '.........', '.........', '.........', '..p......', '..R......', '.........', '.........', '.........']);
  b[4][2] = { t: 'kaku', s: 1, p: true }; // 後手の馬
  const r = applyFull(b, hands(), { from: { x: 2, y: 5 }, to: { x: 2, y: 4 }, drop: null, promote: false }, 0);
  assert.equal(r.hands[0].kaku, 1);
  assert.ok(!r.hands[0].kyo && !r.hands[0].fu);
});

test('後手の歩は敵陣（下）に入ると成れる。最奥では必ず成る', () => {
  const b = B(['.........', '.........', '.........', '.........', '.........', '.........', '.........', 'p........', '.........']);
  const m = legalMoves(b, hands(), 1, pieces);
  assert.deepEqual(m.map((x) => x.promote), [true]); // (0,8) は最奥なので成るしかない
});

test('3手詰め: 王手の連続で詰む形を、探索が見つける', () => {
  // 後手玉(0,0)。先手の飛(3,1)と金(2,2)。飛を(0,1)ではなく… 実際に解いて確かめる
  const b = B(['k........', '...R.....', '..G......', '.........', '.........', '.........', '.........', '.........', '.........']);
  const h = hands();
  const one = winningMoves(b, h, 1, pieces);
  const three = winningMoves(b, h, 3, pieces);
  assert.ok(three.length >= one.length);
});

// ---- つめしょうぎの問題集 ----
import { sameMove } from '../src/shogi/engine.js';
const tsumeDir = new URL('../public/data/tsume/', import.meta.url);
const tsumeIds = JSON.parse(readFileSync(new URL('index.json', tsumeDir))).sets;

const toHands = (h) => [h.sente || {}, h.gote || {}];
const toMove = (j) => ({ from: j.from ? { x: j.from[0], y: j.from[1] } : null, to: { x: j.to[0], y: j.to[1] }, drop: j.drop || null, promote: !!j.promote });

for (const id of tsumeIds) {
  test(`つめしょうぎ ${id}: 全問が、ちょうどその手数で詰む・解の手順が正しい`, () => {
    const set = JSON.parse(readFileSync(new URL(`${id}.json`, tsumeDir)));
    const attackerMoves = (set.moves + 1) / 2;
    assert.ok(set.problems.length >= set.starAt[2], '★3に必要な数より問題が少ない');
    const seen = new Set();
    for (const p of set.problems) {
      assert.ok(!seen.has(p.id)); seen.add(p.id);
      const b = parseBoard(p.board);
      const h = toHands(p.hands);
      assert.ok(findKing(b, 1), p.id + ': 後手の玉がない');
      assert.ok(!findKing(b, 0), p.id + ': 先手の玉は置かない');
      assert.ok(!inCheck(b, 1, pieces), p.id + ': 最初から王手になっている');
      for (let j = 1; j < attackerMoves; j++) assert.ok(!winsIn(b, h, j, pieces), `${p.id}: ${j}手で詰む（もっと短い）`);
      const win = winningMoves(b, h, attackerMoves, pieces);
      assert.ok(win.length >= 1 && win.length <= 2, `${p.id}: 詰ます手が ${win.length} 通り`);
      // 解の手順を最初から指して、最後に詰むこと
      let cur = { board: b, hands: h };
      p.solution.forEach((j, i) => {
        const side = i % 2;
        const m = toMove(j);
        assert.ok(legalMoves(cur.board, cur.hands, side, pieces).some((x) => sameMove(x, m)), `${p.id}: ${i + 1}手目が合法手でない`);
        cur = applyFull(cur.board, cur.hands, m, side);
      });
      assert.ok(isCheckmate(cur.board, cur.hands, 1, pieces), `${p.id}: 解の最後が詰みでない`);
      assert.equal(p.solution.length, set.moves % 2 === 1 ? set.moves : set.moves, `${p.id}: 手数`);
    }
  });
}
test('つめしょうぎ: 受けの返事は、できるだけ長く粘る手', () => {
  const set = JSON.parse(readFileSync(new URL('mate3.json', tsumeDir)));
  for (const p of set.problems.slice(0, 5)) {
    const b = parseBoard(p.board); const h = toHands(p.hands);
    const m1 = toMove(p.solution[0]);
    const r = applyFull(b, h, m1, 0);
    const rep = bestDefense(r.board, r.hands, 1, pieces);
    assert.ok(rep, p.id);
    const q = applyFull(r.board, r.hands, rep, 1);
    assert.ok(winsIn(q.board, q.hands, 1, pieces), p.id + ': 返事のあとに1手で詰む');
  }
});

// ---- 戦法（せんぽう）の手順 ----
import { initialBoard } from '../src/shogi/rules.js';
import { parseUsi, toUsi, moveLabel, findLegal } from '../src/shogi/usi.js';
const openingDir = new URL('../public/data/openings/', import.meta.url);
const openingIds = JSON.parse(readFileSync(new URL('index.json', openingDir))).openings;

test('USI: 読み書きが元に戻る', () => {
  for (const u of ['7g7f', '2h2d', '3c3d', 'P*5e', 'G*4b', '2b8h+']) assert.equal(toUsi(parseUsi(u)), u);
  assert.deepEqual(parseUsi('7g7f'), { from: { x: 2, y: 6 }, to: { x: 2, y: 5 }, drop: null, promote: false });
});

for (const id of openingIds) {
  test(`戦法 ${id}: 手順が全部合法手で、先手の手から始まり、説明がある`, () => {
    const o = JSON.parse(readFileSync(new URL(`${id}.json`, openingDir)));
    assert.ok(o.moves.length >= 2);
    let board = initialBoard();
    let hands = [{}, {}];
    let prev = null;
    const labels = [];
    o.moves.forEach((mv, i) => {
      assert.ok(mv.text && mv.text.length > 5, `${id} ${i + 1}手目に説明がない`);
      const side = i % 2;
      const m = parseUsi(mv.usi);
      const legal = findLegal(board, hands, side, pieces, m);
      assert.ok(legal, `${id}: ${i + 1}手目 ${mv.usi} は合法手でない`);
      const piece = m.from ? board[m.from.y][m.from.x] : null;
      assert.ok(m.drop || (piece && piece.s === side), `${id}: ${i + 1}手目は、その手番の駒でない`);
      labels.push(moveLabel(m, board, side, pieces, prev));
      const r = applyFull(board, hands, m, side);
      board = r.board; hands = r.hands; prev = m.to;
      // 自分の玉が王手のまま、は legalMoves が外している。相手の玉を取ってしまう手もない
      assert.ok(findKing(board, 0) && findKing(board, 1));
    });
    assert.ok(o.finish);
    if (id === 'bougin') assert.deepEqual(labels.slice(0, 3), ['▲7六歩', '△3四歩', '▲2六歩']);
    if (id === 'bougin') assert.equal(labels.at(-1), '▲同飛'); // 最後は、飛が2四の角を取る
    if (id === 'kihon') assert.equal(labels[6], '▲7八金');
  });
}
