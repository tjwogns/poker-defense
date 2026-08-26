import Phaser from 'phaser';
import { UI, makeButton, makeText } from './ui';

const STEPS = [
  ['1 · 패를 설계하세요', '카드를 눌러 HOLD한 뒤 E 또는 교환 버튼으로 나머지를 바꿉니다.\n첫 교환은 무료입니다.'],
  ['2 · 족보가 곧 병력입니다', '족보를 확정하면 대응하는 유닛을 얻습니다.\n높은 족보일수록 강력하고 희귀합니다.'],
  ['3 · 배치하고 합성하세요', '초록 타일에 배치하세요. 같은 등급 3기는 한 단계 위로 합성됩니다.'],
  ['4 · 80마리 전에 막으세요', '적은 사라지지 않고 다음 라운드로 이월됩니다.\n10라운드마다 보스를 꺾고 유물을 선택하세요.'],
] as const;

export class TutorialOverlay {
  private root: Phaser.GameObjects.Container;
  private title: Phaser.GameObjects.Text;
  private body: Phaser.GameObjects.Text;
  private counter: Phaser.GameObjects.Text;
  private step = 0;

  constructor(scene: Phaser.Scene, onComplete: () => void) {
    const dim = scene.add.rectangle(640, 360, 1280, 720, 0x06100a, 0.88).setInteractive();
    const panel = scene.add.rectangle(640, 350, 650, 330, UI.panel, 1)
      .setStrokeStyle(2, UI.accent, 0.75);
    const eyebrow = makeText(scene, 640, 230, 'QUICK BRIEFING', 13, UI.accentText, true).setOrigin(0.5);
    this.title = makeText(scene, 640, 278, '', 30, UI.text, true).setOrigin(0.5);
    this.body = makeText(scene, 640, 340, '', 17, UI.textDim).setOrigin(0.5, 0).setAlign('center').setLineSpacing(8);
    this.counter = makeText(scene, 640, 455, '', 13, UI.textDim).setOrigin(0.5);
    const next = makeButton(scene, 720, 500, 180, 46, '다음', () => {
      if (this.step < STEPS.length - 1) {
        this.step++;
        this.refresh(next);
      } else {
        this.root.destroy(true);
        onComplete();
      }
    });
    const skip = makeButton(scene, 520, 500, 150, 46, '건너뛰기', () => {
      this.root.destroy(true);
      onComplete();
    }, { fill: 0x42544a });
    this.root = scene.add.container(0, 0, [dim, panel, eyebrow, this.title, this.body, this.counter, next.container, skip.container])
      .setDepth(30);
    this.refresh(next);
  }

  private refresh(next: ReturnType<typeof makeButton>): void {
    const [title, body] = STEPS[this.step];
    this.title.setText(title);
    this.body.setText(body);
    this.counter.setText(`${this.step + 1} / ${STEPS.length}`);
    next.setLabel(this.step === STEPS.length - 1 ? '게임 시작' : '다음');
  }
}
