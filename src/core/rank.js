// 級：全レッスンと全ドリルの★の合計で決まる（しきい値は levels.json の kyu）
export function totalStars(person, lessonIds, drillIds = []) {
  const l = lessonIds.reduce((sum, id) => sum + (person?.lessons?.[id]?.stars || 0), 0);
  const d = drillIds.reduce((sum, id) => sum + (person?.drills?.[id]?.stars || 0), 0);
  return l + d;
}

export function kyuOf(stars, kyuTable) {
  let k = kyuTable[0].kyu;
  for (const row of kyuTable) if (stars >= row.stars) k = row.kyu;
  return k;
}
