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
import { isCompactTouchDevice, isPortraitLayout } from './device';
import { PORTRAIT_BASE_WIDTH, portraitScale, portraitSceneHeight, portraitY } from './layout';

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
  private portrait = false;
  private baseY = BASE_Y;
  private portraitDecor: Array<Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Visible> = [];
  private combatLabel?: Phaser.GameObjects.Text;

  constructor(
    scene: Phaser.Scene,
    game: Game,
    onAction: (action: 'hold' | 'exchange' | 'confirm') => void,
    onOdds: (odds: RerollOdds) => void,
  ) {
    this.game = game;
    const compactTouch = isCompactTouchDevice();
    this.portrait = isPortraitLayout();
    const portraitHeight = portraitSceneHeight(scene);
    const py = (value: number) => portraitY(portraitHeight, value);
    const portraitDensity = Math.min(1, portraitScale(portraitHeight));
    const cardW = this.portrait ? Math.round(66 * portraitDensity) : CARD_W;
    const cardH = this.portrait ? Math.round(92 * portraitDensity) : CARD_H;
    const cardGap = this.portrait ? Math.round(74 * portraitDensity) : CARD_GAP;
    const baseX = this.portrait ? (PORTRAIT_BASE_WIDTH - cardGap * 4) / 2 : BASE_X;
    this.baseY = this.portrait ? py(524) : BASE_Y;

    if (this.portrait) {
      const divider = scene.add.graphics();
      divider.lineStyle(1, 0xf2ede3, 0.09);
      divider.lineBetween(8, py(459), 132, py(459));
      divider.lineBetween(258, py(459), 382, py(459));
      const dividerTitle = scene.add.text(195, py(452), 'YOUR HAND', {
        fontFamily: FONT, fontSize: '10px', fontStyle: 'bold', color: '#74727e', letterSpacing: 2,
      }).setOrigin(0.5, 0);
      this.portraitDecor.push(divider, dividerTitle);
      this.combatLabel = scene.add.text(195, py(560), '전투 진행 중…', {
        fontFamily: FONT, fontSize: '16px', fontStyle: 'bold', color: UI.textDim,
      }).setOrigin(0.5).setVisible(false);
    } else {
      scene.add.rectangle(381, 645, 714, 126, UI.panelDeep, 0.99)
        .setStrokeStyle(1, UI.goldNum, 0.18).setDepth(0.5);
    }

    for (let i = 0; i < 5; i++) {
      const shadow = scene.add.rectangle(2, 6, cardW, cardH, 0x000000, 0.48);
      const bg = scene.add
        .rectangle(0, 0, cardW, cardH, UI.cardFace)
        .setStrokeStyle(1, 0x000000, 0.35);
      const inner = scene.add.rectangle(0, 0, cardW - 8, cardH - 8, UI.cardFace, 0)
        .setStrokeStyle(1, 0x19211c, 0.14);
      const corner = scene.add.text(-cardW / 2 + 6, -cardH / 2 + 5, '', {
        fontFamily: FONT, fontSize: '14px', fontStyle: 'bold', color: UI.cardInkBlack,
      });
      const suit = scene.add
        .text(0, 2, '', { fontFamily: FONT, fontSize: this.portrait ? '32px' : '36px', fontStyle: 'bold', color: UI.cardInkBlack })
        .setOrigin(0.5);
      const holdTag = scene.add
        .text(0, cardH / 2 - 10, 'HOLD', {
          fontFamily: FONT, fontSize: '9px', fontStyle: 'bold', color: '#b98c2e',
          letterSpacing: 1,
        })
        .setOrigin(0.5)
        .setVisible(false);
      const root = scene.add.container(baseX + i * cardGap, this.baseY, [shadow, bg, inner, corner, suit, holdTag]);
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
      this.portrait ? 195 : HAND_PREVIEW_BOUNDS.x,
      this.portrait ? py(588) : HAND_PREVIEW_BOUNDS.y,
      '',
      this.portrait ? 13 : 14,
      UI.text,
      true,
    )
      .setWordWrapWidth(this.portrait ? 374 : HAND_PREVIEW_BOUNDS.width, true)
      .setLineSpacing(0)
      .setDepth(2);
    if (this.portrait) this.preview.setOrigin(0.5, 0);
    this.oddsText = scene.add.text(this.portrait ? 8 : HAND_ODDS_SUMMARY_BOUNDS.x, this.portrait ? py(622) : HAND_ODDS_SUMMARY_BOUNDS.y, '', {
      fontFamily: this.portrait ? FONT : FONT_MONO, fontSize: this.portrait ? '12px' : '10px', fontStyle: 'bold', color: '#cfe6ec',
      backgroundColor: '#172126', padding: { x: 8, y: 5 },
    })
      .setFixedSize(this.portrait ? 374 : HAND_ODDS_SUMMARY_BOUNDS.width, this.portrait ? 36 : HAND_ODDS_SUMMARY_BOUNDS.height)
      .setWordWrapWidth((this.portrait ? 374 : HAND_ODDS_SUMMARY_BOUNDS.width) - 16, true)
      .setLineSpacing(2)
      .setDepth(3);
    this.oddsBtn = makeButton(
      scene,
      this.portrait ? 340 : HAND_ODDS_BUTTON_BOUNDS.x + HAND_ODDS_BUTTON_BOUNDS.width / 2,
      this.portrait ? py(640) : HAND_ODDS_BUTTON_BOUNDS.y + HAND_ODDS_BUTTON_BOUNDS.height / 2,
      this.portrait ? 76 : HAND_ODDS_BUTTON_BOUNDS.width,
      this.portrait ? 36 : HAND_ODDS_BUTTON_BOUNDS.height,
      this.portrait ? '확률 보기' : '전체 확률',
      () => {
      if (this.cachedOdds && this.game.phase === 'prep' && !this.game.handConfirmed) onOdds(this.cachedOdds);
      },
      { fill: UI.panelRaised, textColor: '#6fb8c9', fontSize: this.portrait ? 11 : 10, stroke: UI.info, strokeAlpha: 0.25, radius: 4 },
    );
    this.oddsBtn.container.setDepth(3);

    this.suitBtns = Object.fromEntries((['S', 'H', 'D', 'C'] as Suit[]).map((suit, index) => {
      const button = makeButton(scene, (this.portrait ? 94 : 488) + index * (this.portrait ? 68 : 58), this.portrait ? py(626) : 638, this.portrait ? 60 : 52, this.portrait ? 36 : compactTouch ? 34 : 30, `${SUIT_GLYPHS[suit]}`, () => {
        if (this.game.selectDominantSuit(suit)) onAction('hold');
      }, {
        fill: suit === 'S' ? 0x55708f : suit === 'H' ? 0xa84e62 : suit === 'D' ? 0x9b7a32 : 0x477757,
        fontSize: 13,
      });
      button.container.setDepth(4).setVisible(false);
      return [suit, button];
    })) as Record<Suit, Button>;

    this.exchangeBtn = makeButton(scene, this.portrait ? 64 : 520, this.portrait ? py(702) : 682, this.portrait ? 112 : 96, this.portrait ? 56 : compactTouch ? 52 : 48, '교환', () => {
      this.game.doExchange();
      onAction('exchange');
    }, { fill: UI.panelRaised, textColor: UI.text, strokeAlpha: 0.22, radius: 8, fontSize: 14 });
    this.confirmBtn = makeButton(scene, this.portrait ? 257 : 646, this.portrait ? py(702) : 682, this.portrait ? 254 : 146, this.portrait ? 56 : compactTouch ? 52 : 48, '이 패로 확정', () => {
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
      view.root.y = held ? this.baseY - (this.portrait ? 6 : 8) : this.baseY;
      view.bg.setFillStyle(held ? UI.cardHeld : UI.cardFace, 1);
      view.bg.setStrokeStyle(held ? 2 : 1, held ? UI.goldNum : 0x000000, held ? 1 : 0.35);
      view.shadow.setAlpha(held ? 0.58 : 0.4);
      view.root.setAlpha(inPrep && !g.handConfirmed ? 1 : 0.55);
      if (this.portrait) view.root.setVisible(inPrep);
    });

    if (this.portrait) {
      this.portraitDecor.forEach((object) => object.setVisible(inPrep));
      this.combatLabel?.setVisible(!inPrep);
      this.preview.setVisible(inPrep);
    }

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
        ? this.portrait ? '대표 문양을 선택하세요' : `${HAND_NAMES_KO[rank]}${variantText} · 대표 문양 선택`
        : `${HAND_NAMES_KO[rank]}${variantText}  →  ${variantUnitName(UNIT_DEFS[rank].name, variant)}`
          + `${suit ? `  ·  ${SUIT_GLYPHS[suit]} ${SUIT_TRAIT_LABELS[suit]}` : ''}`);
    }
    this.refreshOdds(inPrep && !g.handConfirmed && !showSuitChoices);
    for (const [candidate, button] of Object.entries(this.suitBtns) as [Suit, Button][]) {
      const visible = showSuitChoices && suitChoices.includes(candidate);
      if (this.portrait && visible) {
        const choiceIndex = suitChoices.indexOf(candidate);
        button.container.x = 195 + (choiceIndex - (suitChoices.length - 1) / 2) * 68;
      }
      button.container.setVisible(visible);
      button.setLabel(candidate === g.selectedDominantSuit ? `${SUIT_GLYPHS[candidate]} ●` : SUIT_GLYPHS[candidate]);
      button.setEnabled(visible);
    }

    const cost = g.exchangeCostNow;
    const remaining = g.exchangesRemaining;
    this.exchangeBtn.setLabel(g.lifeMode
      ? this.portrait ? `교환\n${remaining}회 남음` : `교환 ${remaining}/${g.maxExchangesNow}\nE`
      : this.portrait
        ? cost === 0 ? '교환\n무료' : `교환\n${cost}G`
        : cost === 0 ? '교환\n무료 · E' : `교환\n${cost}G · E`);
    this.exchangeBtn.setEnabled(
      inPrep && !g.handConfirmed && g.gold >= cost && (remaining === null || remaining > 0),
    );
    this.confirmBtn.setLabel(needsSuitChoice ? '문양 선택 필요' : this.portrait ? '이 패로 확정' : '이 패로 확정\nENTER');
    this.confirmBtn.setEnabled(inPrep && !g.handConfirmed && !needsSuitChoice);
    if (this.portrait) {
      this.exchangeBtn.container.setVisible(inPrep && !g.handConfirmed);
      this.confirmBtn.container.setVisible(inPrep && !g.handConfirmed);
    }
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
