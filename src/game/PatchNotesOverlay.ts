import Phaser from 'phaser';
import { PATCH_NOTES } from '../meta/patchNotes';
import { UI, makeButton, makeText } from './ui';

export class PatchNotesOverlay {
  private root: Phaser.GameObjects.Container;

  constructor(scene: Phaser.Scene, onClose: () => void) {
    const children: Phaser.GameObjects.GameObject[] = [];
    const dim = scene.add.rectangle(640, 360, 1280, 720, 0x020705, 0.9).setInteractive();
    const shadow = scene.add.rectangle(640, 363, 980, 620, 0x000000, 0.45);
    const panel = scene.add.rectangle(640, 356, 980, 620, UI.panel, 1)
      .setStrokeStyle(2, UI.panelGlow, 0.95);
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

    const latest = PATCH_NOTES[0];
    children.push(
      scene.add.rectangle(418, 385, 460, 430, UI.panelRaised, 0.9).setStrokeStyle(1, UI.accent, 0.55),
      makeText(scene, 210, 184, `${latest.version}  ·  ${latest.title}`, 20, UI.gold, true),
      makeText(scene, 210, 214, `${latest.date}  ·  LATEST UPDATE`, 11, UI.textDim, true),
    );

    let y = 254;
    for (const section of latest.sections) {
      children.push(makeText(scene, 210, y, section.heading, 13, UI.accentText, true));
      y += 27;
      for (const item of section.items) {
        const line = makeText(scene, 226, y, `• ${item}`, 12, UI.text);
        line.setWordWrapWidth(400, true).setLineSpacing(3);
        children.push(line);
        y += line.height + 10;
      }
      y += 8;
    }

    children.push(
      makeText(scene, 690, 184, '이전 업데이트', 15, UI.text, true),
      scene.add.rectangle(880, 210, 380, 1, UI.panelLine, 1),
    );
    let historyY = 242;
    for (const note of PATCH_NOTES.slice(1)) {
      children.push(
        makeText(scene, 690, historyY, `${note.version}  ·  ${note.title}`, 15, UI.gold, true),
        makeText(scene, 1035, historyY + 2, note.date, 10, UI.textDim).setOrigin(1, 0),
      );
      historyY += 31;
      for (const section of note.sections) {
        for (const item of section.items) {
          const line = makeText(scene, 706, historyY, `• ${item}`, 11, UI.textDim);
          line.setWordWrapWidth(340, true).setLineSpacing(2);
          children.push(line);
          historyY += line.height + 8;
        }
      }
      historyY += 28;
    }

    children.push(makeText(scene, 180, 642, '새 업데이트가 배포될 때 이 화면에 계속 기록됩니다.', 11, UI.textDim));
    this.root = scene.add.container(0, 0, children).setDepth(40);
  }

  destroy(): void {
    this.root.destroy(true);
  }
}
