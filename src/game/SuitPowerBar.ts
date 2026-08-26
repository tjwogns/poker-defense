import Phaser from 'phaser';
import { SUIT_POWER_DEFS } from '../core/abilities';
import { Suit } from '../core/cards/types';
import { Game } from '../core/game';
import { Button, UI, makeButton, makeText } from './ui';
import { PANEL_SECTIONS } from './layout';

const SUITS: Suit[] = ['S', 'H', 'D', 'C'];

export class SuitPowerBar {
  private buttons = new Map<Suit, Button>();

  constructor(scene: Phaser.Scene, private game: Game, onUse: (suit: Suit) => void) {
    const section = PANEL_SECTIONS.powers;
    makeText(
      scene,
      section.x + 16,
      section.y + 8,
      'SUIT POWERS    Q 칼날  ·  W 퇴장  ·  R 골드  ·  T 기절',
      10,
      UI.textDim,
      true,
    );
    SUITS.forEach((suit, index) => {
      const def = SUIT_POWER_DEFS[suit];
      const button = makeButton(scene, 844 + index * 105, 519, 96, 40, '', () => onUse(suit), {
        fill: def.color,
        fontSize: 12,
      });
      this.buttons.set(suit, button);
    });
  }

  refresh(): void {
    for (const suit of SUITS) {
      const def = SUIT_POWER_DEFS[suit];
      const charges = this.game.powerCharges[suit];
      const button = this.buttons.get(suit)!;
      button.setLabel(`[${def.key}]  ${def.glyph}  ${charges}`);
      button.setEnabled(this.game.phase === 'combat' && charges > 0);
    }
  }
}
