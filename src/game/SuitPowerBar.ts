import Phaser from 'phaser';
import { SUIT_POWER_DEFS } from '../core/abilities';
import { Suit } from '../core/cards/types';
import { Game } from '../core/game';
import { Button, UI, makeButton, makeText } from './ui';

const SUITS: Suit[] = ['S', 'H', 'D', 'C'];

export class SuitPowerBar {
  private buttons = new Map<Suit, Button>();

  constructor(scene: Phaser.Scene, private game: Game, onUse: (suit: Suit) => void) {
    makeText(scene, 800, 548, 'SUIT POWERS', 11, UI.textDim, true);
    SUITS.forEach((suit, index) => {
      const def = SUIT_POWER_DEFS[suit];
      const button = makeButton(scene, 840 + index * 105, 582, 96, 48, '', () => onUse(suit), {
        fill: def.color,
        fontSize: 13,
      });
      this.buttons.set(suit, button);
    });
  }

  refresh(): void {
    for (const suit of SUITS) {
      const def = SUIT_POWER_DEFS[suit];
      const charges = this.game.powerCharges[suit];
      const button = this.buttons.get(suit)!;
      button.setLabel(`${def.glyph} ${charges}  [${def.key}]`);
      button.setEnabled(this.game.phase === 'combat' && charges > 0);
    }
  }
}
