import Phaser from 'phaser';
import { HandRank } from '../core/cards/types';

export const UNIT_SPRITE_KEYS: Partial<Record<HandRank, string>> = {
  [HandRank.HighCard]: 'unit-apprentice-v1',
  [HandRank.Pair]: 'unit-archer-v1',
  [HandRank.Trips]: 'unit-fire-mage-v1',
};

const UNIT_SPRITE_PATHS: Record<string, string> = {
  'unit-apprentice-v1': './assets/units/apprentice-v1.png',
  'unit-archer-v1': './assets/units/archer-v1.png',
  'unit-fire-mage-v1': './assets/units/fire-mage-v1.png',
};

export function preloadUnitSprites(scene: Phaser.Scene): void {
  for (const [key, path] of Object.entries(UNIT_SPRITE_PATHS)) scene.load.image(key, path);
}
