import Phaser from 'phaser';
import { Game } from '../core/game';
import { HandRank, SUIT_GLYPHS } from '../core/cards/types';
import { enemyPos, unitPos } from '../core/combat';
import { UNIT_DEFS } from '../core/units';
import { ENEMY_KINDS, EnemyKindId } from '../core/enemies';
import {
  GRID_W, GRID_H, TILE, isPathTile, isPlaceable, pointAt, recommendedPlacementTiles, tileCanReachPath, tileCenter,
} from '../core/map';
import { UI, FONT, FONT_DISPLAY } from './ui';
import { UNIT_SPRITE_KEYS } from './unitAssets';
import { unitIntroDuration, unitSpriteExtent } from './unitVisualPolicy';
import { bossSpriteKey } from './bossAssets';
import { bossIntroDuration, bossSpriteExtent } from './bossVisualPolicy';

export const FIELD_X = 24;
export const FIELD_Y = 68;

export function tileAtScreen(px: number, py: number): { tx: number; ty: number } | null {
  const tx = Math.floor((px - FIELD_X) / TILE);
  const ty = Math.floor((py - FIELD_Y) / TILE);
  if (tx < 0 || ty < 0 || tx >= GRID_W || ty >= GRID_H) return null;
  return { tx, ty };
}

export function isInsideField(px: number, py: number): boolean {
  return tileAtScreen(px, py) !== null;
}

/** 이번 프레임에 그릴 공격 이펙트 */
export interface Fx {
  kind: 'attack' | 'death' | 'bossAbility';
  unitId?: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  ttl: number;
  duration: number;
  color: number;
  tier: HandRank;
  targetKind: EnemyKindId;
  targetRound?: number;
  bossAbility?: 'tax' | 'summon';
  seed: number;
}

const ENEMY_RADIUS: Record<EnemyKindId, number> = {
  normal: 9, fast: 7, tank: 11, regen: 9, splitter: 10, boss: 17,
};

interface EnemyView {
  root: Phaser.GameObjects.Container;
  hpBg: Phaser.GameObjects.Rectangle;
  hpFg: Phaser.GameObjects.Rectangle;
  barWidth: number;
  introStartedAt: number;
  introRing: Phaser.GameObjects.Arc | null;
}

interface UnitView {
  root: Phaser.GameObjects.Container;
  selection: Phaser.GameObjects.Arc;
  halo: Phaser.GameObjects.Arc;
  introStartedAt: number;
}

function unitVisual(scene: Phaser.Scene, tier: HandRank, color: number): Phaser.GameObjects.GameObject {
  const key = UNIT_SPRITE_KEYS[tier];
  if (!key || !scene.textures.exists(key)) return unitArt(scene, tier, color);
  const image = scene.add.image(0, -2, key);
  const extent = unitSpriteExtent(tier);
  const scale = Math.min(extent / image.width, extent / image.height);
  return image.setDisplaySize(image.width * scale, image.height * scale);
}

function unitArt(scene: Phaser.Scene, tier: HandRank, color: number): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  const dark = 0x101a14;
  const light = 0xf3ead4;
  g.lineStyle(1.4, dark, 0.95);

  const head = (x = 0, y = -7, radius = 4) => {
    g.fillStyle(light, 1);
    g.fillCircle(x, y, radius);
    g.strokeCircle(x, y, radius);
  };
  const body = (width = 13, height = 14) => {
    g.fillStyle(color, 1);
    g.fillRoundedRect(-width / 2, -3, width, height, 3);
    g.strokeRoundedRect(-width / 2, -3, width, height, 3);
  };

  if (tier === HandRank.HighCard) {
    body(11, 14); head();
    g.fillStyle(0x8ca0ae, 1); g.fillCircle(-7, 3, 5); g.strokeCircle(-7, 3, 5);
    g.lineStyle(2, light, 1); g.lineBetween(6, -3, 10, 9); g.lineBetween(4, 5, 11, 5);
  } else if (tier === HandRank.Pair) {
    body(9, 14); head(0, -8, 3.8);
    g.lineStyle(2, 0x7c4e2e, 1); g.beginPath(); g.arc(5, 1, 8, -1.25, 1.25); g.strokePath();
    g.lineStyle(1, light, 1); g.lineBetween(7, -6, 7, 8); g.lineBetween(-1, 1, 13, 1);
    g.fillTriangle(14, 1, 10, -1.5, 10, 3.5);
  } else if (tier === HandRank.TwoPair) {
    body(12, 13); head(0, -8, 3.8);
    g.lineStyle(2, 0x8f6238, 1);
    g.lineBetween(-12, -1, -2, 3); g.lineBetween(2, 3, 12, -1);
    g.lineBetween(-10, -4, -10, 2); g.lineBetween(10, -4, 10, 2);
    g.fillStyle(light, 1); g.fillTriangle(-13, -2, -8, -4, -9, 0); g.fillTriangle(13, -2, 8, -4, 9, 0);
  } else if (tier === HandRank.Trips) {
    g.fillStyle(color, 1); g.fillTriangle(0, -5, -9, 11, 9, 11); g.strokeTriangle(0, -5, -9, 11, 9, 11); head(0, -8, 3.6);
    g.lineStyle(2, 0x6f452c, 1); g.lineBetween(8, -5, 8, 10);
    g.fillStyle(0xffc34d, 0.95); g.fillCircle(8, -8, 4); g.fillStyle(0xff6b35, 1); g.fillCircle(8, -9, 2);
  } else if (tier === HandRank.Straight) {
    body(12, 11); head(-3, -8, 3.5);
    g.fillStyle(0x27334c, 1); g.fillRoundedRect(-7, -12, 9, 3, 1);
    g.lineStyle(3, 0x9eb6d8, 1); g.lineBetween(-1, -2, 14, 2);
    g.lineStyle(1, light, 1); g.lineBetween(6, 0, 6, 5);
  } else if (tier === HandRank.Flush) {
    g.fillStyle(color, 1); g.fillTriangle(0, -5, -10, 11, 10, 11); g.strokeTriangle(0, -5, -10, 11, 10, 11); head(0, -8, 3.6);
    g.lineStyle(1.5, 0xdffbff, 1);
    for (let i = 0; i < 3; i++) {
      const a = (Math.PI * i) / 3;
      g.lineBetween(8 - Math.cos(a) * 5, -5 - Math.sin(a) * 5, 8 + Math.cos(a) * 5, -5 + Math.sin(a) * 5);
    }
    g.fillStyle(0xdffbff, 0.8); g.fillCircle(8, -5, 2);
  } else if (tier === HandRank.FullHouse) {
    body(14, 15); head(0, -8, 4);
    g.fillStyle(0xe6c84f, 1); g.fillTriangle(-5, -13, 0, -17, 5, -13); g.strokeTriangle(-5, -13, 0, -17, 5, -13);
    g.fillStyle(0xf5e6a8, 1); g.fillRoundedRect(-10, 0, 9, 11, 3); g.strokeRoundedRect(-10, 0, 9, 11, 3);
    g.lineStyle(2, 0x7c6020, 1); g.lineBetween(-5.5, 2, -5.5, 9); g.lineBetween(-9, 5.5, -2, 5.5);
  } else if (tier === HandRank.FourKind) {
    g.fillStyle(0x8f3737, 1); g.fillTriangle(-2, -3, -16, -9, -10, 8); g.fillTriangle(2, -3, 16, -9, 10, 8);
    body(14, 14); head(0, -8, 4);
    g.fillStyle(0xf0d8b0, 1); g.fillTriangle(-4, -11, -8, -17, -1, -13); g.fillTriangle(4, -11, 8, -17, 1, -13);
    g.lineStyle(2, 0xffb35a, 1); g.lineBetween(5, 2, 14, 0); g.fillStyle(0xff6a3d, 1); g.fillTriangle(17, 0, 12, -3, 12, 3);
  } else if (tier === HandRank.StraightFlush) {
    g.fillStyle(color, 1); g.fillTriangle(0, -7, -11, 12, 11, 12); g.strokeTriangle(0, -7, -11, 12, 11, 12); head(0, -10, 3.5);
    g.lineStyle(1.5, 0xd7c7ff, 0.9); g.strokeEllipse(0, -1, 28, 11); g.strokeEllipse(0, -1, 12, 28);
    g.fillStyle(0xf3e8ff, 1); g.fillCircle(12, -2, 2.5); g.fillCircle(-3, 11, 2);
  } else if (tier === HandRank.RoyalFlush) {
    g.fillStyle(0xf2f0e4, 0.95); g.fillTriangle(-2, -3, -18, -11, -10, 9); g.fillTriangle(2, -3, 18, -11, 10, 9);
    g.fillStyle(0xd9cf9a, 1); g.fillEllipse(0, 1, 18, 20); g.strokeEllipse(0, 1, 18, 20);
    g.fillStyle(0xf2f0e4, 1); g.fillCircle(0, -9, 5); g.strokeCircle(0, -9, 5);
    g.fillTriangle(-4, -12, -8, -17, -1, -14); g.fillTriangle(4, -12, 8, -17, 1, -14);
    g.fillStyle(0xe6c84f, 1); g.fillCircle(-2, -10, 1); g.fillCircle(2, -10, 1);
  } else if (tier === HandRank.FiveKind) {
    body(15, 15); head(0, -9, 4);
    g.lineStyle(2, 0xffd09b, 1);
    for (let i = -2; i <= 2; i++) g.lineBetween(i * 4, -2, i * 4, 11);
    g.fillStyle(0xff9b54, 1); g.fillCircle(0, -15, 3);
  } else if (tier === HandRank.FlushHouse) {
    body(16, 16); head(0, -9, 4);
    g.lineStyle(2, 0x72e0b8, 1); g.strokeCircle(0, 2, 14); g.strokeCircle(0, 2, 9);
    g.fillStyle(0xe6c84f, 1); g.fillTriangle(-6, -13, 0, -18, 6, -13);
  } else {
    g.fillStyle(0xffe27a, 0.95);
    for (let i = 0; i < 8; i++) {
      const a = (Math.PI * i) / 4;
      g.fillTriangle(0, 0, Math.cos(a - 0.18) * 18, Math.sin(a - 0.18) * 18, Math.cos(a + 0.18) * 18, Math.sin(a + 0.18) * 18);
    }
    g.fillStyle(0xffffff, 1); g.fillCircle(0, 0, 6);
    g.lineStyle(1.5, 0xff9b54, 1); g.strokeCircle(0, 0, 13);
  }
  return g;
}

function enemyArt(
  scene: Phaser.Scene,
  kind: EnemyKindId,
  radius: number,
  color: number,
  round: number,
): Phaser.GameObjects.Container {
  const shadow = scene.add.ellipse(2, 4, radius * 2.2, radius * 1.45, 0x000000, 0.38);
  const aura = scene.add.circle(0, 0, radius + 3, color, kind === 'boss' ? 0.2 : 0.1)
    .setStrokeStyle(kind === 'boss' ? 2 : 1, color, 0.55);
  if (kind === 'boss') {
    const key = bossSpriteKey(round);
    if (scene.textures.exists(key)) {
      const image = scene.add.image(0, -2, key);
      const extent = bossSpriteExtent(round);
      const scale = Math.min(extent / image.width, extent / image.height);
      image.setDisplaySize(image.width * scale, image.height * scale);
      return scene.add.container(0, 0, [shadow, aura, image]).setDepth(3);
    }
  }
  let body: Phaser.GameObjects.Shape;
  if (kind === 'fast') {
    body = scene.add.triangle(0, 0, 0, -radius, radius, radius, -radius, radius, color, 1);
  } else if (kind === 'tank') {
    body = scene.add.rectangle(0, 0, radius * 1.65, radius * 1.65, color, 1).setRotation(Math.PI / 4);
  } else if (kind === 'splitter') {
    body = scene.add.polygon(0, 0, [0, -radius, radius, 0, 0, radius, -radius, 0], color, 1);
  } else if (kind === 'boss') {
    const points: number[] = [];
    for (let i = 0; i < 12; i++) {
      const angle = -Math.PI / 2 + (Math.PI * i) / 6;
      const r = i % 2 === 0 ? radius : radius * 0.72;
      points.push(Math.cos(angle) * r, Math.sin(angle) * r);
    }
    body = scene.add.polygon(0, 0, points, color, 1);
  } else {
    body = scene.add.circle(0, 0, radius, color, 1);
  }
  body.setStrokeStyle(kind === 'boss' ? 2 : 1, 0xf8e9c2, kind === 'boss' ? 0.7 : 0.28);
  const marks: Record<EnemyKindId, string> = {
    normal: '•', fast: '›', tank: '◆', regen: '+', splitter: '✦', boss: '♛',
  };
  const emblem = scene.add.text(0, kind === 'fast' ? 2 : 0, marks[kind], {
    fontFamily: FONT,
    fontSize: `${kind === 'boss' ? 15 : Math.max(9, radius)}px`,
    fontStyle: 'bold',
    color: kind === 'boss' ? '#f7d95a' : '#f4eee4',
  }).setOrigin(0.5);
  return scene.add.container(0, 0, [shadow, aura, body, emblem]).setDepth(3);
}

export class FieldRenderer {
  private scene: Phaser.Scene;
  private highlightG: Phaser.GameObjects.Graphics;
  private rangeG: Phaser.GameObjects.Graphics;
  private fxG: Phaser.GameObjects.Graphics;
  private bossAbilityG: Phaser.GameObjects.Graphics;
  private placementHint: Phaser.GameObjects.Text;
  private enemyViews = new Map<number, EnemyView>();
  private unitViews = new Map<number, UnitView>();

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.drawStatic();
    this.highlightG = scene.add.graphics().setDepth(1);
    this.rangeG = scene.add.graphics().setDepth(1);
    this.fxG = scene.add.graphics().setDepth(4);
    this.bossAbilityG = scene.add.graphics().setDepth(4);
    this.placementHint = scene.add.text(381, 76, '◆ 금색 점선이 추천 위치입니다', {
      fontFamily: FONT,
      fontSize: '11px',
      fontStyle: 'bold',
      color: UI.gold,
      backgroundColor: '#0d0d13e8',
      padding: { x: 10, y: 5 },
    }).setOrigin(0.5).setDepth(6).setVisible(false);
  }

  private drawStatic(): void {
    const g = this.scene.add.graphics().setDepth(0);
    g.fillStyle(0x000000, 0.48);
    g.fillRect(FIELD_X - 2, FIELD_Y - 2, GRID_W * TILE + 4, GRID_H * TILE + 4);
    g.fillStyle(UI.gridLine, 1);
    g.fillRect(FIELD_X - 1, FIELD_Y - 1, GRID_W * TILE + 2, GRID_H * TILE + 2);
    for (let x = 0; x < GRID_W; x++) {
      for (let y = 0; y < GRID_H; y++) {
        const sx = FIELD_X + x * TILE;
        const sy = FIELD_Y + y * TILE;
        const path = isPathTile(x, y);
        const color = path ? UI.pathTile : UI.fieldTile;
        g.fillStyle(color, 1);
        g.fillRect(sx + 1, sy + 1, TILE - 3, TILE - 3);
      }
    }
    // 경로 방향을 암시하는 작은 금빛 마커
    g.fillStyle(UI.goldNum, 0.14);
    for (let x = 3; x <= 13; x += 3) {
      const cx = FIELD_X + x * TILE + TILE / 2;
      const cy = FIELD_Y + TILE + TILE / 2;
      g.fillTriangle(cx - 3, cy - 4, cx + 4, cy, cx - 3, cy + 4);
    }
    g.lineStyle(1, UI.goldNum, 0.1);
    g.strokeRect(FIELD_X - 2, FIELD_Y - 2, GRID_W * TILE + 3, GRID_H * TILE + 3);
    // 스폰 지점 표시
    const s = tileCenter(1, 1);
    g.fillStyle(UI.danger, 0.18);
    g.fillCircle(FIELD_X + s.x, FIELD_Y + s.y, 12);
    g.lineStyle(1.5, UI.danger, 0.95).strokeCircle(FIELD_X + s.x, FIELD_Y + s.y, 12);
    g.fillStyle(UI.danger, 0.95);
    g.fillTriangle(
      FIELD_X + s.x - 5, FIELD_Y + s.y - 6,
      FIELD_X + s.x - 5, FIELD_Y + s.y + 6,
      FIELD_X + s.x + 7, FIELD_Y + s.y,
    );
    this.scene.add.text(FIELD_X + (GRID_W * TILE) / 2, FIELD_Y + (GRID_H * TILE) / 2, 'ROYAL TABLE', {
      fontFamily: FONT_DISPLAY, fontSize: '42px', fontStyle: 'bold', color: UI.gold,
    }).setOrigin(0.5).setAlpha(0.05).setDepth(0);
  }

  /** 매 프레임 호출: core 상태를 화면에 반영 */
  update(game: Game, selectedUnitId: number | null, placingTier: HandRank | null, fx: Fx[], dt: number): void {
    this.updateUnits(game, selectedUnitId, fx);
    this.updateEnemies(game);
    this.drawBossAbilities(game);
    this.updateHighlight(game, placingTier);
    this.updateRange(game, selectedUnitId, placingTier);
    this.updateFx(fx, dt);
  }

  private updateUnits(game: Game, selectedUnitId: number | null, fx: readonly Fx[]): void {
    const liveIds = new Set<number>();
    for (const u of game.field.units) {
      liveIds.add(u.id);
      let view = this.unitViews.get(u.id);
      if (!view) {
        const def = UNIT_DEFS[u.tier];
        const shadow = this.scene.add.ellipse(2, 5, 32, 20, 0x000000, 0.42);
        const selection = this.scene.add.circle(0, 0, 20, 0xe6c84f, 0.05)
          .setStrokeStyle(2, 0xe6c84f, 0.95).setVisible(false);
        const halo = this.scene.add.circle(0, 0, 17, def.color, 0.24)
          .setStrokeStyle(1, def.color, 0.75);
        const art = unitVisual(this.scene, u.tier, def.color);
        const identity = this.scene.add.text(13, 13, u.suit ? `${SUIT_GLYPHS[u.suit]}${u.variant ? '✦' : ''}` : '', {
          fontFamily: FONT,
          fontSize: '10px',
          fontStyle: 'bold',
          color: u.variant ? '#ffe27a' : '#f4eee4',
          backgroundColor: '#07130cdd',
          padding: { x: 2, y: 1 },
        }).setOrigin(0.5);
        const root = this.scene.add.container(0, 0, [shadow, selection, halo, art, identity]).setDepth(2);
        view = { root, selection, halo, introStartedAt: this.scene.time.now };
        this.unitViews.set(u.id, view);
      }
      const p = unitPos(u);
      const selected = u.id === selectedUnitId;
      const attackFx = fx.find((effect) => effect.kind === 'attack' && effect.unitId === u.id);
      const recoil = attackFx ? Math.max(0, attackFx.ttl / attackFx.duration) : 0;
      const attackLength = attackFx ? Math.max(1, Math.hypot(attackFx.x2 - attackFx.x1, attackFx.y2 - attackFx.y1)) : 1;
      const recoilX = attackFx ? -((attackFx.x2 - attackFx.x1) / attackLength) * recoil * 2.5 : 0;
      const recoilY = attackFx ? -((attackFx.y2 - attackFx.y1) / attackLength) * recoil * 2.5 : 0;
      const bob = Math.sin(game.field.time * 2.4 + u.id * 0.7) * 0.8;
      const introDuration = unitIntroDuration(u.tier);
      const introProgress = introDuration === 0
        ? 1
        : Math.min(1, (this.scene.time.now - view.introStartedAt) / introDuration);
      const introScale = introDuration === 0 ? 1 : Phaser.Math.Easing.Back.Out(introProgress);
      view.root.setPosition(FIELD_X + p.x + recoilX, FIELD_Y + p.y + bob + recoilY);
      view.root.setScale((selected ? 1.12 : 1) * (1 + recoil * 0.06) * introScale);
      view.root.setAlpha(introDuration === 0 ? 1 : 0.5 + introProgress * 0.5);
      view.halo.setScale(introDuration === 0 ? 1 : 1 + (1 - introProgress) * 0.75);
      view.selection.setVisible(selected);
    }
    for (const [id, view] of this.unitViews) {
      if (!liveIds.has(id)) {
        view.root.destroy();
        this.unitViews.delete(id);
      }
    }
  }

  private updateEnemies(game: Game): void {
    const liveIds = new Set<number>();
    for (const e of game.field.enemies) {
      if (!e.alive) continue;
      liveIds.add(e.id);
      let view = this.enemyViews.get(e.id);
      if (!view) {
        const def = ENEMY_KINDS[e.kind];
        const r = ENEMY_RADIUS[e.kind];
        const root = enemyArt(this.scene, e.kind, r, def.color, e.round);
        const barWidth = e.kind === 'boss' ? 50 : 24;
        const hpBg = this.scene.add.rectangle(0, 0, barWidth, e.kind === 'boss' ? 5 : 3, 0x000000, 0.78).setDepth(3);
        const hpFg = this.scene.add.rectangle(0, 0, barWidth, e.kind === 'boss' ? 5 : 3, 0x76d67a).setDepth(3);
        const introRing = e.kind === 'boss'
          ? this.scene.add.circle(0, 0, r + 10, def.color, 0.05).setStrokeStyle(3, 0xe6c84f, 0.9)
          : null;
        if (introRing) root.addAt(introRing, 1);
        view = { root, hpBg, hpFg, barWidth, introStartedAt: this.scene.time.now, introRing };
        this.enemyViews.set(e.id, view);
      }
      const p = enemyPos(e);
      const sx = FIELD_X + p.x;
      const sy = FIELD_Y + p.y;
      const r = ENEMY_RADIUS[e.kind];
      const ratio = Math.max(0, e.hp / e.maxHp);
      view.root.setPosition(sx, sy);
      if (e.kind === 'boss') {
        const intro = Math.min(1, (this.scene.time.now - view.introStartedAt) / bossIntroDuration(e.round));
        const entranceScale = intro < 1 ? Phaser.Math.Easing.Back.Out(intro) : 1;
        const enraged = e.round >= 60 && ratio <= 0.5;
        const pulse = enraged
          ? 1 + Math.sin(game.field.time * 11) * 0.085
          : 1 + Math.sin(game.field.time * 5) * 0.045;
        view.root.setScale(entranceScale * pulse);
        if (enraged) {
          view.introRing?.setScale(1.35 + Math.sin(game.field.time * 8) * 0.12).setAlpha(0.58);
        } else {
          view.introRing?.setScale(1 + intro * 1.4).setAlpha(Math.max(0, 1 - intro));
        }
      } else {
        view.root.setScale(1);
      }
      view.root.setAlpha(game.field.time < e.stunUntil ? 0.62 : 1);
      const barY = sy - (e.kind === 'boss' ? bossSpriteExtent(e.round) / 2 + 6 : r + 6);
      view.hpBg.setPosition(sx, barY);
      view.hpFg.setPosition(sx - view.barWidth / 2 + (view.barWidth * ratio) / 2, barY);
      view.hpFg.width = view.barWidth * ratio;
      view.hpFg.setFillStyle(ratio > 0.5 ? 0x76d67a : ratio > 0.25 ? 0xe0a33c : 0xd06258);
      const showHp = e.kind === 'boss' || ratio < 0.995;
      view.hpBg.setVisible(showHp);
      view.hpFg.setVisible(showHp);
    }
    for (const [id, view] of this.enemyViews) {
      if (!liveIds.has(id)) {
        view.root.destroy();
        view.hpBg.destroy();
        view.hpFg.destroy();
        this.enemyViews.delete(id);
      }
    }
  }

  private drawBossAbilities(game: Game): void {
    this.bossAbilityG.clear();
    const t = game.field.time;
    for (const enemy of game.field.enemies) {
      if (!enemy.alive || enemy.kind !== 'boss') continue;
      const p = enemyPos(enemy);
      const x = FIELD_X + p.x;
      const y = FIELD_Y + p.y;
      if (enemy.round === 10) {
        const pulse = 0.45 + Math.sin(t * 4) * 0.12;
        this.bossAbilityG.lineStyle(2, 0xa9c4dd, pulse);
        this.bossAbilityG.strokeCircle(x, y, 31);
        for (let i = 0; i < 4; i++) {
          const angle = t * 0.35 + i * Math.PI / 2;
          this.bossAbilityG.fillStyle(0xd9e8f4, 0.5);
          this.bossAbilityG.fillRect(x + Math.cos(angle) * 31 - 2, y + Math.sin(angle) * 31 - 3, 4, 6);
        }
      } else if (enemy.round === 20) {
        for (let i = 0; i < 3; i++) {
          const rise = (t * 16 + i * 12) % 34;
          this.bossAbilityG.fillStyle(0xff526e, 0.18 + (1 - rise / 34) * 0.42);
          this.bossAbilityG.fillCircle(x - 10 + i * 10, y + 17 - rise, 2.2);
        }
      } else if (enemy.round === 30) {
        this.bossAbilityG.lineStyle(2, 0x66b8ff, 0.45);
        for (let i = 0; i < 3; i++) {
          const offset = 22 + i * 8 + ((t * 28) % 8);
          this.bossAbilityG.lineBetween(x - offset, y - 7, x - offset + 7, y);
          this.bossAbilityG.lineBetween(x - offset + 7, y, x - offset, y + 7);
        }
      } else if (enemy.round === 40 || enemy.round === 50) {
        const countdown = game.bossAbilityCountdown(enemy.round);
        if (countdown === null || countdown > 1.5) continue;
        const progress = 1 - countdown / 1.5;
        const color = enemy.round === 40 ? 0xffce4a : 0xa875ff;
        this.bossAbilityG.lineStyle(2.5, color, 0.45 + progress * 0.5);
        this.bossAbilityG.strokeCircle(x, y, 40 - progress * 16);
        if (enemy.round === 50) {
          for (const distance of [enemy.dist - 12, enemy.dist + 12]) {
            const portal = pointAt(distance);
            this.bossAbilityG.lineStyle(2, color, 0.35 + progress * 0.55);
            this.bossAbilityG.strokeEllipse(FIELD_X + portal.x, FIELD_Y + portal.y + 5, 18, 8);
          }
        }
      } else if (enemy.round >= 60 && enemy.hp / enemy.maxHp <= 0.5) {
        const radius = 35 + Math.sin(t * 10) * 4;
        this.bossAbilityG.lineStyle(2.5, 0xff4d82, 0.75);
        this.bossAbilityG.strokeCircle(x, y, radius);
        for (let i = 0; i < 8; i++) {
          const angle = i * Math.PI / 4 + t * 0.3;
          this.bossAbilityG.lineBetween(
            x + Math.cos(angle) * radius,
            y + Math.sin(angle) * radius,
            x + Math.cos(angle) * (radius + 8),
            y + Math.sin(angle) * (radius + 8),
          );
        }
      }
    }
  }

  private updateHighlight(game: Game, placingTier: HandRank | null): void {
    this.highlightG.clear();
    this.placementHint.setVisible(placingTier !== null);
    if (placingTier === null) return;
    const range = UNIT_DEFS[placingTier].range;
    const recommended = new Set(
      recommendedPlacementTiles(
        range,
        game.field.units.map((unit) => ({ x: unit.tx, y: unit.ty })),
      ).map((point) => `${point.x},${point.y}`),
    );
    for (let x = 0; x < GRID_W; x++) {
      for (let y = 0; y < GRID_H; y++) {
        if (isPlaceable(x, y) && !game.unitAt(x, y)) {
          const sx = FIELD_X + x * TILE;
          const sy = FIELD_Y + y * TILE;
          if (recommended.has(`${x},${y}`)) {
            this.highlightG.fillStyle(UI.goldNum, 0.08);
            this.highlightG.fillRect(sx + 2, sy + 2, TILE - 5, TILE - 5);
            this.highlightG.lineStyle(1.5, UI.goldNum, 0.55);
            const edge = TILE - 8;
            for (let offset = 0; offset < edge; offset += 8) {
              this.highlightG.lineBetween(sx + 4 + offset, sy + 4, sx + Math.min(10 + offset, edge + 4), sy + 4);
              this.highlightG.lineBetween(sx + 4 + offset, sy + TILE - 4, sx + Math.min(10 + offset, edge + 4), sy + TILE - 4);
              this.highlightG.lineBetween(sx + 4, sy + 4 + offset, sx + 4, sy + Math.min(10 + offset, edge + 4));
              this.highlightG.lineBetween(sx + TILE - 4, sy + 4 + offset, sx + TILE - 4, sy + Math.min(10 + offset, edge + 4));
            }
            this.highlightG.fillStyle(UI.goldNum, 0.9);
            this.highlightG.fillCircle(sx + TILE / 2, sy + TILE / 2, 4);
          }
        }
      }
    }
  }

  private updateRange(game: Game, selectedUnitId: number | null, placingTier: HandRank | null): void {
    this.rangeG.clear();
    if (placingTier !== null) {
      const pointer = this.scene.input.activePointer;
      const tile = tileAtScreen(pointer.x, pointer.y);
      if (tile && isPlaceable(tile.tx, tile.ty) && !game.unitAt(tile.tx, tile.ty)) {
        const p = tileCenter(tile.tx, tile.ty);
        const def = UNIT_DEFS[placingTier];
        const canReach = tileCanReachPath(tile.tx, tile.ty, def.range);
        const color = canReach ? UI.goldNum : UI.danger;
        this.rangeG.fillStyle(color, 0.05);
        this.rangeG.fillCircle(FIELD_X + p.x, FIELD_Y + p.y, 5);
        this.rangeG.lineStyle(1, color, 0.3);
        this.rangeG.strokeCircle(FIELD_X + p.x, FIELD_Y + p.y, def.range * TILE);
      }
      return;
    }
    if (selectedUnitId === null) return;
    const unit = game.field.units.find((u) => u.id === selectedUnitId);
    if (!unit) return;
    const p = unitPos(unit);
    const def = UNIT_DEFS[unit.tier];
    this.rangeG.fillStyle(UI.goldNum, 0.03);
    this.rangeG.fillCircle(FIELD_X + p.x, FIELD_Y + p.y, def.range * TILE);
    this.rangeG.lineStyle(1, UI.goldNum, 0.18);
    this.rangeG.strokeCircle(FIELD_X + p.x, FIELD_Y + p.y, def.range * TILE);
  }

  private updateFx(fx: Fx[], dt: number): void {
    this.fxG.clear();
    for (let i = fx.length - 1; i >= 0; i--) {
      const f = fx[i];
      f.ttl -= dt;
      if (f.ttl <= 0) {
        fx.splice(i, 1);
        continue;
      }
      this.drawFx(f);
    }
  }

  private drawFx(f: Fx): void {
    const fade = Math.max(0, Math.min(1, f.ttl / f.duration));
    const progress = 1 - fade;
    const x1 = FIELD_X + f.x1;
    const y1 = FIELD_Y + f.y1;
    const x2 = FIELD_X + f.x2;
    const y2 = FIELD_Y + f.y2;
    const px = Phaser.Math.Linear(x1, x2, Math.min(1, progress * 1.45));
    const py = Phaser.Math.Linear(y1, y2, Math.min(1, progress * 1.45));
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.max(1, Math.hypot(dx, dy));
    const nx = dx / len;
    const ny = dy / len;
    const ox = -ny;
    const oy = nx;

    if (f.kind === 'bossAbility') {
      const color = f.bossAbility === 'tax' ? 0xffce4a : 0xa875ff;
      const radius = f.bossAbility === 'tax' ? 34 - progress * 18 : 10 + progress * 34;
      this.fxG.lineStyle(f.bossAbility === 'tax' ? 4 : 3, color, fade);
      this.fxG.strokeCircle(x2, y2, radius);
      this.fxG.lineStyle(2, 0xffffff, fade * 0.8);
      this.fxG.strokeCircle(x2, y2, Math.max(4, radius * 0.58));
      return;
    }

    if (f.kind === 'death') {
      const particleCount = f.targetKind === 'boss' ? 16 : f.targetKind === 'tank' ? 9 : 6;
      const spread = f.targetKind === 'boss' ? 38 : 20;
      this.fxG.lineStyle(f.targetKind === 'boss' ? 3 : 1.5, f.color, fade * 0.8);
      this.fxG.strokeCircle(x2, y2, 5 + progress * spread * 0.7);
      for (let i = 0; i < particleCount; i++) {
        const angle = ((i / particleCount) * Math.PI * 2) + ((f.seed % 17) / 17) * Math.PI;
        const variance = 0.65 + (((f.seed + i * 23) % 37) / 37) * 0.5;
        const distance = progress * spread * variance;
        const particleX = x2 + Math.cos(angle) * distance;
        const particleY = y2 + Math.sin(angle) * distance + progress * progress * 7;
        this.fxG.fillStyle(i % 3 === 0 ? 0xf3ead4 : f.color, fade);
        this.fxG.fillCircle(particleX, particleY, f.targetKind === 'boss' ? 2.8 : 1.8);
      }
      return;
    }

    if (f.tier === HandRank.Pair || f.tier === HandRank.TwoPair) {
      const offsets = f.tier === HandRank.TwoPair ? [-3, 3] : [0];
      for (const offset of offsets) {
        const ax = px + ox * offset;
        const ay = py + oy * offset;
        this.fxG.lineStyle(1.7, f.color, fade);
        this.fxG.lineBetween(ax - nx * 9, ay - ny * 9, ax + nx * 4, ay + ny * 4);
        this.fxG.fillStyle(0xf4ead4, fade);
        this.fxG.fillTriangle(
          ax + nx * 7, ay + ny * 7,
          ax + nx * 2 + ox * 3, ay + ny * 2 + oy * 3,
          ax + nx * 2 - ox * 3, ay + ny * 2 - oy * 3,
        );
      }
    } else if (f.tier === HandRank.Trips || f.tier === HandRank.FourKind) {
      const radius = f.tier === HandRank.FourKind ? 7 : 5;
      this.fxG.fillStyle(f.color, 0.2 * fade); this.fxG.fillCircle(px, py, radius + 6);
      this.fxG.fillStyle(0xffd45e, fade); this.fxG.fillCircle(px, py, radius);
      this.fxG.fillStyle(0xff6b35, fade); this.fxG.fillCircle(px - nx * 2, py - ny * 2, radius * 0.55);
      if (progress > 0.68) {
        this.fxG.lineStyle(2, f.color, fade); this.fxG.strokeCircle(x2, y2, radius + progress * 12);
      }
    } else if (f.tier === HandRank.Straight) {
      this.fxG.lineStyle(5, f.color, 0.12 * fade); this.fxG.lineBetween(x1, y1, x2, y2);
      this.fxG.lineStyle(1.4, 0xe8f3ff, fade); this.fxG.lineBetween(x1, y1, x2, y2);
      this.fxG.fillStyle(0xffffff, fade); this.fxG.fillCircle(x2, y2, 3);
    } else if (f.tier === HandRank.Flush) {
      this.fxG.fillStyle(0xdffbff, fade);
      this.fxG.fillTriangle(px + nx * 7, py + ny * 7, px - nx * 5 + ox * 3, py - ny * 5 + oy * 3, px - nx * 5 - ox * 3, py - ny * 5 - oy * 3);
      this.fxG.lineStyle(1, f.color, fade); this.fxG.strokeCircle(x2, y2, 4 + progress * 7);
    } else if (f.tier === HandRank.FullHouse) {
      this.fxG.lineStyle(4, 0xe6c84f, 0.18 * fade); this.fxG.lineBetween(x1, y1, px, py);
      this.fxG.fillStyle(0xf5e6a8, fade); this.fxG.fillRoundedRect(px - 4, py - 4, 8, 8, 2);
      this.fxG.lineStyle(1.5, 0xe6c84f, fade); this.fxG.strokeCircle(x2, y2, 5 + progress * 6);
    } else if (f.tier === HandRank.StraightFlush) {
      const segments = 7;
      let lastX = x1;
      let lastY = y1;
      this.fxG.lineStyle(2, 0xdcc9ff, fade);
      for (let i = 1; i <= segments; i++) {
        const t = i / segments;
        const jitter = i === segments ? 0 : Math.sin((i * 17 + f.ttl * 90)) * 5;
        const zx = Phaser.Math.Linear(x1, x2, t) + ox * jitter;
        const zy = Phaser.Math.Linear(y1, y2, t) + oy * jitter;
        this.fxG.lineBetween(lastX, lastY, zx, zy);
        lastX = zx; lastY = zy;
      }
      this.fxG.fillStyle(0xffffff, fade); this.fxG.fillCircle(x2, y2, 4);
    } else if (f.tier === HandRank.RoyalFlush) {
      this.fxG.lineStyle(10, 0xe6c84f, 0.1 * fade); this.fxG.lineBetween(x1, y1, x2, y2);
      this.fxG.lineStyle(4, 0xf8f4df, 0.75 * fade); this.fxG.lineBetween(x1, y1, x2, y2);
      this.fxG.lineStyle(2, 0xe6c84f, fade); this.fxG.strokeCircle(x2, y2, 8 + progress * 15);
    } else if (f.tier >= HandRank.FiveKind) {
      const rays = f.tier === HandRank.FlushFive ? 8 : 5;
      this.fxG.lineStyle(f.tier === HandRank.FlushFive ? 4 : 2, f.color, 0.7 * fade);
      for (let i = 0; i < rays; i++) {
        const offset = (i - (rays - 1) / 2) * 2.2;
        this.fxG.lineBetween(x1 + ox * offset, y1 + oy * offset, x2 + ox * offset, y2 + oy * offset);
      }
      this.fxG.lineStyle(2, 0xffffff, fade); this.fxG.strokeCircle(x2, y2, 6 + progress * 18);
    } else {
      this.fxG.lineStyle(3, f.color, fade); this.fxG.lineBetween(px - nx * 8, py - ny * 8, px, py);
      this.fxG.fillStyle(0xf4ead4, fade); this.fxG.fillCircle(px, py, 3);
    }

    if (progress > 0.5) {
      const impact = Math.max(0, 1 - Math.abs(progress - 0.76) * 3.9);
      const highTier = f.tier >= HandRank.FullHouse;
      const sparkCount = highTier ? 6 : 4;
      const baseRadius = highTier ? 7 : 5;
      this.fxG.fillStyle(0xf8f4df, impact * 0.82);
      this.fxG.fillCircle(x2, y2, 2.4 + impact * (highTier ? 3.2 : 2));
      this.fxG.lineStyle(highTier ? 2 : 1.4, f.color, impact * 0.95);
      this.fxG.strokeCircle(x2, y2, baseRadius + impact * (highTier ? 10 : 7));
      for (let i = 0; i < sparkCount; i++) {
        const angle = ((Math.PI * 2) / sparkCount) * i + (f.seed % 11) * 0.09;
        const inner = baseRadius + impact * 3;
        const outer = inner + impact * (highTier ? 8 : 5);
        this.fxG.lineStyle(i % 2 === 0 ? 1.8 : 1.1, i % 2 === 0 ? 0xf8f4df : f.color, impact * 0.86);
        this.fxG.lineBetween(
          x2 + Math.cos(angle) * inner,
          y2 + Math.sin(angle) * inner,
          x2 + Math.cos(angle) * outer,
          y2 + Math.sin(angle) * outer,
        );
      }

      if (f.targetKind === 'boss') {
        this.fxG.lineStyle(2.2, 0xe6c84f, impact * 0.9);
        this.fxG.strokeCircle(x2, y2, 10 + impact * 13);
        if (f.targetRound === 10) {
          this.fxG.lineStyle(3, 0xbdd9ef, impact);
          this.fxG.strokeCircle(x2, y2, 15 + impact * 11);
        }
      }
    }
  }
}
