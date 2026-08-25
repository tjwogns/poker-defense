import Phaser from 'phaser';
import { Game } from '../core/game';
import { evaluateHand } from '../core/cards/evaluator';
import { HAND_NAMES_KO, RANK_LABELS, SUIT_GLYPHS } from '../core/cards/types';
import { UNIT_DEFS } from '../core/units';
import { Button, FONT, UI, makeButton, makeText } from './ui';

const CARD_W = 74;
const CARD_H = 104;
const CARD_GAP = 84;
const BASE_X = 61;   // 첫 카드 중심
const BASE_Y = 616;  // 카드 중심 (홀드 시 -14)

interface CardView {
  root: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Rectangle;
  corner: Phaser.GameObjects.Text;
  suit: Phaser.GameObjects.Text;
  holdTag: Phaser.GameObjects.Text;
}

/** 하단 카드 5장 + 교환/확정 버튼 + 족보 미리보기 */
export class HandBar {
  private game: Game;
  private cards: CardView[] = [];
  private preview: Phaser.GameObjects.Text;
  private exchangeBtn: Button;
  private confirmBtn: Button;

  constructor(scene: Phaser.Scene, game: Game, onAction: () => void) {
    this.game = game;

    for (let i = 0; i < 5; i++) {
      const bg = scene.add
        .rectangle(0, 0, CARD_W, CARD_H, UI.cardFace)
        .setStrokeStyle(2, 0x000000, 0.4);
      const corner = scene.add.text(-CARD_W / 2 + 8, -CARD_H / 2 + 6, '', {
        fontFamily: FONT, fontSize: '17px', fontStyle: 'bold', color: UI.cardInkBlack,
      });
      const suit = scene.add
        .text(0, 8, '', { fontFamily: FONT, fontSize: '34px', color: UI.cardInkBlack })
        .setOrigin(0.5);
      const holdTag = scene.add
        .text(0, CARD_H / 2 - 14, 'HOLD', {
          fontFamily: FONT, fontSize: '11px', fontStyle: 'bold', color: UI.accentText,
        })
        .setOrigin(0.5)
        .setVisible(false);
      const root = scene.add.container(BASE_X + i * CARD_GAP, BASE_Y, [bg, corner, suit, holdTag]);
      root.setDepth(5);
      bg.setInteractive({ useHandCursor: true });
      bg.on('pointerdown', () => {
        this.game.toggleHold(i);
        onAction();
      });
      this.cards.push({ root, bg, corner, suit, holdTag });
    }

    this.preview = makeText(scene, 460, 566, '', 15, UI.text, true);

    this.exchangeBtn = makeButton(scene, 542, 640, 160, 44, '교환 (무료)', () => {
      this.game.doExchange();
      onAction();
    });
    this.confirmBtn = makeButton(scene, 694, 640, 120, 44, '족보 확정 ▶', () => {
      this.game.confirmHand();
      onAction();
    }, { fill: 0xe6c84f });
  }

  refresh(): void {
    const g = this.game;
    const inPrep = g.phase === 'prep';

    g.hand.forEach((card, i) => {
      const view = this.cards[i];
      const red = card.suit === 'H' || card.suit === 'D';
      const ink = red ? UI.cardInkRed : UI.cardInkBlack;
      view.corner.setText(RANK_LABELS[card.rank]).setColor(ink);
      view.suit.setText(SUIT_GLYPHS[card.suit]).setColor(ink);
      const held = g.holds[i];
      view.holdTag.setVisible(held);
      view.root.y = held ? BASE_Y - 14 : BASE_Y;
      view.bg.setStrokeStyle(2, held ? UI.accent : 0x000000, held ? 1 : 0.4);
      view.root.setAlpha(inPrep && !g.handConfirmed ? 1 : 0.55);
    });

    const rank = evaluateHand(g.hand);
    if (!inPrep) {
      this.preview.setText('전투 진행 중…');
    } else if (g.handConfirmed) {
      const pending = g.pendingUnits.length;
      this.preview.setText(
        pending > 0
          ? `획득: ${UNIT_DEFS[g.lastHandRank!].name} — 초록 타일을 클릭해 배치하세요`
          : `${HAND_NAMES_KO[g.lastHandRank!]} 확정 완료`,
      );
    } else {
      this.preview.setText(`현재 패: ${HAND_NAMES_KO[rank]} → ${UNIT_DEFS[rank].name}`);
    }

    const cost = g.exchangeCostNow;
    this.exchangeBtn.setLabel(cost === 0 ? '교환 (무료)' : `교환 (${cost}G)`);
    this.exchangeBtn.setEnabled(inPrep && !g.handConfirmed && g.gold >= cost);
    this.confirmBtn.setEnabled(inPrep && !g.handConfirmed);
  }
}
