import Phaser from 'phaser';
import {
  isPixelArtPreview, PIXEL_UNIT_SPRITE_PATHS,
} from './unitArtStyle';

export {
  isPixelArtPreview, pixelSpriteFacesLeft, UNIT_SPRITE_KEYS, unitAnimationFrameKey, unitSpriteKey,
} from './unitArtStyle';

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
  'unit-fivefold-lord-v1': './assets/units/fivefold-lord-v1.png',
  'unit-crest-commander-v1': './assets/units/crest-commander-v1.png',
  'unit-primordial-star-v1': './assets/units/primordial-star-v1.png',
};

export function preloadUnitSprites(scene: Phaser.Scene): void {
  for (const [key, path] of Object.entries(UNIT_SPRITE_PATHS)) scene.load.image(key, path);
  if (!isPixelArtPreview(window.location.search)) return;
  for (const [key, path] of Object.entries(PIXEL_UNIT_SPRITE_PATHS)) scene.load.image(key, path);
  scene.load.once(Phaser.Loader.Events.COMPLETE, () => {
    for (const key of Object.keys(PIXEL_UNIT_SPRITE_PATHS)) {
      scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
  });
}
