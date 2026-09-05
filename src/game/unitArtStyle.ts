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
  [HandRank.FiveKind]: 'unit-fivefold-lord-v1',
  [HandRank.FlushHouse]: 'unit-crest-commander-v1',
  [HandRank.FlushFive]: 'unit-primordial-star-v1',
};

export const PIXEL_UNIT_SPRITE_KEYS: Partial<Record<HandRank, string>> = {
  [HandRank.HighCard]: 'unit-apprentice-pixel-idle-v1',
  [HandRank.Pair]: 'unit-archer-pixel-idle-v1',
  [HandRank.TwoPair]: 'unit-dual-crossbow-pixel-idle-v1',
  [HandRank.Trips]: 'unit-fire-mage-pixel-v1',
  [HandRank.Straight]: 'unit-sharpshooter-pixel-idle-v1',
  [HandRank.Flush]: 'unit-ice-mage-pixel-idle-v1',
  [HandRank.FullHouse]: 'unit-paladin-pixel-idle-v1',
  [HandRank.FourKind]: 'unit-dragon-rider-pixel-idle-v1',
  [HandRank.StraightFlush]: 'unit-archmage-pixel-idle-v1',
  [HandRank.RoyalFlush]: 'unit-divine-dragon-pixel-v1',
  [HandRank.FiveKind]: 'unit-fivefold-lord-pixel-idle-v1',
  [HandRank.FlushHouse]: 'unit-crest-commander-pixel-idle-v1',
  [HandRank.FlushFive]: 'unit-primordial-star-pixel-idle-v1',
};

export const PIXEL_UNIT_SPRITE_PATHS: Record<string, string> = {
  'unit-archer-pixel-v1': './assets/units/archer-pixel-v1.png',
  'unit-fire-mage-pixel-v1': './assets/units/fire-mage-pixel-v1.png',
  'unit-paladin-pixel-v1': './assets/units/paladin-pixel-v1.png',
  'unit-divine-dragon-pixel-v1': './assets/units/divine-dragon-pixel-v1.png',
  'unit-archer-pixel-idle-v1': './assets/units/archer-pixel-idle-v1.png',
  'unit-archer-pixel-release-v1': './assets/units/archer-pixel-release-v1.png',
  'unit-fire-mage-pixel-cast-v1': './assets/units/fire-mage-pixel-cast-v1.png',
  'unit-paladin-pixel-idle-v1': './assets/units/paladin-pixel-idle-v1.png',
  'unit-paladin-pixel-swing-v1': './assets/units/paladin-pixel-swing-v1.png',
  'unit-divine-dragon-pixel-windup-v1': './assets/units/divine-dragon-pixel-windup-v1.png',
  'unit-divine-dragon-pixel-breath-v1': './assets/units/divine-dragon-pixel-breath-v1.png',
  'unit-apprentice-pixel-idle-v1': './assets/units/apprentice-pixel-idle-v1.png',
  'unit-apprentice-pixel-slash-v1': './assets/units/apprentice-pixel-slash-v1.png',
  'unit-dual-crossbow-pixel-idle-v1': './assets/units/dual-crossbow-pixel-idle-v1.png',
  'unit-dual-crossbow-pixel-fire-v1': './assets/units/dual-crossbow-pixel-fire-v1.png',
  'unit-sharpshooter-pixel-idle-v1': './assets/units/sharpshooter-pixel-idle-v1.png',
  'unit-sharpshooter-pixel-fire-v1': './assets/units/sharpshooter-pixel-fire-v1.png',
  'unit-ice-mage-pixel-idle-v1': './assets/units/ice-mage-pixel-idle-v1.png',
  'unit-ice-mage-pixel-cast-v1': './assets/units/ice-mage-pixel-cast-v1.png',
  'unit-dragon-rider-pixel-idle-v1': './assets/units/dragon-rider-pixel-idle-v1.png',
  'unit-dragon-rider-pixel-charge-v1': './assets/units/dragon-rider-pixel-charge-v1.png',
  'unit-archmage-pixel-idle-v1': './assets/units/archmage-pixel-idle-v1.png',
  'unit-archmage-pixel-cast-v1': './assets/units/archmage-pixel-cast-v1.png',
  'unit-fivefold-lord-pixel-idle-v1': './assets/units/fivefold-lord-pixel-idle-v1.png',
  'unit-fivefold-lord-pixel-command-v1': './assets/units/fivefold-lord-pixel-command-v1.png',
  'unit-crest-commander-pixel-idle-v1': './assets/units/crest-commander-pixel-idle-v1.png',
  'unit-crest-commander-pixel-charge-v1': './assets/units/crest-commander-pixel-charge-v1.png',
  'unit-primordial-star-pixel-idle-v1': './assets/units/primordial-star-pixel-idle-v1.png',
  'unit-primordial-star-pixel-beam-v1': './assets/units/primordial-star-pixel-beam-v1.png',
};

export type UnitAnimationFrame = 'idle' | 'windup' | 'attack';

const PIXEL_UNIT_ANIMATION_KEYS: Partial<Record<HandRank, Partial<Record<UnitAnimationFrame, string>>>> = {
  [HandRank.HighCard]: {
    idle: 'unit-apprentice-pixel-idle-v1',
    windup: 'unit-apprentice-pixel-idle-v1',
    attack: 'unit-apprentice-pixel-slash-v1',
  },
  [HandRank.Pair]: {
    idle: 'unit-archer-pixel-idle-v1',
    windup: 'unit-archer-pixel-v1',
    attack: 'unit-archer-pixel-release-v1',
  },
  [HandRank.Trips]: {
    idle: 'unit-fire-mage-pixel-v1',
    windup: 'unit-fire-mage-pixel-v1',
    attack: 'unit-fire-mage-pixel-cast-v1',
  },
  [HandRank.TwoPair]: {
    idle: 'unit-dual-crossbow-pixel-idle-v1',
    windup: 'unit-dual-crossbow-pixel-idle-v1',
    attack: 'unit-dual-crossbow-pixel-fire-v1',
  },
  [HandRank.Straight]: {
    idle: 'unit-sharpshooter-pixel-idle-v1',
    windup: 'unit-sharpshooter-pixel-idle-v1',
    attack: 'unit-sharpshooter-pixel-fire-v1',
  },
  [HandRank.Flush]: {
    idle: 'unit-ice-mage-pixel-idle-v1',
    windup: 'unit-ice-mage-pixel-idle-v1',
    attack: 'unit-ice-mage-pixel-cast-v1',
  },
  [HandRank.FullHouse]: {
    idle: 'unit-paladin-pixel-idle-v1',
    windup: 'unit-paladin-pixel-v1',
    attack: 'unit-paladin-pixel-swing-v1',
  },
  [HandRank.RoyalFlush]: {
    idle: 'unit-divine-dragon-pixel-v1',
    windup: 'unit-divine-dragon-pixel-windup-v1',
    attack: 'unit-divine-dragon-pixel-breath-v1',
  },
  [HandRank.FourKind]: {
    idle: 'unit-dragon-rider-pixel-idle-v1',
    windup: 'unit-dragon-rider-pixel-idle-v1',
    attack: 'unit-dragon-rider-pixel-charge-v1',
  },
  [HandRank.StraightFlush]: {
    idle: 'unit-archmage-pixel-idle-v1',
    windup: 'unit-archmage-pixel-idle-v1',
    attack: 'unit-archmage-pixel-cast-v1',
  },
  [HandRank.FiveKind]: {
    idle: 'unit-fivefold-lord-pixel-idle-v1',
    windup: 'unit-fivefold-lord-pixel-idle-v1',
    attack: 'unit-fivefold-lord-pixel-command-v1',
  },
  [HandRank.FlushHouse]: {
    idle: 'unit-crest-commander-pixel-idle-v1',
    windup: 'unit-crest-commander-pixel-idle-v1',
    attack: 'unit-crest-commander-pixel-charge-v1',
  },
  [HandRank.FlushFive]: {
    idle: 'unit-primordial-star-pixel-idle-v1',
    windup: 'unit-primordial-star-pixel-idle-v1',
    attack: 'unit-primordial-star-pixel-beam-v1',
  },
};

export function pixelSpriteFacesLeft(tier: HandRank): boolean {
  return tier === HandRank.RoyalFlush;
}

export function isPixelArtPreview(search: string): boolean {
  return new URLSearchParams(search).get('art') === 'pixel';
}

export function unitSpriteKey(tier: HandRank, search: string): string | undefined {
  if (isPixelArtPreview(search) && PIXEL_UNIT_SPRITE_KEYS[tier]) {
    return PIXEL_UNIT_SPRITE_KEYS[tier];
  }
  return UNIT_SPRITE_KEYS[tier];
}

export function unitAnimationFrameKey(
  tier: HandRank,
  frame: UnitAnimationFrame,
  search: string,
): string | undefined {
  if (!isPixelArtPreview(search)) return UNIT_SPRITE_KEYS[tier];
  return PIXEL_UNIT_ANIMATION_KEYS[tier]?.[frame] ?? PIXEL_UNIT_SPRITE_KEYS[tier] ?? UNIT_SPRITE_KEYS[tier];
}
