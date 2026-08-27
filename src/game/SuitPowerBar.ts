import Phaser from 'phaser';
import { SUIT_POWER_DEFS } from '../core/abilities';
import { Suit } from '../core/cards/types';
import { Game } from '../core/game';
import { relicModifiers } from '../core/relics';
import { Button, UI, makeButton, makeText } from './ui';
import { PANEL_SECTIONS } from './layout';

const SUITS: Suit[] = ['S', 'H', 'D', 'C'];

export class SuitPowerBar {
  private buttons = new Map<Suit, Button>();
  private descriptionText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, private game: Game, onUse: (suit: Suit) => void) {
    const section = PANEL_SECTIONS.powers;
    this.descriptionText = makeText(
      scene,
      section.x + 16,
      section.y + 8,
      '',
      9,
      UI.textDim,
      true,
    ).setLineSpacing(2);
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
    const mods = relicModifiers(this.game.relics);
    const heart = mods.heartStrike ? '전체HP 12%/보스4%' : '일반 적 6기 퇴장';
    this.descriptionText.setText(
      `Q ♠ 일반HP 22%/보스6% · W ♥ ${heart}\nR ♦ 25+라운드×3G · T ♣ 전체 ${mods.clubStunDuration}초 기절`,
    );
    for (const suit of SUITS) {
      const def = SUIT_POWER_DEFS[suit];
      const charges = this.game.powerCharges[suit];
      const button = this.buttons.get(suit)!;
      button.setLabel(`[${def.key}]  ${def.glyph}  ${charges}`);
      button.setEnabled(this.game.phase === 'combat' && charges > 0);
    }
  }
}
