import Phaser from 'phaser';
import { Game } from '../core/game';
import { evaluateHand } from '../core/cards/evaluator';
import { HAND_NAMES_KO, RANK_LABELS, Suit, SUIT_GLYPHS } from '../core/cards/types';
import {
  HAND_VARIANT_LABELS, handVariant, suitIdentityLabel, SUIT_TRAIT_LABELS, variantUnitName,
} from '../core/cards/handIdentity';
import { UNIT_DEFS } from '../core/units';
import {
  HAND_ODDS_BUTTON_BOUNDS, HAND_ODDS_SUMMARY_BOUNDS, HAND_PREVIEW_BOUNDS,
} from './layout';
import { Button, FONT, FONT_MONO, UI, makeButton, makeText } from './ui';
import { rerollOdds, RerollOdds } from '../core/cards/odds';
import { formatOddsPercent } from './OddsOverlay';
import { rerollGuidance } from './rerollGuidance';
import { isCompactTouchDevice } from './device';

const CARD_W = 76;
const CARD_H = 102;
const CARD_GAP = 85;
const BASE_X = 62;
const BASE_Y = 646;

interface CardView {
  root: Phaser.GameObjects.Container;
  shadow: Phaser.GameObjects.Rectangle;
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
  private oddsText: Phaser.GameObjects.Text;
  private oddsBtn: Button;
  private exchangeBtn: Button;
  private confirmBtn: Button;
  private suitBtns: Record<Suit, Button>;
  private oddsSignature = '';
  private cachedOdds: RerollOdds | null = null;

  constructor(
    scene: Phaser.Scene,
    game: Game,
    onAction: (action: 'hold' | 'exchange' | 'confirm') => void,
    onOdds: (odds: RerollOdds) => void,
  ) {
    this.game = game;
    const compactTouch = isCompactTouchDevice();

    scene.add.rectangle(381, 645, 714, 126, UI.panelDeep, 0.99)
      .setStrokeStyle(1, UI.goldNum, 0.18).setDepth(0.5);

    for (let i = 0; i < 5; i++) {
      const shadow = scene.add.rectangle(2, 6, CARD_W, CARD_H, 0x000000, 0.48);
      const bg = scene.add
        .rectangle(0, 0, CARD_W, CARD_H, UI.cardFace)
        .setStrokeStyle(1, 0x000000, 0.35);
      const inner = scene.add.rectangle(0, 0, CARD_W - 8, CARD_H - 8, UI.cardFace, 0)
        .setStrokeStyle(1, 0x19211c, 0.14);
      const corner = scene.add.text(-CARD_W / 2 + 8, -CARD_H / 2 + 6, '', {
        fontFamily: FONT, fontSize: '14px', fontStyle: 'bold', color: UI.cardInkBlack,
      });
      const suit = scene.add
        .text(0, 2, '', { fontFamily: FONT, fontSize: '36px', fontStyle: 'bold', color: UI.cardInkBlack })
        .setOrigin(0.5);
      const holdTag = scene.add
        .text(0, CARD_H / 2 - 10, 'HOLD', {
          fontFamily: FONT, fontSize: '9px', fontStyle: 'bold', color: '#b98c2e',
          letterSpacing: 1,
        })
        .setOrigin(0.5)
        .setVisible(false);
      const root = scene.add.container(BASE_X + i * CARD_GAP, BASE_Y, [shadow, bg, inner, corner, suit, holdTag]);
      root.setDepth(5);
      bg.setInteractive({ useHandCursor: true });
      bg.on('pointerdown', () => {
        this.game.toggleHold(i);
        onAction('hold');
      });
      this.cards.push({ root, shadow, bg, corner, suit, holdTag });
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
      .setLineSpacing(0)
      .setDepth(2);
    this.oddsText = scene.add.text(HAND_ODDS_SUMMARY_BOUNDS.x, HAND_ODDS_SUMMARY_BOUNDS.y, '', {
      fontFamily: FONT_MONO, fontSize: '10px', fontStyle: 'bold', color: '#cfe6ec',
      backgroundColor: '#172126', padding: { x: 8, y: 5 },
    })
      .setFixedSize(HAND_ODDS_SUMMARY_BOUNDS.width, HAND_ODDS_SUMMARY_BOUNDS.height)
      .setWordWrapWidth(HAND_ODDS_SUMMARY_BOUNDS.width - 16, true)
      .setLineSpacing(2)
      .setDepth(3);
    this.oddsBtn = makeButton(
      scene,
      HAND_ODDS_BUTTON_BOUNDS.x + HAND_ODDS_BUTTON_BOUNDS.width / 2,
      HAND_ODDS_BUTTON_BOUNDS.y + HAND_ODDS_BUTTON_BOUNDS.height / 2,
      HAND_ODDS_BUTTON_BOUNDS.width,
      HAND_ODDS_BUTTON_BOUNDS.height,
      '전체 확률',
      () => {
      if (this.cachedOdds && this.game.phase === 'prep' && !this.game.handConfirmed) onOdds(this.cachedOdds);
      },
      { fill: UI.panelRaised, textColor: '#6fb8c9', fontSize: 10, stroke: UI.info, strokeAlpha: 0.25, radius: 4 },
    );
    this.oddsBtn.container.setDepth(3);

    this.suitBtns = Object.fromEntries((['S', 'H', 'D', 'C'] as Suit[]).map((suit, index) => {
      const button = makeButton(scene, 488 + index * 58, 638, 52, compactTouch ? 34 : 30, `${SUIT_GLYPHS[suit]}`, () => {
        if (this.game.selectDominantSuit(suit)) onAction('hold');
      }, {
        fill: suit === 'S' ? 0x55708f : suit === 'H' ? 0xa84e62 : suit === 'D' ? 0x9b7a32 : 0x477757,
        fontSize: 13,
      });
      button.container.setDepth(4).setVisible(false);
      return [suit, button];
    })) as Record<Suit, Button>;

    this.exchangeBtn = makeButton(scene, 520, 682, 96, compactTouch ? 52 : 48, '교환', () => {
      this.game.doExchange();
      onAction('exchange');
    }, { fill: UI.panelRaised, textColor: UI.text, strokeAlpha: 0.22, radius: 8, fontSize: 14 });
    this.confirmBtn = makeButton(scene, 646, 682, 146, compactTouch ? 52 : 48, '이 패로 확정', () => {
      if (this.game.confirmHand(true) !== null) onAction('confirm');
      else this.refresh();
    }, { fill: UI.goldNum, textColor: UI.goldInk, stroke: UI.goldNum, strokeAlpha: 0.5, radius: 8, fontSize: 15 });
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
      const held = g.holds[i];
      view.holdTag.setVisible(held);
      view.root.y = held ? BASE_Y - 8 : BASE_Y;
      view.bg.setFillStyle(held ? UI.cardHeld : UI.cardFace, 1);
      view.bg.setStrokeStyle(held ? 2 : 1, held ? UI.goldNum : 0x000000, held ? 1 : 0.35);
      view.shadow.setAlpha(held ? 0.58 : 0.4);
      view.root.setAlpha(inPrep && !g.handConfirmed ? 1 : 0.55);
    });

    const rank = evaluateHand(g.hand);
    const variant = handVariant(g.hand, rank);
    const variantText = variant ? ` · ${HAND_VARIANT_LABELS[variant]}` : '';
    const suit = g.dominantSuitNow;
    const suitChoices = g.dominantSuitChoicesNow;
    const showSuitChoices = inPrep && !g.handConfirmed && suitChoices.length > 1;
    const needsSuitChoice = showSuitChoices && !suit;
    if (!inPrep) {
      this.preview.setText('전투 진행 중…');
    } else if (g.handConfirmed) {
      const pending = g.pendingUnits.length;
      this.preview.setText(
        pending > 0
          ? `획득 ${variantUnitName(UNIT_DEFS[g.lastHandRank!].name, g.lastHandVariant)} · ${suitIdentityLabel(g.lastHandSuit)}`
            + `${g.lastHandVariant ? ` · ${HAND_VARIANT_LABELS[g.lastHandVariant]}` : ''}`
          : `${HAND_NAMES_KO[g.lastHandRank!]} 확정 완료`,
      );
    } else {
      this.preview.setText(needsSuitChoice
        ? `${HAND_NAMES_KO[rank]}${variantText} · 대표 문양 선택`
        : `${HAND_NAMES_KO[rank]}${variantText}  →  ${variantUnitName(UNIT_DEFS[rank].name, variant)}`
          + `${suit ? `  ·  ${SUIT_GLYPHS[suit]} ${SUIT_TRAIT_LABELS[suit]}` : ''}`);
    }
    this.refreshOdds(inPrep && !g.handConfirmed && !showSuitChoices);
    for (const [candidate, button] of Object.entries(this.suitBtns) as [Suit, Button][]) {
      const visible = showSuitChoices && suitChoices.includes(candidate);
      button.container.setVisible(visible);
      button.setLabel(candidate === g.selectedDominantSuit ? `${SUIT_GLYPHS[candidate]} ●` : SUIT_GLYPHS[candidate]);
      button.setEnabled(visible);
    }

    const cost = g.exchangeCostNow;
    this.exchangeBtn.setLabel(cost === 0 ? '교환\n무료 · E' : `교환\n${cost}G · E`);
    this.exchangeBtn.setEnabled(inPrep && !g.handConfirmed && g.gold >= cost);
    this.confirmBtn.setLabel(needsSuitChoice ? '문양 선택 필요' : '이 패로 확정\nENTER');
    this.confirmBtn.setEnabled(inPrep && !g.handConfirmed && !needsSuitChoice);
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
    this.oddsText.setText(`${guide.title}\n${guide.decision}`);
  }
}
