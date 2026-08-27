import Phaser from 'phaser';
import { HAND_NAMES_KO, HandRank } from '../core/cards/types';
import { RerollOdds } from '../core/cards/odds';
import { UI, makeButton, makeText } from './ui';

export class OddsOverlay {
  private root: Phaser.GameObjects.Container;

  constructor(scene: Phaser.Scene, odds: RerollOdds, onClose: () => void) {
    const children: Phaser.GameObjects.GameObject[] = [];
    const dim = scene.add.rectangle(640, 360, 1280, 720, 0x020705, 0.88).setInteractive();
    const shadow = scene.add.rectangle(640, 363, 760, 620, 0x000000, 0.45);
    const panel = scene.add.rectangle(640, 356, 760, 620, UI.panel, 1)
      .setStrokeStyle(2, UI.panelGlow, 0.95);
    children.push(dim, shadow, panel);

    children.push(
      makeText(scene, 300, 67, 'REROLL ODDS', 11, UI.accentText, true),
      makeText(scene, 300, 89, '전체 족보 확률', 29, UI.text, true),
      makeText(
        scene,
        300,
        128,
        `${odds.drawCount}장 교체 · 상승 ${formatOddsPercent(odds.improveProbability)} · ${odds.totalCombinations.toLocaleString()}개 조합`,
        13,
        UI.textDim,
      ),
    );
    const close = makeButton(scene, 930, 90, 110, 36, '닫기  ESC', onClose, {
      fill: 0x42544a,
      fontSize: 11,
    });
    children.push(close.container);

    const maxProbability = Math.max(...odds.probabilities);
    for (let rank = HandRank.HighCard; rank <= HandRank.RoyalFlush; rank++) {
      const probability = odds.probabilities[rank];
      const y = 176 + rank * 40;
      const improved = rank > odds.currentRank;
      const current = rank === odds.currentRank;
      const color = improved ? UI.gold : current ? UI.text : UI.textDim;
      if (rank % 2 === 0) children.push(scene.add.rectangle(640, y, 660, 34, UI.panelRaised, 0.65));
      const barWidth = probability > 0 ? Math.max(2, 300 * probability / maxProbability) : 0;
      children.push(
        makeText(scene, 320, y, HAND_NAMES_KO[rank as HandRank], 13, color, improved || current).setOrigin(0, 0.5),
        scene.add.rectangle(520, y, 300, 8, UI.panelDeep, 1).setOrigin(0, 0.5),
        scene.add.rectangle(520, y, barWidth, 8, improved ? 0xe6c84f : current ? UI.accent : 0x60746a, 0.9).setOrigin(0, 0.5),
        makeText(scene, 960, y, formatOddsPercent(probability), 13, color, improved).setOrigin(1, 0.5),
      );
    }

    children.push(
      makeText(scene, 300, 590, '금색은 현재 족보보다 높은 결과입니다. 실제 교환은 현재 패 5장을 제외한 47장에서 뽑습니다.', 11, UI.textDim),
      makeText(scene, 300, 614, '확률은 판단 정보이며 필드 시너지·필요 유닛·교환 비용에 따라 최선의 선택은 달라집니다.', 11, UI.textDim),
    );
    this.root = scene.add.container(0, 0, children).setDepth(45);
  }

  destroy(): void {
    this.root.destroy(true);
  }
}

export function formatOddsPercent(probability: number): string {
  if (probability <= 0) return '—';
  if (probability < 0.001) return '<0.1%';
  return `${(probability * 100).toFixed(1)}%`;
}
