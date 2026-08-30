export function bossSpriteExtent(round: number): number {
  return round >= 60 ? 62 : 56;
}

export function bossIntroDuration(round: number): number {
  return round >= 60 ? 900 : 720;
}
