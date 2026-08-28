import { Game } from '../core/game';
import { aliveEnemies } from '../core/combat';

export interface CoachHint {
  step: number;
  title: string;
  body: string;
}

/** 첫 세 라운드의 실제 상태에 맞춰 다음 행동 하나만 안내한다. */
export function firstRunCoachHint(game: Game): CoachHint | null {
  if (game.round < 1 || game.round > 3) return null;
  if (game.round === 1) {
    if (game.phase === 'prep' && !game.handConfirmed) {
      const held = game.holds.filter(Boolean).length;
      return held > 0
        ? { step: 1, title: 'HOLD 완료', body: `${held}장 잠금 · 나머지를 교환하거나 족보를 확정하세요.` }
        : { step: 1, title: '카드 선택', body: '같은 숫자·무늬를 눌러 HOLD한 뒤 나머지만 교환하세요.' };
    }
    if (game.phase === 'prep' && game.pendingUnits.length > 0) {
      return { step: 1, title: '첫 유닛 배치', body: '금빛 ◆ 추천 칸 또는 ✓ 표시 칸에 유닛을 배치하세요.' };
    }
    return { step: 1, title: '첫 전투', body: `필드 적 ${aliveEnemies(game.field).length}/${game.fieldCap} · 80기가 되기 전에 처치하세요.` };
  }
  if (game.round === 2) {
    if (game.phase === 'prep') {
      return { step: 2, title: '사거리와 성장', body: '추천 칸은 경로에 닿습니다. 필요하면 강화하거나 기존 유닛을 재배치하세요.' };
    }
    return { step: 2, title: '위험도 읽기', body: '필드 적 수가 60%·80%에 닿으면 주황·빨강 경고가 표시됩니다.' };
  }
  return {
    step: 3,
    title: '빌드 만들기',
    body: '우측 BUILD에서 다음 시너지 조건을 확인하고, 무늬 스킬로 위기를 넘기세요.',
  };
}
