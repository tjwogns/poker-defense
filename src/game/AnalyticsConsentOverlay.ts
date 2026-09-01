import Phaser from 'phaser';
import { FONT_MONO, UI, makeButton, makeText } from './ui';
import { isPortraitLayout } from './device';

export class AnalyticsConsentOverlay {
  private root: Phaser.GameObjects.Container;

  constructor(scene: Phaser.Scene, onChoice: (allowed: boolean) => void) {
    const portrait = isPortraitLayout();
    const cx = portrait ? 195 : 640;
    const dim = scene.add.rectangle(cx, portrait ? 422 : 360, portrait ? 390 : 1280, portrait ? 844 : 720, 0x06100a, 0.9).setInteractive();
    const panel = scene.add.rectangle(cx, portrait ? 408 : 350, portrait ? 350 : 680, portrait ? 430 : 350, UI.panel, 1)
      .setStrokeStyle(1, UI.goldNum, 0.55);
    const eyebrow = makeText(scene, cx, portrait ? 242 : 225, 'PLAYTEST DATA', 12, UI.gold, true).setOrigin(0.5);
    eyebrow.setFontFamily(FONT_MONO).setLetterSpacing(2.4);
    const title = makeText(scene, cx, portrait ? 288 : 270, '익명 플레이 기록을 허용할까요?', portrait ? 21 : 27, UI.text, true).setOrigin(0.5);
    const body = makeText(
      scene,
      cx,
      portrait ? 340 : 326,
      '게임 개선을 위해 라운드 도달, 선택, 결과만 기록합니다.\n이름·이메일·카드 내용은 수집하지 않으며 언제든 DATA 버튼에서 끌 수 있습니다.',
      portrait ? 14 : 15,
      UI.textDim,
    ).setOrigin(0.5, 0).setAlign('center').setLineSpacing(8);
    body.setWordWrapWidth(portrait ? 298 : 590, true);
    const privacy = makeText(scene, cx, portrait ? 470 : 410, '개인정보 안내 보기  →', 12, UI.textDim, true)
      .setOrigin(0.5).setInteractive({ useHandCursor: true });
    privacy.on('pointerdown', () => window.open('./privacy.html', '_blank', 'noopener'));
    const deny = makeButton(scene, portrait ? 104 : 535, portrait ? 550 : 470, portrait ? 158 : 180, portrait ? 52 : 46, '허용 안 함', () => {
      this.root.destroy(true);
      onChoice(false);
    }, { fill: UI.panelDeep, textColor: UI.textDim, strokeAlpha: 0.18 });
    const allow = makeButton(scene, portrait ? 286 : 745, portrait ? 550 : 470, portrait ? 158 : 180, portrait ? 52 : 46, '익명 기록 허용', () => {
      this.root.destroy(true);
      onChoice(true);
    }, { fill: UI.goldNum, textColor: UI.goldInk, stroke: UI.goldNum, strokeAlpha: 0.5 });
    this.root = scene.add.container(0, 0, [
      dim, panel, eyebrow, title, body, privacy, deny.container, allow.container,
    ]).setDepth(40);
  }
}
