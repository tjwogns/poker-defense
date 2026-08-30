import Phaser from 'phaser';
import { BossId, bossDef } from '../core/bosses';

export const BOSS_SPRITE_KEYS: Record<BossId, string> = {
  iron_dealer: 'boss-iron-dealer-v1',
  blood_queen: 'boss-blood-queen-v1',
  time_thief: 'boss-time-thief-v1',
  gold_tyrant: 'boss-gold-tyrant-v1',
  legion_king: 'boss-legion-king-v1',
  royal_joker: 'boss-royal-joker-v1',
};

const BOSS_SPRITE_PATHS: Record<string, string> = {
  'boss-iron-dealer-v1': './assets/bosses/iron-dealer-v1.png',
  'boss-blood-queen-v1': './assets/bosses/blood-queen-v1.png',
  'boss-time-thief-v1': './assets/bosses/time-thief-v1.png',
  'boss-gold-tyrant-v1': './assets/bosses/gold-tyrant-v1.png',
  'boss-legion-king-v1': './assets/bosses/legion-king-v1.png',
  'boss-royal-joker-v1': './assets/bosses/royal-joker-v1.png',
};

export function bossSpriteKey(round: number): string {
  return BOSS_SPRITE_KEYS[bossDef(round).id];
}

export function preloadBossSprites(scene: Phaser.Scene): void {
  for (const [key, path] of Object.entries(BOSS_SPRITE_PATHS)) scene.load.image(key, path);
}
