import Phaser from 'phaser';

/** 게임 전체 색 토큰 (다크 펠트 테마) */
export const UI = {
  bg: 0x0d1a12,
  fieldTile: 0x122019,
  pathTile: 0x1e2f24,
  gridLine: 0x1a291f,
  panel: 0x14211a,
  panelRaised: 0x192920,
  panelDeep: 0x0b1610,
  panelLine: 0x2a4133,
  panelGlow: 0x416c52,
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
  opts: { fill?: number; fontSize?: number; textColor?: string; stroke?: number } = {},
): Button {
  const fill = opts.fill ?? UI.accent;
  const red = (fill >> 16) & 0xff;
  const green = (fill >> 8) & 0xff;
  const blue = fill & 0xff;
  const luminance = (red * 0.299 + green * 0.587 + blue * 0.114) / 255;
  const shadow = scene.add.rectangle(0, 3, w, h, 0x000000, 0.32);
  const bg = scene.add.rectangle(0, 0, w, h, fill, 0.96)
    .setStrokeStyle(1, opts.stroke ?? 0xffffff, 0.22);
  const shine = scene.add.rectangle(0, -h / 2 + 2, w - 4, 2, 0xffffff, 0.13);
  const text = scene.add
    .text(0, 0, label, {
      fontFamily: FONT,
      fontSize: `${opts.fontSize ?? 15}px`,
      color: opts.textColor ?? (luminance < 0.36 ? UI.text : '#09130d'),
      fontStyle: 'bold',
      align: 'center',
    })
    .setOrigin(0.5);
  const container = scene.add.container(x, y, [shadow, bg, shine, text]);
  let enabled = true;

  bg.setInteractive({ useHandCursor: true });
  bg.on('pointerdown', (_p: unknown, _x: unknown, _y: unknown, event: { stopPropagation(): void }) => {
    event.stopPropagation();
    if (enabled) onClick();
  });
  bg.on('pointerover', () => {
    if (!enabled) return;
    bg.setAlpha(1);
    container.setScale(1.025);
  });
  bg.on('pointerout', () => {
    bg.setAlpha(0.96);
    container.setScale(1);
  });

  return {
    container,
    setEnabled(v: boolean) {
      enabled = v;
      container.setAlpha(v ? 1 : 0.3);
      if (!v) container.setScale(1);
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
