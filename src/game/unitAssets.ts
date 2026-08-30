import Phaser from 'phaser';
import { HandRank } from '../core/cards/types';

export const UNIT_SPRITE_KEYS: Partial<Record<HandRank, string>> = {
  [HandRank.HighCard]: 'unit-apprentice-v1',
  [HandRank.Pair]: 'unit-archer-v1',
  [HandRank.TwoPair]: 'unit-dual-crossbow-v1',
  [HandRank.Trips]: 'unit-fire-mage-v1',
  [HandRank.Straight]: 'unit-sharpshooter-v1',
  [HandRank.Flush]: 'unit-ice-mage-v1',
  [HandRank.FullHouse]: 'unit-paladin-v1',
  [HandRank.FourKind]: 'unit-dragon-rider-v1',
  [HandRank.StraightFlush]: 'unit-archmage-v1',
  [HandRank.RoyalFlush]: 'unit-divine-dragon-v1',
};

const UNIT_SPRITE_PATHS: Record<string, string> = {
  'unit-apprentice-v1': './assets/units/apprentice-v1.png',
  'unit-archer-v1': './assets/units/archer-v1.png',
  'unit-dual-crossbow-v1': './assets/units/dual-crossbow-v1.png',
  'unit-fire-mage-v1': './assets/units/fire-mage-v1.png',
  'unit-sharpshooter-v1': './assets/units/sharpshooter-v1.png',
  'unit-ice-mage-v1': './assets/units/ice-mage-v1.png',
  'unit-paladin-v1': './assets/units/paladin-v1.png',
  'unit-dragon-rider-v1': './assets/units/dragon-rider-v1.png',
  'unit-archmage-v1': './assets/units/archmage-v1.png',
  'unit-divine-dragon-v1': './assets/units/divine-dragon-v1.png',
};

export function preloadUnitSprites(scene: Phaser.Scene): void {
  for (const [key, path] of Object.entries(UNIT_SPRITE_PATHS)) scene.load.image(key, path);
}
