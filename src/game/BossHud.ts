import Phaser from 'phaser';
import { bossDef, featuredBoss } from '../core/bosses';
import { Game } from '../core/game';
import { UI, makeText } from './ui';
import { BOSS_HUD_BOUNDS, portraitSceneHeight, portraitY } from './layout';
import { bossMechanicStatus } from './bossFeedback';
import { isPortraitLayout } from './device';

export class BossHud {
  private root: Phaser.GameObjects.Container;
  private name: Phaser.GameObjects.Text;
  private mechanic: Phaser.GameObjects.Text;
  private hp: Phaser.GameObjects.Text;
  private hpFg: Phaser.GameObjects.Rectangle;

  constructor(scene: Phaser.Scene) {
    const portrait = isPortraitLayout();
    const portraitHeight = portraitSceneHeight(scene);
    const { x, y, width, height } = portrait
      ? { x: 8, y: portraitY(portraitHeight, 382), width: 374, height: 58 }
      : BOSS_HUD_BOUNDS;
    const bg = scene.add.rectangle(x + width / 2, y + height / 2, width, height, UI.panelDeep, 0.98)
      .setStrokeStyle(1, 0xe24b77, 0.72);
    const accent = scene.add.rectangle(x + 2, y + height / 2, 3, height - 4, 0xe24b77, 0.95);
    this.name = makeText(scene, x + 12, y + (portrait ? 8 : 6), '', portrait ? 14 : 12, UI.gold, true);
    this.mechanic = makeText(scene, x + 12, y + (portrait ? 32 : 22), '', portrait ? 11 : 9, UI.textDim);
    const hpX = portrait ? x + 222 : x + 268;
    const hpWidth = portrait ? 136 : 152;
    const hpBg = scene.add.rectangle(hpX, y + (portrait ? 18 : 12), hpWidth, 8, 0x000000, 0.8).setOrigin(0, 0.5);
    this.hpFg = scene.add.rectangle(hpX, y + (portrait ? 18 : 12), hpWidth, 8, 0xe24b77, 1).setOrigin(0, 0.5);
    this.hp = makeText(scene, hpX + hpWidth / 2, y + (portrait ? 31 : 22), '', portrait ? 10 : 9, UI.text).setOrigin(0.5);
    this.hpFg.setData('maxWidth', hpWidth);
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
    this.hpFg.width = Number(this.hpFg.getData('maxWidth') ?? 152) * ratio;
    this.hp.setText(`${Math.ceil(boss.hp).toLocaleString()} / ${Math.ceil(boss.maxHp).toLocaleString()}`);
  }
}
