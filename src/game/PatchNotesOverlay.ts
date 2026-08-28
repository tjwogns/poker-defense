import Phaser from 'phaser';
import { PATCH_NOTES } from '../meta/patchNotes';
import { UI, makeButton, makeText } from './ui';

export class PatchNotesOverlay {
  private root: Phaser.GameObjects.Container;
  private content: Phaser.GameObjects.Container;
  private maskShape: Phaser.GameObjects.Graphics;
  private scrollBar: Phaser.GameObjects.Rectangle;
  private scrollMax = 0;
  private scrollY = 0;
  private dragging = false;
  private dragStartY = 0;
  private dragStartScroll = 0;
  private wheelHandler: (
    pointer: Phaser.Input.Pointer,
    over: Phaser.GameObjects.GameObject[],
    dx: number,
    dy: number,
  ) => void;
  private moveHandler: (pointer: Phaser.Input.Pointer) => void;
  private upHandler: () => void;

  constructor(scene: Phaser.Scene, onClose: () => void) {
    const children: Phaser.GameObjects.GameObject[] = [];
    const dim = scene.add.rectangle(640, 360, 1280, 720, 0x020705, 0.9).setInteractive();
    const shadow = scene.add.rectangle(640, 363, 980, 620, 0x000000, 0.45);
    const panel = scene.add.rectangle(640, 356, 980, 620, UI.panel, 1)
      .setStrokeStyle(2, UI.panelGlow, 0.95)
      .setInteractive({ useHandCursor: true });
    children.push(dim, shadow, panel);

    children.push(
      makeText(scene, 180, 72, 'ROYAL SIEGE UPDATE LOG', 11, UI.accentText, true),
      makeText(scene, 180, 94, '패치 노트', 30, UI.text, true),
      makeText(scene, 180, 132, '새로운 빌드와 주요 변경사항을 확인하세요.', 13, UI.textDim),
    );
    const close = makeButton(scene, 1090, 91, 110, 36, '닫기  ESC', onClose, {
      fill: 0x42544a,
      fontSize: 11,
    });
    children.push(close.container);

    const contentChildren: Phaser.GameObjects.GameObject[] = [];
    const latest = PATCH_NOTES[0];
    contentChildren.push(
      scene.add.rectangle(418, 385, 460, 430, UI.panelRaised, 0.9).setStrokeStyle(1, UI.accent, 0.55),
      makeText(scene, 210, 184, `${latest.version}  ·  ${latest.title}`, 20, UI.gold, true),
      makeText(scene, 210, 214, `${latest.date}  ·  LATEST UPDATE`, 11, UI.textDim, true),
    );

    let y = 254;
    for (const section of latest.sections) {
      contentChildren.push(makeText(scene, 210, y, section.heading, 13, UI.accentText, true));
      y += 27;
      for (const item of section.items) {
        const line = makeText(scene, 226, y, `• ${item}`, 12, UI.text);
        line.setWordWrapWidth(400, true).setLineSpacing(3);
        contentChildren.push(line);
        y += line.height + 10;
      }
      y += 8;
    }

    contentChildren.push(
      makeText(scene, 690, 184, '이전 업데이트', 15, UI.text, true),
      scene.add.rectangle(880, 210, 380, 1, UI.panelLine, 1),
    );
    let historyY = 242;
    for (const note of PATCH_NOTES.slice(1)) {
      contentChildren.push(
        makeText(scene, 690, historyY, `${note.version}  ·  ${note.title}`, 15, UI.gold, true),
        makeText(scene, 1035, historyY + 2, note.date, 10, UI.textDim).setOrigin(1, 0),
      );
      historyY += 31;
      for (const section of note.sections) {
        for (const item of section.items) {
          const line = makeText(scene, 706, historyY, `• ${item}`, 11, UI.textDim);
          line.setWordWrapWidth(340, true).setLineSpacing(2);
          contentChildren.push(line);
          historyY += line.height + 8;
        }
      }
      historyY += 28;
    }

    this.content = scene.add.container(0, 0, contentChildren);
    this.maskShape = scene.make.graphics({ x: 0, y: 0 });
    this.maskShape.fillStyle(0xffffff).fillRect(170, 164, 890, 456);
    this.content.setMask(this.maskShape.createGeometryMask());
    this.scrollMax = Math.max(0, Math.max(y, historyY) - 610);
    children.push(this.content);

    const track = scene.add.rectangle(1094, 392, 4, 432, UI.panelLine, 0.7);
    const barHeight = Math.max(54, 432 * (456 / (456 + this.scrollMax)));
    this.scrollBar = scene.add.rectangle(1094, 176, 6, barHeight, UI.accent, 0.9).setOrigin(0.5, 0);
    children.push(
      track,
      this.scrollBar,
      makeText(scene, 180, 642, '휠 또는 드래그로 스크롤 · 새 업데이트가 이 화면에 계속 기록됩니다.', 11, UI.textDim),
    );
    this.root = scene.add.container(0, 0, children).setDepth(40);

    panel.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.y < 164 || pointer.y > 620) return;
      this.dragging = true;
      this.dragStartY = pointer.y;
      this.dragStartScroll = this.scrollY;
    });
    this.wheelHandler = (pointer, _over, _dx, dy) => {
      if (pointer.x < 170 || pointer.x > 1110 || pointer.y < 164 || pointer.y > 620) return;
      this.setScroll(this.scrollY + dy * 0.7);
    };
    this.moveHandler = (pointer) => {
      if (!this.dragging) return;
      this.setScroll(this.dragStartScroll + this.dragStartY - pointer.y);
    };
    this.upHandler = () => { this.dragging = false; };
    scene.input.on('wheel', this.wheelHandler);
    scene.input.on('pointermove', this.moveHandler);
    scene.input.on('pointerup', this.upHandler);
    this.setScroll(0);
  }

  destroy(): void {
    const scene = this.root.scene;
    scene.input.off('wheel', this.wheelHandler);
    scene.input.off('pointermove', this.moveHandler);
    scene.input.off('pointerup', this.upHandler);
    this.content.clearMask(true);
    this.maskShape.destroy();
    this.root.destroy(true);
  }

  private setScroll(next: number): void {
    this.scrollY = Phaser.Math.Clamp(next, 0, this.scrollMax);
    this.content.y = -this.scrollY;
    const travel = 432 - this.scrollBar.height;
    this.scrollBar.y = 176 + (this.scrollMax === 0 ? 0 : travel * (this.scrollY / this.scrollMax));
  }
}
