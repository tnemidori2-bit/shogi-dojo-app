// 級：全レッスン・全ドリル・全つめしょうぎの★の合計で決まる（しきい値は levels.json の kyu）

// つめしょうぎ1セットの★：とけた問題の数が starAt（3つ）に届いた数
export function tsumeSolved(person, set) {
  return set.problems.filter((p) => (person?.tsume?.[p.id]?.solves || 0) > 0).length;
}
export function tsumeStars(person, set) {
  const n = tsumeSolved(person, set);
  return set.starAt.filter((a) => n >= a).length;
}

// 戦法の★：まなぶ=1、ためすクリア=2、ためすを まちがいなし（ヒントなし）で=3
export function openingStars(person, id) {
  const r = person?.openings?.[id];
  return r ? (r.learned ? 1 : 0) + (r.clears > 0 ? 1 : 0) + (r.perfect ? 1 : 0) : 0;
}

export function totalStars(person, lessonIds, drillIds = [], tsumeSets = [], openingIds = []) {
  const l = lessonIds.reduce((sum, id) => sum + (person?.lessons?.[id]?.stars || 0), 0);
  const d = drillIds.reduce((sum, id) => sum + (person?.drills?.[id]?.stars || 0), 0);
  const t = tsumeSets.reduce((sum, set) => sum + tsumeStars(person, set), 0);
  const o = openingIds.reduce((sum, id) => sum + openingStars(person, id), 0);
  return l + d + t + o;
}

export function kyuOf(stars, kyuTable) {
  let k = kyuTable[0].kyu;
  for (const row of kyuTable) if (stars >= row.stars) k = row.kyu;
  return k;
}
