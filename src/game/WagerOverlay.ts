import Phaser from 'phaser';
import { RoyalWagerDefinition, RoyalWagerId } from '../core/wagers';
import { getLocale, tr } from '../i18n';
import { isPortraitLayout } from './device';
import { portraitSceneHeight, portraitY } from './layout';
import { FONT, FONT_DISPLAY, UI, makeButton } from './ui';

export class WagerOverlay {
  private root: Phaser.GameObjects.Container;

  constructor(
    scene: Phaser.Scene,
    offers: readonly RoyalWagerDefinition[],
    onChoose: (id: RoyalWagerId | null) => void,
  ) {
    const portrait = isPortraitLayout();
    const height = portrait ? portraitSceneHeight(scene) : 720;
    const py = (value: number) => portraitY(height, value);
    const root = scene.add.container(0, 0).setDepth(40);
    this.root = root;
    const blocker = scene.add.rectangle(portrait ? 195 : 640, height / 2, portrait ? 390 : 1280, height, 0x050508, 0.92)
      .setInteractive();
    root.add(blocker);

    const title = scene.add.text(portrait ? 195 : 640, portrait ? py(72) : 82, tr('왕실 내기', 'ROYAL WAGER'), {
      fontFamily: FONT_DISPLAY, fontSize: portrait ? '31px' : '42px', fontStyle: 'bold', color: UI.gold,
    }).setOrigin(0.5);
    const subtitle = scene.add.text(portrait ? 195 : 640, portrait ? py(118) : 132,
      tr('R1~R9에 도전하고 R10 직전에 보상을 받으세요', 'TAKE A R1–R9 CHALLENGE · REWARD PAID BEFORE R10'), {
        fontFamily: FONT, fontSize: portrait ? '11px' : '14px', color: UI.textDim, align: 'center',
      }).setOrigin(0.5);
    root.add([title, subtitle]);

    offers.forEach((offer, index) => {
      const x = portrait ? 195 : 320 + index * 320;
      const y = portrait ? py(230 + index * 145) : 340;
      const w = portrait ? 354 : 280;
      const h = portrait ? 132 : 300;
      const bg = scene.add.rectangle(x, y, w, h, UI.panelRaised, 1)
        .setStrokeStyle(1, UI.goldNum, 0.42);
      const copy = getLocale() === 'ko' ? offer.ko : offer.en;
      const reward = offer.reward.kind === 'gold'
        ? tr(`보상 +${offer.reward.amount}G`, `REWARD +${offer.reward.amount}G`)
        : tr(`보상 ${offer.reward.id === 'duplicate' ? '복제' : '추방'} 인장 ×1`, `REWARD ${offer.reward.id.toUpperCase()} SEAL ×1`);
      const name = scene.add.text(x, y - (portrait ? 38 : 105), copy.name, {
        fontFamily: FONT, fontSize: portrait ? '17px' : '22px', fontStyle: 'bold', color: UI.text,
      }).setOrigin(0.5);
      const body = scene.add.text(x, y - (portrait ? 8 : 45), copy.description, {
        fontFamily: FONT, fontSize: portrait ? '12px' : '14px', color: UI.textDim, align: 'center',
        wordWrap: { width: w - 30, useAdvancedWrap: true },
      }).setOrigin(0.5);
      const rewardText = scene.add.text(x, y + (portrait ? 14 : 35), reward, {
        fontFamily: FONT, fontSize: portrait ? '11px' : '13px', fontStyle: 'bold', color: UI.gold,
      }).setOrigin(0.5);
      const choose = makeButton(scene, x, y + (portrait ? 48 : 105), portrait ? 160 : 190, portrait ? 34 : 44,
        tr('이 내기 선택', 'CHOOSE WAGER'), () => { this.destroy(); onChoose(offer.id); }, {
          fill: UI.goldNum, textColor: UI.goldInk, fontSize: portrait ? 11 : 13, stroke: UI.goldNum,
        });
      root.add([bg, name, body, rewardText, choose.container]);
    });

    const skip = makeButton(scene, portrait ? 195 : 640, portrait ? py(710) : 560, portrait ? 220 : 250, 42,
      tr('내기 없이 시작', 'START WITHOUT WAGER'), () => { this.destroy(); onChoose(null); }, {
        fill: UI.panelDeep, textColor: UI.textDim, fontSize: 12, strokeAlpha: 0.24,
      });
    root.add(skip.container);
  }

  destroy(): void {
    this.root.destroy(true);
  }
}
