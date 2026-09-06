import { Game } from '../core/game';
import { aliveEnemies } from '../core/combat';
import { tr } from '../i18n';

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
        ? { step: 1, title: tr('HOLD 완료', 'CARDS HELD'), body: tr(`${held}장 잠금 · 나머지를 교환하거나 족보를 확정하세요.`, `${held} locked · exchange the rest or confirm your hand.`) }
        : { step: 1, title: tr('카드 선택', 'CHOOSE CARDS'), body: tr('같은 숫자·무늬를 눌러 HOLD한 뒤 나머지만 교환하세요.', 'Tap matching ranks or suits to HOLD them, then exchange the rest.') };
    }
    if (game.phase === 'prep' && game.pendingUnits.length > 0) {
      return { step: 1, title: tr('첫 유닛 배치', 'PLACE YOUR FIRST UNIT'), body: tr('금빛 ◆ 추천 칸 또는 ✓ 표시 칸에 유닛을 배치하세요.', 'Place the unit on a gold ◆ recommended tile or a ✓ valid tile.') };
    }
    return {
      step: 1,
      title: tr('첫 전투', 'START YOUR FIRST BATTLE'),
      body: game.lifeMode
        ? tr(`왕국 라이프 ${game.lives} · 적이 한 바퀴를 완주하기 전에 처치하세요.`, `${game.lives} kingdom lives · defeat enemies before they complete the path.`)
        : tr(`필드 적 ${aliveEnemies(game.field).length}/${game.fieldCap} · ${game.fieldCap}기를 초과하기 전에 처치하세요.`, `Field threat ${aliveEnemies(game.field).length}/${game.fieldCap} · stay below ${game.fieldCap} enemies.`),
    };
  }
  if (game.round === 2) {
    if (game.phase === 'prep') {
      return { step: 2, title: tr('사거리와 성장', 'RANGE AND GROWTH'), body: tr('추천 칸은 경로에 닿습니다. 필요하면 강화하거나 기존 유닛을 재배치하세요.', 'Recommended tiles can reach the path. Upgrade or move units when needed.') };
    }
    return game.lifeMode
      ? { step: 2, title: tr('라이프 지키기', 'PROTECT YOUR LIVES'), body: tr('빠른 적은 입구와 마지막 코너 양쪽에서 공격해 탈출을 막으세요.', 'Cover both the entrance and final corner to stop fast enemies escaping.') }
      : { step: 2, title: tr('위험도 읽기', 'READ THE THREAT'), body: tr('필드 적 수가 60%·80%에 닿으면 주황·빨강 경고가 표시됩니다.', 'Threat turns orange at 60% and red at 80% capacity.') };
  }
  return {
    step: 3,
    title: tr('빌드 만들기', 'BUILD YOUR ARMY'),
    body: tr('우측 BUILD에서 연마 상태를 확인하고, 합성과 유물로 화력을 집중하세요.', 'Check BUILD, then focus your power with fusion and relics.'),
  };
}
