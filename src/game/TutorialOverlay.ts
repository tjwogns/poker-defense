import Phaser from 'phaser';
import { UI, makeButton, makeText } from './ui';
import { isPortraitLayout } from './device';

const STEPS = [
  ['1 · 홀드가 생존을 결정합니다', '같은 숫자·같은 무늬 카드는 눌러 HOLD하고 나머지만 교환하세요.\n낮은 족보가 반복되면 적이 빠르게 누적됩니다. 첫 교환은 무료입니다.'],
  ['2 · 족보가 곧 병력입니다', '족보를 확정하면 대응하는 유닛을 얻습니다.\n높은 족보일수록 강력하고 희귀합니다.'],
  ['3 · 배치하고 합성하세요', '초록 타일에 배치하세요. 같은 등급 3기는 한 단계 위로 합성됩니다.'],
  ['4 · 필드 상한을 지키세요', '기본 80기까지 버틸 수 있고 초과하면 패배합니다. 유물에 따라 상한이 바뀝니다.\n10라운드마다 보스를 꺾고 유물을 선택하세요.'],
] as const;

export class TutorialOverlay {
  private root: Phaser.GameObjects.Container;
  private title: Phaser.GameObjects.Text;
  private body: Phaser.GameObjects.Text;
  private counter: Phaser.GameObjects.Text;
  private step = 0;

  constructor(scene: Phaser.Scene, onComplete: (result: 'completed' | 'skipped') => void) {
    const portrait = isPortraitLayout();
    const cx = portrait ? 195 : 640;
    const dim = scene.add.rectangle(cx, portrait ? 422 : 360, portrait ? 390 : 1280, portrait ? 844 : 720, 0x06100a, 0.88).setInteractive();
    const panel = scene.add.rectangle(cx, portrait ? 414 : 350, portrait ? 350 : 650, portrait ? 450 : 330, UI.panel, 1)
      .setStrokeStyle(2, UI.accent, 0.75);
    const eyebrow = makeText(scene, cx, portrait ? 236 : 230, 'QUICK BRIEFING', 13, UI.accentText, true).setOrigin(0.5);
    this.title = makeText(scene, cx, portrait ? 282 : 278, '', portrait ? 22 : 30, UI.text, true).setOrigin(0.5);
    this.body = makeText(scene, cx, portrait ? 338 : 340, '', portrait ? 14 : 17, UI.textDim).setOrigin(0.5, 0).setAlign('center').setLineSpacing(8);
    this.body.setWordWrapWidth(portrait ? 302 : 600, true);
    this.counter = makeText(scene, cx, portrait ? 502 : 455, '', 13, UI.textDim).setOrigin(0.5);
    const next = makeButton(scene, portrait ? 286 : 720, portrait ? 570 : 500, portrait ? 158 : 180, portrait ? 52 : 46, '다음', () => {
      if (this.step < STEPS.length - 1) {
        this.step++;
        this.refresh(next);
      } else {
        this.root.destroy(true);
        onComplete('completed');
      }
    });
    const skip = makeButton(scene, portrait ? 104 : 520, portrait ? 570 : 500, portrait ? 158 : 150, portrait ? 52 : 46, '건너뛰기', () => {
      this.root.destroy(true);
      onComplete('skipped');
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
