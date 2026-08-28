import Phaser from 'phaser';
import { Game } from '../core/game';
import { firstRunCoachHint } from './coach';
import { UI, makeText } from './ui';

export class FirstRunCoach {
  private root: Phaser.GameObjects.Container;
  private stepText: Phaser.GameObjects.Text;
  private titleText: Phaser.GameObjects.Text;
  private bodyText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    const shadow = scene.add.rectangle(390, 520, 720, 46, 0x000000, 0.45);
    const panel = scene.add.rectangle(390, 517, 720, 46, UI.panelRaised, 0.97)
      .setStrokeStyle(1.5, 0xe6c84f, 0.8);
    this.stepText = makeText(scene, 48, 505, '', 10, UI.gold, true);
    this.titleText = makeText(scene, 112, 503, '', 13, UI.text, true);
    this.bodyText = makeText(scene, 112, 522, '', 11, UI.textDim).setWordWrapWidth(590, true);
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
