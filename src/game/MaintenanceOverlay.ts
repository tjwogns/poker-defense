import Phaser from 'phaser';
import { DECK_SEAL_COSTS } from '../core/balance';
import { DeckSealId, Game } from '../core/game';
import { Button, UI, makeButton, makeText } from './ui';

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
  private boughtAny = false;

  constructor(
    scene: Phaser.Scene,
    private game: Game,
    private onBought: (id: DeckSealId, cost: number) => void,
    private onFinish: (openDeck: boolean) => void,
  ) {
    const children: Phaser.GameObjects.GameObject[] = [];
    const dim = scene.add.rectangle(640, 360, 1280, 720, 0x020705, 0.92).setInteractive();
    const shadow = scene.add.rectangle(640, 365, 820, 590, 0x000000, 0.5);
    const panel = scene.add.rectangle(640, 358, 820, 590, UI.panel, 1)
      .setStrokeStyle(2, 0xe6c84f, 0.95);
    children.push(dim, shadow, panel);

    children.push(
      makeText(scene, 270, 82, 'BOSS APPROACHING', 11, UI.dangerText, true),
      makeText(scene, 270, 106, '왕실 정비소', 31, UI.text, true),
      makeText(
        scene,
        270,
        148,
        `ROUND ${game.round} 보스전 전 · 이번 방문이 끝나면 다시 열 수 없습니다.`,
        13,
        UI.textDim,
      ),
    );
    this.goldText = makeText(scene, 1010, 109, '', 21, UI.gold, true).setOrigin(1, 0);
    children.push(this.goldText);

    (['banish', 'duplicate'] as const).forEach((id, index) => {
      const info = OFFER_INFO[id];
      const x = 445 + index * 390;
      const card = scene.add.rectangle(x, 335, 330, 280, UI.panelRaised, 1)
        .setStrokeStyle(2, info.color, 0.8);
      const glyph = makeText(
        scene,
        x,
        242,
        info.glyph,
        48,
        `#${info.color.toString(16).padStart(6, '0')}`,
        true,
      ).setOrigin(0.5);
      const name = makeText(scene, x, 294, info.name, 22, UI.text, true).setOrigin(0.5);
      const desc = makeText(scene, x, 342, info.description, 13, UI.textDim)
        .setOrigin(0.5)
        .setAlign('center')
        .setLineSpacing(5);
      const owned = makeText(scene, x, 400, '', 12, UI.accentText, true).setOrigin(0.5);
      const button = makeButton(
        scene,
        x,
        447,
        220,
        42,
        '',
        () => this.buy(id),
        { fill: info.color, fontSize: 13 },
      );
      this.offers.push({ id, button, owned });
      children.push(card, glyph, name, desc, owned, button.container);
    });

    children.push(
      makeText(scene, 270, 505, '구매한 인장은 런 동안 보관되며 덱 보기(D)에서 사용할 수 있습니다.', 12, UI.textDim),
      makeText(scene, 270, 530, '지금은 추방·복제만 판매합니다. 진열 리롤과 유물 상점은 후속 단계입니다.', 11, UI.gold),
    );
    this.finishBtn = makeButton(scene, 850, 595, 250, 48, '', () => this.finish(), {
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
    this.boughtAny = true;
    this.onBought(id, cost);
    this.refresh();
  }

  private finish(): void {
    if (!this.game.leaveMaintenance()) return;
    this.onFinish(this.boughtAny);
  }

  private refresh(): void {
    this.goldText.setText(`G  ${this.game.gold.toLocaleString()}`);
    for (const offer of this.offers) {
      const state = this.game.maintenanceOffer(offer.id);
      offer.button.setLabel(state.purchased ? '구매 완료' : `구매  ${state.cost}G`);
      offer.button.setEnabled(!state.purchased && state.affordable);
      offer.owned.setText(`보유 ×${this.game.deckSeals[offer.id]}`);
    }
    this.finishBtn.setLabel(this.boughtAny ? '정비 완료 · 덱 개조하기' : '이번에는 건너뛰기');
  }
}
