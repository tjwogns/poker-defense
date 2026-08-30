import Phaser from 'phaser';
import {
  RELIC_DEFS, RELIC_IDS, RELIC_RARITY_COLORS, RelicId, RelicRarity,
} from '../core/relics';

export const RELIC_SPRITE_KEYS: Record<RelicId, string> = Object.fromEntries(
  RELIC_IDS.map((id) => [id, `relic-${id.replace(/_/g, '-')}-v1`]),
) as Record<RelicId, string>;

export const RELIC_SPRITE_PATHS: Record<RelicId, string> = Object.fromEntries(
  RELIC_IDS.map((id) => [id, `./assets/relics/${id.replace(/_/g, '-')}-v1.png`]),
) as Record<RelicId, string>;

export interface RelicRarityStyle {
  color: number;
  lineWidth: number;
  doubleFrame: boolean;
  glowAlpha: number;
}

export const RELIC_RARITY_STYLES: Record<RelicRarity, RelicRarityStyle> = {
  common: { color: RELIC_RARITY_COLORS.common, lineWidth: 1.5, doubleFrame: false, glowAlpha: 0.08 },
  rare: { color: RELIC_RARITY_COLORS.rare, lineWidth: 2.5, doubleFrame: false, glowAlpha: 0.14 },
  legendary: { color: RELIC_RARITY_COLORS.legendary, lineWidth: 3.5, doubleFrame: true, glowAlpha: 0.22 },
};

export function preloadRelicSprites(scene: Phaser.Scene): void {
  for (const id of RELIC_IDS) scene.load.image(RELIC_SPRITE_KEYS[id], RELIC_SPRITE_PATHS[id]);
}

/** 아이콘 이미지와 등급 프레임을 한 묶음으로 생성한다. */
export function createRelicIcon(
  scene: Phaser.Scene,
  id: RelicId,
  x: number,
  y: number,
  size: number,
): Phaser.GameObjects.Container {
  const style = RELIC_RARITY_STYLES[RELIC_DEFS[id].rarity];
  const glow = scene.add.rectangle(0, 2, size + 8, size + 8, style.color, style.glowAlpha)
    .setStrokeStyle(0);
  const backing = scene.add.rectangle(0, 0, size, size, 0x101d16, 0.92)
    .setStrokeStyle(style.lineWidth, style.color, 0.96);
  const image = scene.add.image(0, 0, RELIC_SPRITE_KEYS[id]).setDisplaySize(size * 0.84, size * 0.84);
  const children: Phaser.GameObjects.GameObject[] = [glow, backing, image];
  if (style.doubleFrame) {
    children.push(scene.add.rectangle(0, 0, size - 8, size - 8, 0x000000, 0)
      .setStrokeStyle(1, style.color, 0.75));
  }
  return scene.add.container(x, y, children);
}
