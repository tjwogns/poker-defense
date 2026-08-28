import Phaser from 'phaser';
import { Card, RANK_LABELS, SUIT_GLYPHS, Suit } from '../core/cards/types';
import { DeckEditStatus, DeckSealId, Game } from '../core/game';
import { Button, UI, makeButton, makeText } from './ui';

const SUITS: Suit[] = ['S', 'H', 'D', 'C'];
const RANKS = Array.from({ length: 13 }, (_, index) => index + 2);

const STATUS_LABELS: Record<DeckEditStatus, string> = {
  ready: '사용 가능',
  wrong_phase: '준비 단계에서만 개조할 수 있습니다',
  hand_locked: '족보를 확정하기 전에만 개조할 수 있습니다',
  exchange_started: '이번 라운드의 첫 교환 전에만 개조할 수 있습니다',
  no_seal: '정비소에서 해당 인장을 획득하세요',
  card_missing: '덱에 없는 카드입니다',
  hand_copy_protected: '현재 패의 마지막 사본은 추방할 수 없습니다',
  size_limit: '덱 크기 제한에 도달했습니다',
};

interface CardCell {
  card: Card;
  bg: Phaser.GameObjects.Rectangle;
  count: Phaser.GameObjects.Text;
}

export class DeckOverlay {
  private root: Phaser.GameObjects.Container;
  private selected: Card = { suit: 'S', rank: 2 };
  private cells: CardCell[] = [];
  private detail: Phaser.GameObjects.Text;
  private status: Phaser.GameObjects.Text;
  private banishBtn: Button;
  private duplicateBtn: Button;

  constructor(
    scene: Phaser.Scene,
    private game: Game,
    onClose: () => void,
    private onChanged: (id: DeckSealId, card: Card) => void,
  ) {
    const children: Phaser.GameObjects.GameObject[] = [];
    const dim = scene.add.rectangle(640, 360, 1280, 720, 0x020705, 0.9).setInteractive();
    const shadow = scene.add.rectangle(640, 363, 1120, 650, 0x000000, 0.48);
    const panel = scene.add.rectangle(640, 357, 1120, 650, UI.panel, 1)
      .setStrokeStyle(2, UI.panelGlow, 0.95);
    children.push(dim, shadow, panel);

    children.push(
      makeText(scene, 110, 52, 'RUN DECK', 11, UI.accentText, true),
      makeText(scene, 110, 75, '덱 보기 · 카드 개조', 29, UI.text, true),
      makeText(scene, 110, 114, '카드를 선택하면 보유 수량과 추방·복제 가능 여부를 확인할 수 있습니다.', 13, UI.textDim),
    );
    const close = makeButton(scene, 1090, 78, 110, 36, '닫기  ESC', onClose, {
      fill: 0x42544a,
      fontSize: 11,
    });
    children.push(close.container);

    SUITS.forEach((suit, suitIndex) => {
      const y = 190 + suitIndex * 78;
      children.push(makeText(scene, 112, y, SUIT_GLYPHS[suit], 30, suitColor(suit), true).setOrigin(0, 0.5));
      RANKS.forEach((rank, rankIndex) => {
        const card = { suit, rank };
        const x = 190 + rankIndex * 76;
        const bg = scene.add.rectangle(x, y, 66, 58, UI.panelRaised, 1)
          .setStrokeStyle(1, UI.panelLine, 0.9)
          .setInteractive({ useHandCursor: true });
        const label = makeText(scene, x, y - 9, `${SUIT_GLYPHS[suit]} ${RANK_LABELS[rank]}`, 14, suitColor(suit), true)
          .setOrigin(0.5);
        const count = makeText(scene, x, y + 14, '', 11, UI.textDim, true).setOrigin(0.5);
        bg.on('pointerdown', (_p: unknown, _x: unknown, _y: unknown, event: { stopPropagation(): void }) => {
          event.stopPropagation();
          this.selected = card;
          this.refresh();
        });
        this.cells.push({ card, bg, count });
        children.push(bg, label, count);
      });
    });

    this.detail = makeText(scene, 112, 530, '', 14, UI.text, true);
    this.status = makeText(scene, 112, 560, '', 12, UI.textDim);
    children.push(this.detail, this.status);

    this.banishBtn = makeButton(scene, 810, 610, 174, 42, '', () => this.apply('banish'), {
      fill: UI.danger,
      fontSize: 12,
    });
    this.duplicateBtn = makeButton(scene, 1000, 610, 174, 42, '', () => this.apply('duplicate'), {
      fill: 0x9f74cf,
      fontSize: 12,
    });
    children.push(this.banishBtn.container, this.duplicateBtn.container);

    children.push(
      makeText(scene, 112, 604, '덱 제한 40–60장', 11, UI.textDim),
      makeText(scene, 112, 626, '현재 v2 브랜치에서는 정비소 보상 연결 전이라 인장 재고가 0개입니다.', 11, UI.gold),
    );

    this.root = scene.add.container(0, 0, children).setDepth(46);
    this.refresh();
  }

  destroy(): void {
    this.root.destroy(true);
  }

  private apply(id: DeckSealId): void {
    if (!this.game.applyDeckSeal(id, this.selected)) return;
    this.onChanged(id, this.selected);
    this.refresh();
  }

  private refresh(): void {
    const selectedKey = cardKey(this.selected);
    for (const cell of this.cells) {
      const count = this.game.deckCardCount(cell.card);
      const selected = cardKey(cell.card) === selectedKey;
      cell.count.setText(count === 0 ? '없음' : `×${count}`);
      cell.count.setColor(count === 0 ? UI.dangerText : count > 1 ? UI.gold : UI.textDim);
      cell.bg.setFillStyle(selected ? 0x294a38 : count === 0 ? 0x231817 : UI.panelRaised, 1);
      cell.bg.setStrokeStyle(selected ? 2 : 1, selected ? UI.accent : UI.panelLine, selected ? 1 : 0.9);
    }

    const deckCount = this.game.deckCardCount(this.selected);
    const handCount = this.game.hand.filter((card) => cardKey(card) === selectedKey).length;
    this.detail.setText(
      `${SUIT_GLYPHS[this.selected.suit]} ${RANK_LABELS[this.selected.rank]}  ·  덱 ${deckCount}장  ·  현재 패 ${handCount}장  ·  전체 ${this.game.deckSize}장`,
    );

    const banishStatus = this.game.deckEditStatus('banish', this.selected);
    const duplicateStatus = this.game.deckEditStatus('duplicate', this.selected);
    this.banishBtn.setLabel(`추방 인장 ×${this.game.deckSeals.banish}`);
    this.duplicateBtn.setLabel(`복제 인장 ×${this.game.deckSeals.duplicate}`);
    this.banishBtn.setEnabled(banishStatus === 'ready');
    this.duplicateBtn.setEnabled(duplicateStatus === 'ready');
    this.status.setText(`추방: ${STATUS_LABELS[banishStatus]}   ·   복제: ${STATUS_LABELS[duplicateStatus]}`);
    this.status.setColor(
      banishStatus === 'ready' || duplicateStatus === 'ready' ? UI.accentText : UI.textDim,
    );
  }
}

function cardKey(card: Card): string {
  return `${card.rank}${card.suit}`;
}

function suitColor(suit: Suit): string {
  return suit === 'H' || suit === 'D' ? '#e47b72' : UI.text;
}
