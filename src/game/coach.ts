import { Game } from '../core/game';
import { tr } from '../i18n';

export interface CoachHint {
  step: number;
  title: string;
  body: string;
}

/** First-run advice follows the available action, not a presumed round script. */
export function firstRunCoachHint(game: Game): CoachHint | null {
  if (game.round < 1 || game.round > 3 || game.maintenancePending || game.relicChoices.length > 0
    || (game.phase !== 'prep' && game.phase !== 'combat')) return null;
  const step = game.round;
  if (game.phase === 'combat') {
    return game.canBuyUpgrade
      ? { step, title: tr('전투 중 강화', 'UPGRADE IN COMBAT'), body: tr('골드로 공격력을 강화할 수 있어요. 다음 공격부터 적용됩니다.', 'Spend gold to upgrade damage, starting with the next attack.') }
      : { step, title: tr('전투 관찰', 'WATCH THE BATTLE'), body: game.lifeMode
        ? tr('적이 출구에 닿기 전에 처치하세요. 필요하면 일시정지할 수 있어요.', 'Defeat enemies before they escape. You can pause when needed.')
        : tr('필드 적 수를 살피세요. 필요하면 일시정지할 수 있어요.', 'Watch the enemy count. You can pause when needed.') };
  }
  if (!game.handConfirmed) {
    if (game.dominantSuitChoicesNow.length > 1 && !game.dominantSuitNow) {
      return { step, title: tr('대표 문양 선택', 'CHOOSE A LEAD SUIT'), body: tr('손패 아래 문양 버튼을 눌러 대표 문양을 정하세요.', 'Choose a lead suit using the suit buttons below your hand.') };
    }
    if (game.exchangesRemaining === 0 || !game.exchangeWillRedrawNow || game.gold < game.exchangeCostNow) {
      return { step, title: tr('패 확정', 'CONFIRM YOUR HAND'), body: tr('현재 패를 확정하면 배치할 유닛을 얻습니다.', 'Confirm this hand to recruit a unit for placement.') };
    }
    const held = game.holds.filter(Boolean).length;
    return held > 0
      ? { step, title: tr('HOLD 완료', 'CARDS HELD'), body: tr(`${held}장 잠금 · 나머지를 교환하거나 패를 확정하세요.`, `${held} held · exchange the rest or confirm your hand.`) }
      : { step, title: tr('카드 선택', 'CHOOSE CARDS'), body: tr('남길 카드를 눌러 HOLD하세요. 교환하거나 바로 확정할 수 있어요.', 'Tap cards to HOLD them, then exchange or confirm your hand.') };
  }
  if (game.pendingUnits.length > 0) {
    return { step, title: tr('유닛 배치', 'PLACE YOUR UNIT'), body: tr('금색 점선 추천 칸에 유닛을 배치하세요.', 'Place your unit on a gold dashed recommended tile.') };
  }
  return { step, title: tr('전투 시작', 'START COMBAT'), body: tr('배치가 끝났어요. 전투 시작 버튼을 누르세요.', 'Placement is complete. Press START COMBAT.') };
}

export function retryRunLabel(daily: boolean): string {
  return daily ? tr('같은 일일 도전', 'SAME DAILY CHALLENGE') : tr('새 원정 시작', 'NEW RUN');
}
