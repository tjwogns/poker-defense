import Phaser from 'phaser';

/** 게임 전체 색 토큰 (다크 펠트 테마) */
export const UI = {
  bg: 0x0d1a12,
  fieldTile: 0x122019,
  pathTile: 0x1e2f24,
  gridLine: 0x1a291f,
  panel: 0x14211a,
  panelLine: 0x2a4133,
  text: '#e6ebe5',
  textDim: '#94a698',
  accent: 0x5cb187,
  accentText: '#5cb187',
  danger: 0xd06258,
  dangerText: '#d06258',
  gold: '#e6c84f',
  placeable: 0x5cb187,
  cardFace: 0xf5f3ec,
  cardInkRed: '#c23b2e',
  cardInkBlack: '#1a1d21',
} as const;

export const FONT = 'Pretendard, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';

export interface Button {
  container: Phaser.GameObjects.Container;
  setEnabled(enabled: boolean): void;
  setLabel(label: string): void;
}

export function makeButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  onClick: () => void,
  opts: { fill?: number; fontSize?: number } = {},
): Button {
  const fill = opts.fill ?? UI.accent;
  const bg = scene.add.rectangle(0, 0, w, h, fill, 0.92).setStrokeStyle(1, 0xffffff, 0.15);
  const text = scene.add
    .text(0, 0, label, {
      fontFamily: FONT,
      fontSize: `${opts.fontSize ?? 15}px`,
      color: '#0d1a12',
      fontStyle: 'bold',
    })
    .setOrigin(0.5);
  const container = scene.add.container(x, y, [bg, text]);
  let enabled = true;

  bg.setInteractive({ useHandCursor: true });
  bg.on('pointerdown', (_p: unknown, _x: unknown, _y: unknown, event: { stopPropagation(): void }) => {
    event.stopPropagation();
    if (enabled) onClick();
  });
  bg.on('pointerover', () => enabled && bg.setAlpha(1));
  bg.on('pointerout', () => bg.setAlpha(0.92));

  return {
    container,
    setEnabled(v: boolean) {
      enabled = v;
      container.setAlpha(v ? 1 : 0.35);
    },
    setLabel(s: string) {
      text.setText(s);
    },
  };
}

export function makeText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  str: string,
  size = 14,
  color: string = UI.text,
  bold = false,
): Phaser.GameObjects.Text {
  return scene.add.text(x, y, str, {
    fontFamily: FONT,
    fontSize: `${size}px`,
    color,
    fontStyle: bold ? 'bold' : 'normal',
  });
}
