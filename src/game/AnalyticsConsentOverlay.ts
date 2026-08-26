import Phaser from 'phaser';
import { UI, makeButton, makeText } from './ui';

export class AnalyticsConsentOverlay {
  private root: Phaser.GameObjects.Container;

  constructor(scene: Phaser.Scene, onChoice: (allowed: boolean) => void) {
    const dim = scene.add.rectangle(640, 360, 1280, 720, 0x06100a, 0.9).setInteractive();
    const panel = scene.add.rectangle(640, 350, 680, 350, UI.panel, 1)
      .setStrokeStyle(2, UI.accent, 0.75);
    const eyebrow = makeText(scene, 640, 225, 'PLAYTEST DATA', 13, UI.accentText, true).setOrigin(0.5);
    const title = makeText(scene, 640, 270, '익명 플레이 기록을 허용할까요?', 27, UI.text, true).setOrigin(0.5);
    const body = makeText(
      scene,
      640,
      326,
      '게임 개선을 위해 라운드 도달, 선택, 결과만 기록합니다.\n이름·이메일·카드 내용은 수집하지 않으며 언제든 DATA 버튼에서 끌 수 있습니다.',
      15,
      UI.textDim,
    ).setOrigin(0.5, 0).setAlign('center').setLineSpacing(8);
    body.setWordWrapWidth(590, true);
    const deny = makeButton(scene, 535, 462, 180, 46, '허용 안 함', () => {
      this.root.destroy(true);
      onChoice(false);
    }, { fill: 0x42544a });
    const allow = makeButton(scene, 745, 462, 180, 46, '익명 기록 허용', () => {
      this.root.destroy(true);
      onChoice(true);
    });
    this.root = scene.add.container(0, 0, [
      dim, panel, eyebrow, title, body, deny.container, allow.container,
    ]).setDepth(40);
  }
}
