import Phaser from 'phaser';
import { Game } from '../core/game';
import { evaluateHand } from '../core/cards/evaluator';
import { HAND_NAMES_KO, RANK_LABELS, SUIT_GLYPHS } from '../core/cards/types';
import { UNIT_DEFS } from '../core/units';
import { HAND_PREVIEW_BOUNDS } from './layout';
import { Button, FONT, UI, makeButton, makeText } from './ui';
import { rerollOdds, RerollOdds } from '../core/cards/odds';
import { formatOddsPercent } from './OddsOverlay';
import { rerollGuidance } from './rerollGuidance';

const CARD_W = 74;
const CARD_H = 104;
const CARD_GAP = 84;
const BASE_X = 61;   // 첫 카드 중심
const BASE_Y = 616;  // 카드 중심 (홀드 시 -14)

interface CardView {
  root: Phaser.GameObjects.Container;
  shadow: Phaser.GameObjects.Rectangle;
  bg: Phaser.GameObjects.Rectangle;
  corner: Phaser.GameObjects.Text;
  suit: Phaser.GameObjects.Text;
  mirror: Phaser.GameObjects.Text;
  holdTag: Phaser.GameObjects.Text;
}

/** 하단 카드 5장 + 교환/확정 버튼 + 족보 미리보기 */
export class HandBar {
  private game: Game;
  private cards: CardView[] = [];
  private preview: Phaser.GameObjects.Text;
  private oddsText: Phaser.GameObjects.Text;
  private oddsBtn: Button;
  private exchangeBtn: Button;
  private confirmBtn: Button;
  private oddsSignature = '';
  private cachedOdds: RerollOdds | null = null;

  constructor(
    scene: Phaser.Scene,
    game: Game,
    onAction: (action: 'hold' | 'exchange' | 'confirm') => void,
    onOdds: (odds: RerollOdds) => void,
  ) {
    this.game = game;

    scene.add.rectangle(390, 628, 748, 152, UI.panelDeep, 0.96)
      .setStrokeStyle(1, UI.panelLine, 0.9).setDepth(0.5);
    scene.add.rectangle(390, 554, 744, 2, UI.accent, 0.22).setDepth(0.6);

    for (let i = 0; i < 5; i++) {
      const shadow = scene.add.rectangle(3, 5, CARD_W, CARD_H, 0x000000, 0.4);
      const bg = scene.add
        .rectangle(0, 0, CARD_W, CARD_H, UI.cardFace)
        .setStrokeStyle(2, 0x0b120d, 0.75);
      const inner = scene.add.rectangle(0, 0, CARD_W - 8, CARD_H - 8, UI.cardFace, 0)
        .setStrokeStyle(1, 0x19211c, 0.14);
      const corner = scene.add.text(-CARD_W / 2 + 8, -CARD_H / 2 + 6, '', {
        fontFamily: FONT, fontSize: '14px', fontStyle: 'bold', color: UI.cardInkBlack,
      });
      const suit = scene.add
        .text(0, 2, '', { fontFamily: FONT, fontSize: '36px', fontStyle: 'bold', color: UI.cardInkBlack })
        .setOrigin(0.5);
      const mirror = scene.add.text(CARD_W / 2 - 8, CARD_H / 2 - 7, '', {
        fontFamily: FONT, fontSize: '13px', fontStyle: 'bold', color: UI.cardInkBlack,
      }).setOrigin(0, 0).setRotation(Math.PI);
      const holdTag = scene.add
        .text(0, CARD_H / 2 - 11, 'LOCKED', {
          fontFamily: FONT, fontSize: '9px', fontStyle: 'bold', color: UI.accentText,
        })
        .setOrigin(0.5)
        .setVisible(false);
      const root = scene.add.container(BASE_X + i * CARD_GAP, BASE_Y, [shadow, bg, inner, corner, suit, mirror, holdTag]);
      root.setDepth(5);
      bg.setInteractive({ useHandCursor: true });
      bg.on('pointerdown', () => {
        this.game.toggleHold(i);
        onAction('hold');
      });
      this.cards.push({ root, shadow, bg, corner, suit, mirror, holdTag });
    }

    this.preview = makeText(
      scene,
      HAND_PREVIEW_BOUNDS.x,
      HAND_PREVIEW_BOUNDS.y,
      '',
      14,
      UI.text,
      true,
    )
      .setWordWrapWidth(HAND_PREVIEW_BOUNDS.width, true)
      .setLineSpacing(1)
      .setDepth(2);
    this.oddsText = makeText(scene, 456, 584, '', 11, UI.text, true)
      .setWordWrapWidth(210, true)
      .setLineSpacing(3)
      .setDepth(3);
    this.oddsBtn = makeButton(scene, 710, 574, 104, 28, '확률 자세히', () => {
      if (this.cachedOdds && this.game.phase === 'prep' && !this.game.handConfirmed) onOdds(this.cachedOdds);
    }, { fill: 0x42544a, fontSize: 10 });
    this.oddsBtn.container.setDepth(3);

    this.exchangeBtn = makeButton(scene, 542, 650, 160, 44, '교환 (무료)', () => {
      this.game.doExchange();
      onAction('exchange');
    });
    this.confirmBtn = makeButton(scene, 694, 650, 120, 44, '족보 확정 ▶', () => {
      this.game.confirmHand();
      onAction('confirm');
    }, { fill: 0xe6c84f });
    this.exchangeBtn.container.setDepth(2);
    this.confirmBtn.container.setDepth(2);
  }

  refresh(): void {
    const g = this.game;
    const inPrep = g.phase === 'prep';

    g.hand.forEach((card, i) => {
      const view = this.cards[i];
      const red = card.suit === 'H' || card.suit === 'D';
      const ink = red ? UI.cardInkRed : UI.cardInkBlack;
      const corner = `${RANK_LABELS[card.rank]} ${SUIT_GLYPHS[card.suit]}`;
      view.corner.setText(corner).setColor(ink);
      view.suit.setText(SUIT_GLYPHS[card.suit]).setColor(ink);
      view.mirror.setText(corner).setColor(ink);
      const held = g.holds[i];
      view.holdTag.setVisible(held);
      view.root.y = held ? BASE_Y - 14 : BASE_Y;
      view.bg.setFillStyle(held ? 0xfff9df : UI.cardFace, 1);
      view.bg.setStrokeStyle(2, held ? 0xe6c84f : 0x0b120d, held ? 1 : 0.75);
      view.shadow.setAlpha(held ? 0.58 : 0.4);
      view.root.setAlpha(inPrep && !g.handConfirmed ? 1 : 0.55);
    });

    const rank = evaluateHand(g.hand);
    if (!inPrep) {
      this.preview.setText('전투 진행 중…');
    } else if (g.handConfirmed) {
      const pending = g.pendingUnits.length;
      this.preview.setText(
        pending > 0
          ? `획득 ${UNIT_DEFS[g.lastHandRank!].name} · 초록 타일에 배치`
          : `${HAND_NAMES_KO[g.lastHandRank!]} 확정 완료`,
      );
    } else {
      this.preview.setText(`현재 패: ${HAND_NAMES_KO[rank]} → ${UNIT_DEFS[rank].name}`);
    }
    this.refreshOdds(inPrep && !g.handConfirmed);

    const cost = g.exchangeCostNow;
    this.exchangeBtn.setLabel(cost === 0 ? '교환 (무료)' : `교환 (${cost}G)`);
    this.exchangeBtn.setEnabled(inPrep && !g.handConfirmed && g.gold >= cost);
    this.confirmBtn.setEnabled(inPrep && !g.handConfirmed);
  }

  private refreshOdds(visible: boolean): void {
    this.oddsText.setVisible(visible);
    this.oddsBtn.container.setVisible(visible);
    if (!visible) return;
    const deck = this.game.deckSnapshot();
    const signature = [
      this.game.hand.map((card) => `${card.rank}${card.suit}`).join(','),
      this.game.holds.map(Number).join(''),
      deck.map((card) => `${card.rank}${card.suit}`).join(','),
    ].join('|');
    if (signature !== this.oddsSignature) {
      this.oddsSignature = signature;
      // 덱 개조로 같은 카드가 여러 장 존재할 수 있으므로 표준 52장이 아니라
      // 실제 런 덱을 기준으로 계산해야 한다. 그렇지 않으면 복제된 카드가 두 장
      // 이상 손에 잡혔을 때 remainingCards가 예외를 던져 게임 루프까지 멈춘다.
      this.cachedOdds = rerollOdds(this.game.hand, this.game.holds, deck);
    }
    const guide = rerollGuidance(this.cachedOdds!, formatOddsPercent);
    this.oddsText.setText(
      `${guide.title}\n${guide.decision}\n${guide.targets}`,
    );
  }
}
