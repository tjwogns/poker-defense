import Phaser from 'phaser';
import { Card, HAND_NAMES_KO, HandRank, RANK_LABELS, SUIT_GLYPHS, Suit } from '../core/cards/types';
import { DeckEditOddsPair, DeckOdds, deckEditOddsPair, deckOdds } from '../core/cards/odds';
import { DeckEditStatus, DeckSealId, Game } from '../core/game';
import { closestHiddenRecipe, hiddenRecipeLabel, hiddenRecipeProgress } from '../core/cards/hiddenRecipes';
import { Button, UI, makeButton, makeText } from './ui';
import { isPortraitLayout } from './device';
import { portraitSceneHeight, portraitY } from './layout';

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
    const portrait = isPortraitLayout();
    const height = portraitSceneHeight(scene);
    const py = (value: number) => portraitY(height, value);
    const cx = portrait ? 195 : 640;
    const children: Phaser.GameObjects.GameObject[] = [];
    const dim = scene.add.rectangle(cx, portrait ? height / 2 : 360, portrait ? 390 : 1280, portrait ? height : 720, 0x020705, 0.9).setInteractive();
    const shadow = scene.add.rectangle(cx, portrait ? height / 2 + 3 : 363, portrait ? 370 : 1120, portrait ? height - 24 : 650, 0x000000, 0.48);
    const panel = scene.add.rectangle(cx, portrait ? height / 2 : 357, portrait ? 370 : 1120, portrait ? height - 24 : 650, UI.panel, 1)
      .setStrokeStyle(2, UI.panelGlow, 0.95);
    children.push(dim, shadow, panel);

    children.push(
      makeText(scene, portrait ? 20 : 110, portrait ? py(28) : 52, 'RUN DECK', portrait ? 9 : 11, UI.accentText, true),
      makeText(scene, portrait ? 20 : 110, portrait ? py(49) : 75, '덱 보기 · 카드 개조', portrait ? 22 : 29, UI.text, true),
      makeText(scene, portrait ? 20 : 110, portrait ? py(82) : 114, portrait ? '카드를 선택해 추방·복제 결과를 확인하세요.' : '카드를 선택하면 보유 수량과 추방·복제 가능 여부를 확인할 수 있습니다.', portrait ? 10 : 13, UI.textDim),
    );
    const close = makeButton(scene, portrait ? 338 : 1090, portrait ? py(49) : 78, portrait ? 76 : 110, portrait ? 38 : 36, portrait ? '닫기' : '닫기  ESC', onClose, {
      fill: 0x42544a,
      fontSize: 11,
    });
    children.push(close.container);

    this.hiddenRecipes = makeText(scene, portrait ? 20 : 112, portrait ? py(112) : 143, '', portrait ? 8 : 11, UI.gold, true)
      .setWordWrapWidth(portrait ? 350 : 1000, true);
    children.push(this.hiddenRecipes);

    SUITS.forEach((suit, suitIndex) => {
      const y = portrait ? py(175 + suitIndex * 66) : 190 + suitIndex * 78;
      children.push(makeText(scene, portrait ? 18 : 112, y, SUIT_GLYPHS[suit], portrait ? 18 : 30, suitColor(suit), true).setOrigin(0, 0.5));
      RANKS.forEach((rank, rankIndex) => {
        const card = { suit, rank };
        const x = portrait ? 48 + rankIndex * 26 : 190 + rankIndex * 76;
        const bg = scene.add.rectangle(x, y, portrait ? 23 : 66, portrait ? 42 : 58, UI.panelRaised, 1)
          .setStrokeStyle(1, UI.panelLine, 0.9)
          .setInteractive({ useHandCursor: true });
        const label = makeText(scene, x, y - (portrait ? 7 : 9), portrait ? `${RANK_LABELS[rank]}` : `${SUIT_GLYPHS[suit]} ${RANK_LABELS[rank]}`, portrait ? 9 : 14, suitColor(suit), true)
          .setOrigin(0.5);
        const count = makeText(scene, x, y + (portrait ? 10 : 14), '', portrait ? 8 : 11, UI.textDim, true).setOrigin(0.5);
        bg.on('pointerdown', (_p: unknown, _x: unknown, _y: unknown, event: { stopPropagation(): void }) => {
          event.stopPropagation();
          this.selected = card;
          this.refresh();
        });
        this.cells.push({ card, bg, count });
        children.push(bg, label, count);
      });
    });

    this.detail = makeText(scene, portrait ? 20 : 112, portrait ? py(468) : 486, '', portrait ? 11 : 14, UI.text, true);
    this.banishPreview = makeText(scene, portrait ? 20 : 112, portrait ? py(512) : 528, '', portrait ? 9 : 11, '#df8d86').setWordWrapWidth(portrait ? 350 : 1000, true);
    this.duplicatePreview = makeText(scene, portrait ? 20 : 112, portrait ? py(546) : 551, '', portrait ? 9 : 11, '#c4a2df').setWordWrapWidth(portrait ? 350 : 1000, true);
    this.status = makeText(scene, portrait ? 20 : 112, portrait ? py(580) : 578, '', portrait ? 9 : 11, UI.textDim).setWordWrapWidth(portrait ? 350 : 1000, true);
    children.push(
      this.detail,
      makeText(scene, portrait ? 20 : 112, portrait ? py(493) : 509, '전체 5장 드로우 기준 · 선택 카드 개조 전후 정확 확률', portrait ? 8 : 10, UI.accentText, true),
      this.banishPreview,
      this.duplicatePreview,
      this.status,
    );

    this.banishBtn = makeButton(scene, portrait ? 104 : 810, portrait ? py(650) : 610, portrait ? 158 : 174, portrait ? 48 : 42, '', () => this.apply('banish'), {
      fill: UI.danger,
      fontSize: 12,
    });
    this.duplicateBtn = makeButton(scene, portrait ? 286 : 1000, portrait ? py(650) : 610, portrait ? 158 : 174, portrait ? 48 : 42, '', () => this.apply('duplicate'), {
      fill: 0x9f74cf,
      fontSize: 12,
    });
    children.push(this.banishBtn.container, this.duplicateBtn.container);

    children.push(
      makeText(scene, portrait ? 20 : 112, portrait ? py(610) : 604, '덱 제한 40–60장 · 변화량은 퍼센트포인트(%p)', portrait ? 9 : 11, UI.textDim),
      makeText(scene, portrait ? 20 : 112, portrait ? py(708) : 626, '추방·복제 인장은 보스전 직전 정비소에서 구매', portrait ? 9 : 11, UI.gold),
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
