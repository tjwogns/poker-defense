import Phaser from 'phaser';
import { bossDef, featuredBoss } from '../core/bosses';
import { Game } from '../core/game';
import { UI, makeText } from './ui';
import { BOSS_HUD_BOUNDS } from './layout';
import { bossMechanicStatus } from './bossFeedback';

export class BossHud {
  private root: Phaser.GameObjects.Container;
  private name: Phaser.GameObjects.Text;
  private mechanic: Phaser.GameObjects.Text;
  private hp: Phaser.GameObjects.Text;
  private hpFg: Phaser.GameObjects.Rectangle;

  constructor(scene: Phaser.Scene) {
    const { x, y, width, height } = BOSS_HUD_BOUNDS;
    const bg = scene.add.rectangle(x + width / 2, y + height / 2, width, height, UI.panelDeep, 0.98)
      .setStrokeStyle(1, 0xe24b77, 0.72);
    const accent = scene.add.rectangle(x + 2, y + height / 2, 3, height - 4, 0xe24b77, 0.95);
    this.name = makeText(scene, x + 12, y + 6, '', 12, UI.gold, true);
    this.mechanic = makeText(scene, x + 12, y + 22, '', 9, UI.textDim);
    const hpBg = scene.add.rectangle(x + 268, y + 12, 152, 8, 0x000000, 0.8).setOrigin(0, 0.5);
    this.hpFg = scene.add.rectangle(x + 268, y + 12, 152, 8, 0xe24b77, 1).setOrigin(0, 0.5);
    this.hp = makeText(scene, x + 344, y + 22, '', 9, UI.text).setOrigin(0.5);
    this.root = scene.add.container(0, 0, [bg, accent, this.name, this.mechanic, hpBg, this.hpFg, this.hp])
      .setDepth(8).setVisible(false);
  }

  refresh(game: Game): void {
    const boss = featuredBoss(game.field.enemies);
    this.root.setVisible(Boolean(boss));
    if (!boss) return;
    const def = bossDef(boss.round);
    const ratio = Math.max(0, boss.hp / boss.maxHp);
    this.name.setText(`♛ ${def.name}`);
    const status = bossMechanicStatus(boss.round, ratio, game.bossAbilityCountdown(boss.round));
    this.mechanic.setText(status.text || def.mechanic);
    this.mechanic.setColor(status.urgent ? '#ff8a78' : UI.textDim);
    this.hpFg.width = 152 * ratio;
    this.hp.setText(`${Math.ceil(boss.hp).toLocaleString()} / ${Math.ceil(boss.maxHp).toLocaleString()}`);
  }
}
