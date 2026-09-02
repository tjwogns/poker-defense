import Phaser from 'phaser';
import { UI, makeButton, makeText } from './ui';
import { isPortraitLayout } from './device';
import { portraitSceneHeight, portraitY } from './layout';

/** 진행 중인 판을 실수로 버리지 않도록 막는 확인 모달. */
export class ExitConfirmOverlay {
  private root: Phaser.GameObjects.Container;

  constructor(scene: Phaser.Scene, onCancel: () => void, onConfirm: () => void) {
    const portrait = isPortraitLayout();
    const height = portraitSceneHeight(scene);
    const py = (value: number) => portraitY(height, value);
    const cx = portrait ? 195 : 640;
    const children: Phaser.GameObjects.GameObject[] = [];
    const dim = scene.add.rectangle(cx, portrait ? height / 2 : 360, portrait ? 390 : 1280, portrait ? height : 720, 0x020705, 0.78).setInteractive();
    const shadow = scene.add.rectangle(cx, portrait ? py(423) : 363, portrait ? 350 : 500, 250, 0x000000, 0.48);
    const panel = scene.add.rectangle(cx, portrait ? py(416) : 356, portrait ? 350 : 500, 250, UI.panel, 1)
      .setStrokeStyle(2, UI.panelGlow, 0.95);
    children.push(dim, shadow, panel);

    children.push(
      makeText(scene, cx, portrait ? py(352) : 292, '진행 중인 게임에서 나갈까요?', portrait ? 20 : 24, UI.text, true).setOrigin(0.5),
      makeText(scene, cx, portrait ? py(392) : 332, '현재 판의 진행 내용은 저장되지 않습니다.', portrait ? 12 : 14, UI.dangerText).setOrigin(0.5),
    );

    const cancel = makeButton(scene, portrait ? 104 : 530, portrait ? py(462) : 402, portrait ? 158 : 190, 48, '계속 플레이', onCancel, {
      fill: UI.accent,
      fontSize: 15,
    });
    const confirm = makeButton(scene, portrait ? 286 : 750, portrait ? py(462) : 402, portrait ? 158 : 190, 48, '나가기', onConfirm, {
      fill: UI.danger,
      fontSize: 15,
    });
    children.push(cancel.container, confirm.container);

    children.push(
      makeText(scene, cx, portrait ? py(509) : 449, 'ESC로 돌아가기', 11, UI.textDim).setOrigin(0.5),
    );

    this.root = scene.add.container(0, 0, children).setDepth(50);
  }

  destroy(): void {
    this.root.destroy(true);
  }
}
