import Phaser from 'phaser';
import { UNIT_DEFS } from '../core/units';
import { UI, makeButton, makeText } from './ui';
import { HANDBOOK_ROWS } from './guideData';
import { HandRank, isHiddenHand } from '../core/cards/types';

/** 족보 성립 조건과 획득 유닛을 게임 중 확인하는 모달 도감. */
export class GuideOverlay {
  private root: Phaser.GameObjects.Container;

  constructor(scene: Phaser.Scene, discoveredHands: readonly HandRank[], onClose: () => void) {
    const children: Phaser.GameObjects.GameObject[] = [];
    const dim = scene.add.rectangle(640, 360, 1280, 720, 0x020705, 0.86).setInteractive();
    const shadow = scene.add.rectangle(640, 363, 1100, 660, 0x000000, 0.45);
    const panel = scene.add.rectangle(640, 356, 1100, 660, UI.panel, 1)
      .setStrokeStyle(2, UI.panelGlow, 0.95);
    children.push(dim, shadow, panel);

    children.push(
      makeText(scene, 120, 54, 'POKER DEFENSE ARCHIVE', 11, UI.accentText, true),
      makeText(scene, 120, 73, '족보 · 유닛 도감', 28, UI.text, true),
      makeText(scene, 120, 108, '낮은 족보부터 높은 족보 순서입니다. 족보를 확정하면 대응 유닛 1기를 얻습니다.', 13, UI.textDim),
    );

    const close = makeButton(scene, 1110, 78, 110, 36, '닫기  ESC', onClose, {
      fill: 0x42544a,
      fontSize: 11,
    });
    children.push(close.container);

    const headerY = 144;
    children.push(
      makeText(scene, 130, headerY, '족보', 11, UI.gold, true),
      makeText(scene, 330, headerY, '성립 조건', 11, UI.gold, true),
      makeText(scene, 635, headerY, '획득 유닛', 11, UI.gold, true),
      makeText(scene, 795, headerY, '전투 특성', 11, UI.gold, true),
    );
    const divider = scene.add.rectangle(640, 166, 1020, 1, UI.panelLine, 1);
    children.push(divider);

    HANDBOOK_ROWS.forEach((row, index) => {
      const y = 181 + index * 31;
      const def = UNIT_DEFS[row.rank];
      if (index % 2 === 0) {
        children.push(scene.add.rectangle(640, y, 1010, 28, UI.panelRaised, 0.7));
      }
      const hidden = isHiddenHand(row.rank);
      const discovered = !hidden || discoveredHands.includes(row.rank);
      const badge = scene.add.rectangle(112, y, 5, 20, discovered ? def.color : 0x59645e, 1);
      children.push(
        badge,
        makeText(scene, 130, y, discovered ? row.hand : '???', 12, discovered ? UI.text : UI.gold, true).setOrigin(0, 0.5),
        makeText(scene, 330, y, discovered ? row.rule : '덱을 개조해 비밀 족보를 발견하세요', 11, UI.textDim).setOrigin(0, 0.5),
        makeText(
          scene,
          635,
          y,
          discovered ? `${def.glyph}  ${row.unit}` : '잠김',
          11,
          discovered ? `#${def.color.toString(16).padStart(6, '0')}` : UI.textDim,
          true,
        ).setOrigin(0, 0.5),
        makeText(scene, 795, y, discovered ? row.trait : '한 번 완성하면 영구 공개', 11, UI.textDim).setOrigin(0, 0.5),
      );
    });

    children.push(
      makeText(scene, 120, 582, 'SPECIAL', 9, UI.gold, true),
      makeText(scene, 185, 582, '마운틴 10-J-Q-K-A: 피해 +25% · 백스트레이트 A-2-3-4-5: 공격 속도 +18%', 9, UI.text, true),
      makeText(scene, 120, 602, 'SUITS', 9, UI.accentText, true),
      makeText(scene, 170, 602, '♠ 보스 +12% · ♥ 공속 +11% · ♦ 처치 +1G(라운드 3G) · ♣ 일반 적 +10% · 2-2-1은 직접 선택', 9, UI.text, true),
      makeText(scene, 120, 622, 'BUILD', 9, UI.accentText, true),
      makeText(scene, 170, 622, '유물 · 족보 연마 · 대표 문양을 조합해 주력 화력을 완성하세요', 9, UI.text, true),
      makeText(scene, 120, 642, 'FUSION', 9, UI.gold, true),
      makeText(scene, 170, 642, '동일 3기 선택 합성 · 첫 기준 유닛의 위치와 대표 문양 계승', 9, UI.text, true),
      makeText(scene, 120, 668, 'H로 언제든 도감을 열 수 있습니다 · 히든 족보는 첫 발견 후 조건과 유닛이 공개됩니다.', 9, UI.textDim),
    );

    this.root = scene.add.container(0, 0, children).setDepth(40);
  }

  destroy(): void {
    this.root.destroy(true);
  }
}
