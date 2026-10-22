// 級：全レッスンの★の合計で決まる（しきい値は levels.json の kyu）
export function totalStars(person, lessonIds) {
  return lessonIds.reduce((sum, id) => sum + (person?.lessons?.[id]?.stars || 0), 0);
}

export function kyuOf(stars, kyuTable) {
  let k = kyuTable[0].kyu;
  for (const row of kyuTable) if (stars >= row.stars) k = row.kyu;
  return k;
}
