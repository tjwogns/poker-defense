import Phaser from 'phaser';
import { UNIT_DEFS } from '../core/units';
import { UI, makeButton, makeText } from './ui';
import { HANDBOOK_ROWS } from './guideData';

/** 족보 성립 조건과 획득 유닛을 게임 중 확인하는 모달 도감. */
export class GuideOverlay {
  private root: Phaser.GameObjects.Container;

  constructor(scene: Phaser.Scene, onClose: () => void) {
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
      const y = 190 + index * 42;
      const def = UNIT_DEFS[row.rank];
      if (index % 2 === 0) {
        children.push(scene.add.rectangle(640, y, 1010, 36, UI.panelRaised, 0.7));
      }
      const badge = scene.add.rectangle(112, y, 5, 24, def.color, 1);
      children.push(
        badge,
        makeText(scene, 130, y, row.hand, 13, UI.text, true).setOrigin(0, 0.5),
        makeText(scene, 330, y, row.rule, 12, UI.textDim).setOrigin(0, 0.5),
        makeText(scene, 635, y, `${def.glyph}  ${row.unit}`, 13, `#${def.color.toString(16).padStart(6, '0')}`, true).setOrigin(0, 0.5),
        makeText(scene, 795, y, row.trait, 12, UI.textDim).setOrigin(0, 0.5),
      );
    });

    children.push(
      makeText(scene, 120, 622, 'TIP', 11, UI.accentText, true),
      makeText(scene, 165, 622, '같은 등급 유닛 3기를 합성하면 바로 다음 등급 유닛이 됩니다.', 13, UI.text, true),
      makeText(scene, 120, 650, 'H로 언제든 도감을 열 수 있습니다 · ESC 또는 닫기 버튼으로 돌아가기', 11, UI.textDim),
    );

    this.root = scene.add.container(0, 0, children).setDepth(40);
  }

  destroy(): void {
    this.root.destroy(true);
  }
}
