import Phaser from 'phaser';
import { bossDef, featuredBoss } from '../core/bosses';
import { Game } from '../core/game';
import { UI, makeText } from './ui';

export class BossHud {
  private root: Phaser.GameObjects.Container;
  private name: Phaser.GameObjects.Text;
  private mechanic: Phaser.GameObjects.Text;
  private hp: Phaser.GameObjects.Text;
  private hpFg: Phaser.GameObjects.Rectangle;

  constructor(scene: Phaser.Scene) {
    const bg = scene.add.rectangle(390, 30, 430, 54, 0x070b08, 0.9).setStrokeStyle(1, 0xe24b77, 0.8);
    this.name = makeText(scene, 190, 17, '', 14, UI.gold, true);
    this.mechanic = makeText(scene, 190, 37, '', 11, UI.textDim);
    const hpBg = scene.add.rectangle(578, 20, 200, 9, 0x000000, 0.8).setOrigin(0, 0.5);
    this.hpFg = scene.add.rectangle(578, 20, 200, 9, 0xe24b77, 1).setOrigin(0, 0.5);
    this.hp = makeText(scene, 678, 31, '', 10, UI.text).setOrigin(0.5);
    this.root = scene.add.container(0, 0, [bg, this.name, this.mechanic, hpBg, this.hpFg, this.hp])
      .setDepth(8).setVisible(false);
  }

  refresh(game: Game): void {
    const boss = featuredBoss(game.field.enemies);
    this.root.setVisible(Boolean(boss));
    if (!boss) return;
    const def = bossDef(boss.round);
    const ratio = Math.max(0, boss.hp / boss.maxHp);
    this.name.setText(`♛ ${def.name}`);
    this.mechanic.setText(def.mechanic);
    this.hpFg.width = 200 * ratio;
    this.hp.setText(`${Math.ceil(boss.hp).toLocaleString()} / ${Math.ceil(boss.maxHp).toLocaleString()}`);
  }
}
