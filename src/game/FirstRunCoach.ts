import Phaser from 'phaser';
import { Game } from '../core/game';
import { firstRunCoachHint } from './coach';
import { UI, makeText } from './ui';
import { isPortraitLayout } from './device';
import { portraitCoachLayout, portraitSceneHeight } from './layout';

export class FirstRunCoach {
  private root: Phaser.GameObjects.Container;
  private stepText: Phaser.GameObjects.Text;
  private titleText: Phaser.GameObjects.Text;
  private bodyText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    if (isPortraitLayout()) {
      const layout = portraitCoachLayout(portraitSceneHeight(scene));
      const shadow = scene.add.rectangle(
        layout.panel.x + layout.panel.width / 2, layout.panel.y + layout.panel.height / 2 + 2,
        layout.panel.width, layout.panel.height, 0x000000, 0.48,
      );
      const panel = scene.add.rectangle(
        layout.panel.x + layout.panel.width / 2, layout.panel.y + layout.panel.height / 2,
        layout.panel.width, layout.panel.height, UI.panelRaised, 1,
      ).setStrokeStyle(1.5, 0xe6c84f, 0.8);
      this.stepText = makeText(scene, layout.step.x, layout.step.y, '', 9, UI.gold, true);
      this.titleText = makeText(scene, layout.title.x, layout.title.y, '', 11, UI.text, true);
      this.bodyText = makeText(scene, layout.body.x, layout.body.y, '', 9, UI.textDim)
        .setWordWrapWidth(layout.body.width, true).setLineSpacing(1);
      this.root = scene.add.container(0, 0, [shadow, panel, this.stepText, this.titleText, this.bodyText])
        .setDepth(13)
        .setVisible(false);
      return;
    }
    const shadow = scene.add.rectangle(1076, 105, 376, 58, 0x000000, 0.45);
    const panel = scene.add.rectangle(1076, 103, 376, 58, UI.panelRaised, 0.97)
      .setStrokeStyle(1.5, 0xe6c84f, 0.8);
    this.stepText = makeText(scene, 900, 84, '', 10, UI.gold, true);
    this.titleText = makeText(scene, 950, 82, '', 12, UI.text, true);
    this.bodyText = makeText(scene, 950, 101, '', 10, UI.textDim).setWordWrapWidth(300, true);
    this.root = scene.add.container(0, 0, [shadow, panel, this.stepText, this.titleText, this.bodyText])
      .setDepth(13)
      .setVisible(false);
  }

  refresh(game: Game, active: boolean): void {
    const hint = active ? firstRunCoachHint(game) : null;
    this.root.setVisible(hint !== null);
    if (!hint) return;
    this.stepText.setText(`${hint.step} / 3`);
    this.titleText.setText(hint.title);
    this.bodyText.setText(hint.body);
  }
}
