import Phaser from 'phaser';
import { Card, HAND_NAMES_KO, HandRank, RANK_LABELS, SUIT_GLYPHS, Suit } from '../core/cards/types';
import { DeckEditOddsPair, DeckOdds, deckEditOddsPair, deckOdds } from '../core/cards/odds';
import { DeckEditStatus, DeckSealId, Game } from '../core/game';
import { closestHiddenRecipe, hiddenRecipeLabel, hiddenRecipeProgress } from '../core/cards/hiddenRecipes';
import { Button, UI, makeButton, makeText } from './ui';

const SUITS: Suit[] = ['S', 'H', 'D', 'C'];
const RANKS = Array.from({ length: 13 }, (_, index) => index + 2);

const STATUS_LABELS: Record<DeckEditStatus, string> = {
  ready: '사용 가능',
  wrong_phase: '준비 단계에서만 개조할 수 있습니다',
  maintenance_pending: '정비소 이용을 먼저 완료하세요',
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
  private banishPreview: Phaser.GameObjects.Text;
  private duplicatePreview: Phaser.GameObjects.Text;
  private hiddenRecipes: Phaser.GameObjects.Text;
  private banishBtn: Button;
  private duplicateBtn: Button;
  private baseOdds: DeckOdds;
  private previewCache = new Map<string, DeckEditOddsPair>();

  constructor(
    scene: Phaser.Scene,
    private game: Game,
    onClose: () => void,
    private onChanged: (id: DeckSealId, card: Card) => void,
  ) {
    this.baseOdds = deckOdds(game.deckSnapshot());
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

    this.hiddenRecipes = makeText(scene, 112, 143, '', 11, UI.gold, true);
    children.push(this.hiddenRecipes);

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

    this.detail = makeText(scene, 112, 486, '', 14, UI.text, true);
    this.banishPreview = makeText(scene, 112, 528, '', 11, '#df8d86');
    this.duplicatePreview = makeText(scene, 112, 551, '', 11, '#c4a2df');
    this.status = makeText(scene, 112, 578, '', 11, UI.textDim);
    children.push(
      this.detail,
      makeText(scene, 112, 509, '전체 5장 드로우 기준 · 선택 카드 개조 전후 정확 확률', 10, UI.accentText, true),
      this.banishPreview,
      this.duplicatePreview,
      this.status,
    );

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
      makeText(scene, 112, 604, '덱 제한 40–60장 · 변화량은 퍼센트포인트(%p)', 11, UI.textDim),
      makeText(scene, 112, 626, '추방·복제 인장은 보스전 직전 정비소에서 구매할 수 있습니다.', 11, UI.gold),
    );

    this.root = scene.add.container(0, 0, children).setDepth(46);
    this.refresh();
  }

  destroy(): void {
    this.root.destroy(true);
  }

  private apply(id: DeckSealId): void {
    if (!this.game.applyDeckSeal(id, this.selected)) return;
    this.baseOdds = deckOdds(this.game.deckSnapshot());
    this.previewCache.clear();
    this.onChanged(id, this.selected);
    this.refresh();
  }

  private refresh(): void {
    const selectedKey = cardKey(this.selected);
    const deck = this.game.deckSnapshot();
    const recipes = hiddenRecipeProgress(deck);
    const closest = closestHiddenRecipe(deck)!;
    const recommendation = closest.missing === 0
      ? `${HAND_NAMES_KO[closest.rank]} 재료 완성 · 같은 숫자를 HOLD해 노리세요`
      : `추천 ${SUIT_GLYPHS[closest.target.suit]}${RANK_LABELS[closest.target.rank]} 복제 → ${HAND_NAMES_KO[closest.rank]}까지 ${closest.missing}장`;
    this.hiddenRecipes.setText(
      `HIDDEN  ${recipes.map(hiddenRecipeLabel).join(' · ')}  │  ${recommendation}`,
    );
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
    this.banishPreview.setText(this.previewLabel('banish'));
    this.duplicatePreview.setText(this.previewLabel('duplicate'));
    this.banishBtn.setLabel(`추방 인장 ×${this.game.deckSeals.banish}`);
    this.duplicateBtn.setLabel(`복제 인장 ×${this.game.deckSeals.duplicate}`);
    this.banishBtn.setEnabled(banishStatus === 'ready');
    this.duplicateBtn.setEnabled(duplicateStatus === 'ready');
    this.status.setText(`추방: ${STATUS_LABELS[banishStatus]}   ·   복제: ${STATUS_LABELS[duplicateStatus]}`);
    this.status.setColor(
      banishStatus === 'ready' || duplicateStatus === 'ready' ? UI.accentText : UI.textDim,
    );
  }

  private previewLabel(action: DeckSealId): string {
    const actionLabel = action === 'banish' ? '추방 예측' : '복제 예측';
    const deckCount = this.game.deckCardCount(this.selected);
    if (deckCount === 0) return `${actionLabel} · 덱에 없는 카드`;
    if (action === 'banish' && this.game.deckSize <= 40) return `${actionLabel} · 40장 하한`;
    if (action === 'duplicate' && this.game.deckSize >= 60) return `${actionLabel} · 60장 상한`;

    const key = cardKey(this.selected);
    let pair = this.previewCache.get(key);
    if (!pair) {
      pair = deckEditOddsPair(this.game.deckSnapshot(), this.selected, this.baseOdds);
      this.previewCache.set(key, pair);
    }
    const preview = pair[action];
    const largest = preview.deltas
      .map((delta, rank) => ({ delta, rank: rank as HandRank }))
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
      .slice(0, 2)
      .map(({ delta, rank }) => `${HAND_NAMES_KO[rank]} ${formatDelta(delta)}`)
      .join(' · ');
    const advancedDelta = preview.deltas
      .slice(HandRank.Trips)
      .reduce((sum, delta) => sum + delta, 0);
    return `${actionLabel} · ${largest} · 트리플+ ${formatDelta(advancedDelta)}`;
  }
}

function cardKey(card: Card): string {
  return `${card.rank}${card.suit}`;
}

function suitColor(suit: Suit): string {
  return suit === 'H' || suit === 'D' ? '#e47b72' : UI.text;
}

export function formatDelta(delta: number): string {
  const normalized = Math.abs(delta) < 0.0000005 ? 0 : delta;
  const sign = normalized > 0 ? '+' : normalized < 0 ? '−' : '±';
  return `${sign}${(Math.abs(normalized) * 100).toFixed(3)}%p`;
}
