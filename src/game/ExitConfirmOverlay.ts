import Phaser from 'phaser';
import { UI, makeButton, makeText } from './ui';

/** 진행 중인 판을 실수로 버리지 않도록 막는 확인 모달. */
export class ExitConfirmOverlay {
  private root: Phaser.GameObjects.Container;

  constructor(scene: Phaser.Scene, onCancel: () => void, onConfirm: () => void) {
    const children: Phaser.GameObjects.GameObject[] = [];
    const dim = scene.add.rectangle(640, 360, 1280, 720, 0x020705, 0.78).setInteractive();
    const shadow = scene.add.rectangle(640, 363, 500, 250, 0x000000, 0.48);
    const panel = scene.add.rectangle(640, 356, 500, 250, UI.panel, 1)
      .setStrokeStyle(2, UI.panelGlow, 0.95);
    children.push(dim, shadow, panel);

    children.push(
      makeText(scene, 640, 292, '진행 중인 게임에서 나갈까요?', 24, UI.text, true).setOrigin(0.5),
      makeText(scene, 640, 332, '현재 판의 진행 내용은 저장되지 않습니다.', 14, UI.dangerText).setOrigin(0.5),
    );

    const cancel = makeButton(scene, 530, 402, 190, 48, '계속 플레이', onCancel, {
      fill: UI.accent,
      fontSize: 15,
    });
    const confirm = makeButton(scene, 750, 402, 190, 48, '나가기', onConfirm, {
      fill: UI.danger,
      fontSize: 15,
    });
    children.push(cancel.container, confirm.container);

    children.push(
      makeText(scene, 640, 449, 'ESC로 돌아가기', 11, UI.textDim).setOrigin(0.5),
    );

    this.root = scene.add.container(0, 0, children).setDepth(50);
  }

  destroy(): void {
    this.root.destroy(true);
  }
}
