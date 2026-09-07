import { tr } from '../i18n';

export interface BossMechanicStatus {
  text: string;
  urgent: boolean;
}

export function bossMechanicStatus(
  round: number,
  hpRatio: number,
  countdown: number | null,
): BossMechanicStatus {
  if (round === 10) return { text: tr('방어막 활성 · 받는 피해 35% 감소', 'Shield active · damage taken reduced by 35%'), urgent: false };
  if (round === 20) return { text: tr('혈월 재생 중 · 초당 최대 HP 2%', 'Blood Moon regeneration · 2% max HP per second'), urgent: false };
  if (round === 30) return { text: tr('시간 가속 중 · 이동 속도 60% 증가', 'Time acceleration · movement speed increased by 60%'), urgent: false };
  if (round === 40 && countdown !== null) {
    return { text: tr(`골드 강탈까지 ${countdown.toFixed(1)}초 · −5G`, `${countdown.toFixed(1)}s until gold theft · −5G`), urgent: countdown <= 1.5 };
  }
  if (round === 50 && countdown !== null) {
    return { text: tr(`부하 소환까지 ${countdown.toFixed(1)}초 · 2기`, `${countdown.toFixed(1)}s until summon · 2 minions`), urgent: countdown <= 1.5 };
  }
  if (round >= 60 && hpRatio <= 0.5) return { text: tr('광폭화! · 속도 증가 · 받는 피해 감소', 'ENRAGED! · speed increased · damage taken reduced'), urgent: true };
  if (round >= 60) return { text: tr('HP 50% 아래에서 광폭화', 'Enrages below 50% HP'), urgent: false };
  return { text: '', urgent: false };
}
