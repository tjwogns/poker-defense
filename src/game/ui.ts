import Phaser from 'phaser';

/** 게임 전체 색 토큰 (다크 펠트 테마) */
export const UI = {
  bg: 0x0a0a0f,
  bgDeep: 0x08080c,
  fieldTile: 0x111716,
  pathTile: 0x1c2725,
  gridLine: 0x0a0d0d,
  panel: 0x121218,
  panelRaised: 0x17171f,
  panelDeep: 0x0d0d13,
  panelLine: 0x2b2a31,
  panelGlow: 0x5a4828,
  hairline: 0xe8b54b,
  text: '#f2ede3',
  textDim: '#8c8a96',
  textFaint: '#56545e',
  accent: 0x6fbf8e,
  accentText: '#6fbf8e',
  danger: 0xe05b4b,
  dangerText: '#e05b4b',
  coral: 0xff7366,
  sky: 0x6fb8c9,
  info: 0x6fb8c9,
  safe: 0x6fbf8e,
  gold: '#e8b54b',
  goldNum: 0xe8b54b,
  goldDeep: 0xd79f36,
  goldInk: '#17110a',
  placeable: 0x6fbf8e,
  cardFace: 0xe8e4d8,
  cardHeld: 0xf7f3e7,
  cardInkRed: '#c2402f',
  cardInkBlack: '#14141a',
} as const;

export const FONT = 'Pretendard, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
export const FONT_DISPLAY = '"Bodoni Moda", "Times New Roman", serif';
export const FONT_MONO = '"JetBrains Mono", ui-monospace, monospace';

export interface Button {
  container: Phaser.GameObjects.Container;
  setEnabled(enabled: boolean): void;
  setLabel(label: string): void;
  setFill(fill: number, textColor?: string): void;
}

export function makeButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  onClick: () => void,
  opts: {
    fill?: number;
    fontSize?: number;
    textColor?: string;
    stroke?: number;
    strokeAlpha?: number;
    radius?: number;
  } = {},
): Button {
  let currentFill = opts.fill ?? UI.accent;
  const radius = opts.radius ?? Math.min(8, h * 0.22);
  const bg = scene.add.graphics();
  const defaultTextColor = (fill: number) => {
    const red = (fill >> 16) & 0xff;
    const green = (fill >> 8) & 0xff;
    const blue = fill & 0xff;
    const luminance = (red * 0.299 + green * 0.587 + blue * 0.114) / 255;
    return luminance < 0.36 ? UI.text : UI.goldInk;
  };
  const redraw = (fill: number, alpha = 0.98) => {
    bg.clear()
      .fillStyle(fill, alpha)
      .fillRoundedRect(-w / 2, -h / 2, w, h, radius)
      .lineStyle(1, opts.stroke ?? 0xf2ede3, opts.strokeAlpha ?? 0.2)
      .strokeRoundedRect(-w / 2, -h / 2, w, h, radius);
  };
  redraw(currentFill);
  const text = scene.add
    .text(0, 0, label, {
      fontFamily: FONT,
      fontSize: `${opts.fontSize ?? 15}px`,
      color: opts.textColor ?? defaultTextColor(currentFill),
      fontStyle: 'bold',
      align: 'center',
    })
    .setOrigin(0.5);
  const container = scene.add.container(x, y, [bg, text]);
  let enabled = true;

  bg.setInteractive(new Phaser.Geom.Rectangle(-w / 2, -h / 2, w, h), Phaser.Geom.Rectangle.Contains);
  bg.on('pointerdown', (_p: unknown, _x: unknown, _y: unknown, event: { stopPropagation(): void }) => {
    event.stopPropagation();
    if (!enabled) return;
    container.setScale(0.97);
    scene.tweens.add({ targets: container, scale: 1, duration: 120, ease: 'Back.Out' });
    onClick();
  });
  bg.on('pointerover', () => {
    if (!enabled) return;
    redraw(currentFill, 1);
  });
  bg.on('pointerout', () => {
    redraw(currentFill);
    container.setScale(1);
  });

  return {
    container,
    setEnabled(v: boolean) {
      enabled = v;
      container.setAlpha(v ? 1 : 0.46);
      if (!v) container.setScale(1);
    },
    setLabel(s: string) {
      text.setText(s);
    },
    setFill(fill: number, textColor?: string) {
      currentFill = fill;
      redraw(currentFill);
      text.setColor(textColor ?? opts.textColor ?? defaultTextColor(currentFill));
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
