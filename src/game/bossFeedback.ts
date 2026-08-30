export interface BossMechanicStatus {
  text: string;
  urgent: boolean;
}

export function bossMechanicStatus(
  round: number,
  hpRatio: number,
  countdown: number | null,
): BossMechanicStatus {
  if (round === 10) return { text: '방어막 활성 · 받는 피해 35% 감소', urgent: false };
  if (round === 20) return { text: '혈월 재생 중 · 초당 최대 HP 2%', urgent: false };
  if (round === 30) return { text: '시간 가속 중 · 이동 속도 60% 증가', urgent: false };
  if (round === 40 && countdown !== null) {
    return { text: `골드 강탈까지 ${countdown.toFixed(1)}초 · −5G`, urgent: countdown <= 1.5 };
  }
  if (round === 50 && countdown !== null) {
    return { text: `부하 소환까지 ${countdown.toFixed(1)}초 · 2기`, urgent: countdown <= 1.5 };
  }
  if (round >= 60 && hpRatio <= 0.5) return { text: '광폭화! · 속도 증가 · 받는 피해 감소', urgent: true };
  if (round >= 60) return { text: 'HP 50% 아래에서 광폭화', urgent: false };
  return { text: '', urgent: false };
}
