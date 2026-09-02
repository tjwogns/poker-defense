import Phaser from 'phaser';
import { DECK_SEAL_COSTS } from '../core/balance';
import { DeckSealId, Game } from '../core/game';
import {
  RELIC_DEFS, RELIC_RARITY_COLORS, RELIC_RARITY_LABELS, RELIC_SLOT_CAP, RelicId,
  relicSellPrice,
} from '../core/relics';
import { Button, UI, makeButton, makeText } from './ui';
import { createRelicIcon } from './relicAssets';
import { HAND_NAMES_KO, HandRank } from '../core/cards/types';
import { isPortraitLayout } from './device';
import { portraitSceneHeight, portraitY } from './layout';

interface OfferView {
  id: DeckSealId;
  button: Button;
  owned: Phaser.GameObjects.Text;
}

const OFFER_INFO: Record<DeckSealId, {
  glyph: string;
  name: string;
  description: string;
  color: number;
}> = {
  banish: {
    glyph: '✂',
    name: '추방 인장',
    description: '카드 1장의 사본을 제거합니다.\n덱 압축으로 원하는 족보를 노립니다.',
    color: UI.danger,
  },
  duplicate: {
    glyph: '⧉',
    name: '복제 인장',
    description: '카드 1장의 사본을 추가합니다.\n페어와 중복 족보 확률을 높입니다.',
    color: 0x9f74cf,
  },
};

export class MaintenanceOverlay {
  private root: Phaser.GameObjects.Container;
  private goldText: Phaser.GameObjects.Text;
  private finishBtn: Button;
  private offers: OfferView[] = [];
  private relicButtons: Button[] = [];
  private relicSlotIcons: Phaser.GameObjects.Container[] = [];
  private shopRelicButton!: Button;
  private masteryButton!: Button;
  private masteryText!: Phaser.GameObjects.Text;
  private relicHint!: Phaser.GameObjects.Text;
  private boughtSeal = false;
  private awaitingReplacement = false;
  private selectedReplacement: RelicId | null = null;
  private inspectedRelic: RelicId | null = null;

  constructor(
    private scene: Phaser.Scene,
    private game: Game,
    private onBought: (id: DeckSealId, cost: number) => void,
    private onRelicBought: (id: RelicId, cost: number, replaced: RelicId | null, refund: number) => void,
    private onMasteryBought: (rank: HandRank, level: number, cost: number) => void,
    private onRelicSold: (id: RelicId, value: number) => void,
    private onFinish: (openDeck: boolean) => void,
  ) {
    const portrait = isPortraitLayout();
    const height = portraitSceneHeight(scene);
    const py = (value: number) => portraitY(height, value);
    const cx = portrait ? 195 : 640;
    const children: Phaser.GameObjects.GameObject[] = [];
    const dim = scene.add.rectangle(cx, portrait ? height / 2 : 360, portrait ? 390 : 1280, portrait ? height : 720, 0x020705, 0.92).setInteractive();
    const shadow = scene.add.rectangle(cx, portrait ? height / 2 + 3 : 360, portrait ? 370 : 860, portrait ? height - 24 : 640, 0x000000, 0.5);
    const panel = scene.add.rectangle(cx, portrait ? height / 2 : 355, portrait ? 370 : 860, portrait ? height - 24 : 640, UI.panel, 1)
      .setStrokeStyle(2, 0xe6c84f, 0.95);
    children.push(dim, shadow, panel);

    children.push(
      makeText(scene, portrait ? 20 : 270, portrait ? py(28) : 82, 'BOSS APPROACHING', portrait ? 9 : 11, UI.dangerText, true),
      makeText(scene, portrait ? 20 : 270, portrait ? py(49) : 106, '왕실 정비소', portrait ? 22 : 31, UI.text, true),
      makeText(
        scene,
        portrait ? 20 : 270,
        portrait ? py(82) : 148,
        portrait ? `R${game.round} 보스전 전 · 이번 방문 후 다시 열 수 없음` : `ROUND ${game.round} 보스전 전 · 이번 방문이 끝나면 다시 열 수 없습니다.`,
        portrait ? 9 : 13,
        UI.textDim,
      ),
    );
    this.goldText = makeText(scene, portrait ? 366 : 1010, portrait ? py(53) : 109, '', portrait ? 16 : 21, UI.gold, true).setOrigin(1, 0);
    children.push(this.goldText);

    (['banish', 'duplicate'] as const).forEach((id, index) => {
      const info = OFFER_INFO[id];
      const x = portrait ? 68 + index * 127 : 360 + index * 280;
      const card = scene.add.rectangle(x, portrait ? py(300) : 335, portrait ? 116 : 240, portrait ? 250 : 280, UI.panelRaised, 1)
        .setStrokeStyle(2, info.color, 0.8);
      const glyph = makeText(
        scene,
        x,
        portrait ? py(220) : 242,
        info.glyph,
        portrait ? 34 : 48,
        `#${info.color.toString(16).padStart(6, '0')}`,
        true,
      ).setOrigin(0.5);
      const name = makeText(scene, x, portrait ? py(274) : 294, info.name, portrait ? 14 : 22, UI.text, true).setOrigin(0.5);
      const desc = makeText(scene, x, portrait ? py(318) : 342, info.description, portrait ? 9 : 13, UI.textDim)
        .setOrigin(0.5)
        .setAlign('center')
        .setLineSpacing(5);
      if (portrait) desc.setWordWrapWidth(98, true);
      const owned = makeText(scene, x, portrait ? py(385) : 400, '', portrait ? 9 : 12, UI.accentText, true).setOrigin(0.5);
      const button = makeButton(
        scene,
        x,
        portrait ? py(430) : 447,
        portrait ? 98 : 190,
        portrait ? 40 : 42,
        '',
        () => this.buy(id),
        { fill: info.color, fontSize: portrait ? 10 : 13 },
      );
      this.offers.push({ id, button, owned });
      children.push(card, glyph, name, desc, owned, button.container);
    });

    const relicOffer = game.maintenanceRelicOffer();
    const relicDef = relicOffer ? RELIC_DEFS[relicOffer.id] : null;
    const relicColor = relicDef ? RELIC_RARITY_COLORS[relicDef.rarity] : UI.panelLine;
    const relicX = portrait ? 322 : 920;
    const relicCard = scene.add.rectangle(relicX, portrait ? py(300) : 335, portrait ? 116 : 240, portrait ? 250 : 280, UI.panelRaised, 1)
      .setStrokeStyle(2, relicColor, 0.9);
    const relicIcon = relicDef
      ? createRelicIcon(scene, relicDef.id, relicX, portrait ? py(220) : 242, portrait ? 48 : 72)
      : makeText(scene, relicX, portrait ? py(220) : 242, '—', portrait ? 34 : 48, UI.textDim, true).setOrigin(0.5);
    const relicName = makeText(scene, relicX, portrait ? py(274) : 294, relicDef?.name ?? '유물 없음', portrait ? 13 : 20, UI.text, true).setOrigin(0.5);
    const relicDesc = makeText(scene, relicX, portrait ? py(318) : 338, relicDef?.description ?? '진열 가능한 유물이 없습니다.', portrait ? 9 : 12, UI.textDim)
      .setOrigin(0.5).setAlign('center').setWordWrapWidth(portrait ? 98 : 205, true);
    const shopRelicRarity = makeText(scene, relicX, portrait ? py(385) : 400, relicDef
      ? RELIC_RARITY_LABELS[relicDef.rarity] : '', portrait ? 9 : 12,
      relicDef ? `#${relicColor.toString(16).padStart(6, '0')}` : UI.accentText, true).setOrigin(0.5);
    this.shopRelicButton = makeButton(scene, relicX, portrait ? py(430) : 447, portrait ? 98 : 190, portrait ? 40 : 42, '', () => this.buyRelic(), {
      fill: relicColor, fontSize: portrait ? 9 : 12,
    });
    children.push(relicCard, relicIcon, relicName, relicDesc, shopRelicRarity, this.shopRelicButton.container);

    children.push(makeText(scene, portrait ? 20 : 230, portrait ? py(468) : 480, portrait ? '인장은 덱 보기에서 사용 · 유물/연마 즉시 적용' : '인장은 덱 보기(D)에서 사용 · 유물과 연마는 기존 군단에도 즉시 적용', portrait ? 9 : 11, UI.textDim));
    this.masteryText = makeText(scene, portrait ? 20 : 230, portrait ? py(500) : 503, '', portrait ? 9 : 11, UI.accentText, true).setWordWrapWidth(portrait ? 240 : 680, true);
    this.masteryButton = makeButton(scene, portrait ? 310 : 920, portrait ? py(510) : 510, portrait ? 112 : 190, 38, '', () => this.buyMastery(), {
      fill: 0x6ca4d9,
      fontSize: 11,
    });
    this.relicHint = makeText(scene, portrait ? 20 : 230, portrait ? py(552) : 536, '', portrait ? 8 : 10, UI.gold, true).setWordWrapWidth(portrait ? 350 : 760, true);
    children.push(this.masteryText, this.masteryButton.container, this.relicHint);
    for (let index = 0; index < RELIC_SLOT_CAP; index++) {
      const button = makeButton(
        scene,
        portrait ? 41 + index * 77 : 330 + index * 155,
        portrait ? py(610) : 577,
        portrait ? 70 : 142,
        58,
        '',
        () => this.sellRelic(index),
        { fill: 0x42544a, fontSize: portrait ? 8 : 10 },
      );
      this.relicButtons.push(button);
      children.push(button.container);
    }
    this.finishBtn = makeButton(scene, portrait ? 195 : 850, portrait ? py(700) : 640, portrait ? 330 : 250, portrait ? 50 : 44, '', () => this.finish(), {
      fill: 0x5cb187,
      fontSize: 14,
    });
    children.push(this.finishBtn.container);

    this.root = scene.add.container(0, 0, children).setDepth(48);
    this.refresh();
  }

  destroy(): void {
    this.root.destroy(true);
  }

  private buy(id: DeckSealId): void {
    const cost = DECK_SEAL_COSTS[id];
    if (!this.game.buyMaintenanceSeal(id)) return;
    this.boughtSeal = true;
    this.onBought(id, cost);
    this.refresh();
  }

  private finish(): void {
    if (!this.game.leaveMaintenance()) return;
    this.onFinish(this.boughtSeal);
  }

  private buyRelic(): void {
    const initial = this.game.maintenanceRelicOffer(this.selectedReplacement ?? undefined);
    if (!initial || initial.purchased) return;
    if (initial.requiresReplacement && !this.awaitingReplacement) {
      this.awaitingReplacement = true;
      this.refresh();
      return;
    }
    if (initial.requiresReplacement && !this.selectedReplacement) return;
    const replaced = this.selectedReplacement;
    if (!this.game.buyMaintenanceRelic(replaced ?? undefined)) return;
    this.onRelicBought(initial.id, initial.cost, replaced, initial.refund);
    this.awaitingReplacement = false;
    this.selectedReplacement = null;
    this.inspectedRelic = null;
    this.refresh();
  }

  private sellRelic(index: number): void {
    const id = this.game.relics[index];
    if (this.awaitingReplacement) {
      if (!id) return;
      this.selectedReplacement = this.selectedReplacement === id ? null : id;
      this.refresh();
      return;
    }
    if (id && this.inspectedRelic !== id) {
      this.inspectedRelic = id;
      this.refresh();
      return;
    }
    if (!id || !this.game.sellRelic(id)) return;
    this.inspectedRelic = null;
    this.onRelicSold(id, relicSellPrice(id));
    this.refresh();
  }

  private buyMastery(): void {
    const offer = this.game.maintenanceMasteryOffer();
    if (!offer || !this.game.buyMaintenanceMastery()) return;
    this.onMasteryBought(offer.rank, offer.nextLevel, offer.cost);
    this.refresh();
  }

  private refresh(): void {
    this.relicSlotIcons.forEach((icon) => icon.destroy(true));
    this.relicSlotIcons = [];
    this.goldText.setText(`G  ${this.game.gold.toLocaleString()}`);
    for (const offer of this.offers) {
      const state = this.game.maintenanceOffer(offer.id);
      offer.button.setLabel(state.purchased ? '구매 완료' : `구매  ${state.cost}G`);
      offer.button.setEnabled(!state.purchased && state.affordable);
      offer.owned.setText(`보유 ×${this.game.deckSeals[offer.id]}`);
    }
    const shopRelic = this.game.maintenanceRelicOffer(this.selectedReplacement ?? undefined);
    if (!shopRelic) {
      this.shopRelicButton.setLabel('진열 없음');
      this.shopRelicButton.setEnabled(false);
    } else if (shopRelic.purchased) {
      this.shopRelicButton.setLabel('구매 완료');
      this.shopRelicButton.setEnabled(false);
    } else if (shopRelic.requiresReplacement && this.awaitingReplacement) {
      const net = shopRelic.netCost;
      this.shopRelicButton.setLabel(this.selectedReplacement
        ? `교체 확정  ${net >= 0 ? `${net}G` : `+${-net}G`}`
        : '교체할 유물 선택');
      this.shopRelicButton.setEnabled(Boolean(this.selectedReplacement) && shopRelic.affordable);
    } else {
      this.shopRelicButton.setLabel(shopRelic.requiresReplacement
        ? `구매 ${shopRelic.cost}G · 교체 필요`
        : `구매  ${shopRelic.cost}G`);
      this.shopRelicButton.setEnabled(shopRelic.affordable);
    }
    const mastery = this.game.maintenanceMasteryOffer();
    if (!mastery) {
      this.masteryText.setText('HAND MASTERY · 모든 족보가 최대 레벨입니다.');
      this.masteryButton.setLabel('연마 완료');
      this.masteryButton.setEnabled(false);
    } else {
      this.masteryText.setText(mastery.purchased
        ? `HAND MASTERY · ${HAND_NAMES_KO[mastery.rank]} Lv${mastery.level}`
          + ` · 피해 ×${mastery.multiplier.toFixed(2)} · 이번 방문 완료`
        : `HAND MASTERY · ${HAND_NAMES_KO[mastery.rank]} Lv${mastery.level} → Lv${mastery.nextLevel}`
          + ` · 피해 ×${mastery.multiplier.toFixed(2)} → ×${mastery.nextMultiplier.toFixed(2)}`);
      this.masteryButton.setLabel(mastery.purchased ? '연마 완료' : `족보 연마  ${mastery.cost}G`);
      this.masteryButton.setEnabled(!mastery.purchased && mastery.affordable);
    }
    const inspected = this.inspectedRelic ? RELIC_DEFS[this.inspectedRelic] : null;
    this.relicHint.setText(this.awaitingReplacement
      ? '교체할 기존 유물을 선택한 뒤 위 유물 버튼으로 확정하세요.'
      : inspected
        ? `${inspected.name} · ${inspected.description} · 같은 버튼을 다시 누르면 판매`
        : `RELIC SLOTS · 최대 ${RELIC_SLOT_CAP}칸 · 보유 유물을 눌러 효과 확인`);
    for (let index = 0; index < this.relicButtons.length; index++) {
      const id = this.game.relics[index];
      const button = this.relicButtons[index];
      if (!id) {
        button.setLabel(`빈 슬롯\n${index + 1} / ${RELIC_SLOT_CAP}`);
        button.setEnabled(false);
        continue;
      }
      const def = RELIC_DEFS[id];
      const value = relicSellPrice(id);
      button.setLabel(this.awaitingReplacement
        ? `${this.selectedReplacement === id ? '✓ ' : ''}${def.name}\n교체 환급 ${value}G`
        : this.inspectedRelic === id
          ? `✓ ${def.name}\n다시 눌러 판매 ${value}G`
          : `${def.name}\n효과 보기`);
      button.setEnabled(true);
      const portrait = isPortraitLayout();
      const icon = createRelicIcon(
        this.scene,
        id,
        portrait ? 18 + index * 77 : 288 + index * 155,
        portrait ? portraitY(portraitSceneHeight(this.scene), 610) : 577,
        portrait ? 20 : 30,
      );
      this.relicSlotIcons.push(icon);
      this.root.add(icon);
    }
    this.finishBtn.setLabel(this.boughtSeal ? '정비 완료 · 덱 개조하기' : '정비 마치기');
  }
}
