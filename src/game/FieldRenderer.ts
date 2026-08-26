import Phaser from 'phaser';
import { Game } from '../core/game';
import { HandRank } from '../core/cards/types';
import { enemyPos, unitPos } from '../core/combat';
import { UNIT_DEFS } from '../core/units';
import { ENEMY_KINDS, EnemyKindId } from '../core/enemies';
import { GRID_W, GRID_H, TILE, isPathTile, isPlaceable, tileCanReachPath, tileCenter } from '../core/map';
import { UI, FONT } from './ui';

export const FIELD_X = 16;
export const FIELD_Y = 16;

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
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  ttl: number;
  color: number;
}

const ENEMY_RADIUS: Record<EnemyKindId, number> = {
  normal: 9, fast: 7, tank: 11, regen: 9, splitter: 10, boss: 17,
};

interface EnemyView {
  root: Phaser.GameObjects.Container;
  hpBg: Phaser.GameObjects.Rectangle;
  hpFg: Phaser.GameObjects.Rectangle;
  barWidth: number;
}

interface UnitView {
  root: Phaser.GameObjects.Container;
  selection: Phaser.GameObjects.Arc;
}

function enemyArt(scene: Phaser.Scene, kind: EnemyKindId, radius: number, color: number): Phaser.GameObjects.Container {
  const shadow = scene.add.ellipse(2, 4, radius * 2.2, radius * 1.45, 0x000000, 0.38);
  const aura = scene.add.circle(0, 0, radius + 3, color, kind === 'boss' ? 0.2 : 0.1)
    .setStrokeStyle(kind === 'boss' ? 2 : 1, color, 0.55);
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
  private placementHint: Phaser.GameObjects.Text;
  private enemyViews = new Map<number, EnemyView>();
  private unitViews = new Map<number, UnitView>();

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.drawStatic();
    this.highlightG = scene.add.graphics().setDepth(1);
    this.rangeG = scene.add.graphics().setDepth(1);
    this.fxG = scene.add.graphics().setDepth(4);
    this.placementHint = scene.add.text(390, 29, '초록: 공격 가능  ·  붉은색: 경로가 사거리 밖', {
      fontFamily: FONT,
      fontSize: '12px',
      fontStyle: 'bold',
      color: '#e6ebe5',
      backgroundColor: '#07130cdd',
      padding: { x: 10, y: 5 },
    }).setOrigin(0.5).setDepth(6).setVisible(false);
  }

  private drawStatic(): void {
    const g = this.scene.add.graphics().setDepth(0);
    g.fillStyle(0x000000, 0.32);
    g.fillRoundedRect(FIELD_X - 4, FIELD_Y - 2, GRID_W * TILE + 8, GRID_H * TILE + 8, 8);
    g.fillGradientStyle(0x10261a, 0x10261a, 0x08130d, 0x08130d, 1);
    g.fillRoundedRect(FIELD_X - 1, FIELD_Y - 1, GRID_W * TILE + 2, GRID_H * TILE + 2, 6);
    for (let x = 0; x < GRID_W; x++) {
      for (let y = 0; y < GRID_H; y++) {
        const sx = FIELD_X + x * TILE;
        const sy = FIELD_Y + y * TILE;
        const path = isPathTile(x, y);
        const color = path ? UI.pathTile : UI.fieldTile;
        g.fillStyle(color, 1);
        g.fillRoundedRect(sx + 1, sy + 1, TILE - 3, TILE - 3, path ? 5 : 3);
        g.fillStyle(path ? 0x6d8a72 : 0x5cb187, path ? 0.055 : ((x + y) % 2 ? 0.025 : 0.045));
        g.fillRoundedRect(sx + 3, sy + 3, TILE - 7, TILE - 7, 3);
        if (path) {
          g.lineStyle(1, 0x8eaf96, 0.08);
          g.strokeRoundedRect(sx + 2, sy + 2, TILE - 5, TILE - 5, 4);
        }
      }
    }
    // 경로 방향을 암시하는 작은 금빛 마커
    g.fillStyle(0xe6c84f, 0.2);
    for (let x = 3; x <= 13; x += 3) {
      const cx = FIELD_X + x * TILE + TILE / 2;
      const cy = FIELD_Y + TILE + TILE / 2;
      g.fillTriangle(cx - 3, cy - 4, cx + 4, cy, cx - 3, cy + 4);
    }
    g.lineStyle(2, UI.accent, 0.35);
    g.strokeRoundedRect(FIELD_X - 2, FIELD_Y - 2, GRID_W * TILE + 3, GRID_H * TILE + 3, 4);
    // 스폰 지점 표시
    const s = tileCenter(1, 1);
    g.fillStyle(UI.danger, 0.95);
    g.fillCircle(FIELD_X + s.x, FIELD_Y + s.y, 12);
    g.fillStyle(0x2a1010, 0.9);
    g.fillTriangle(
      FIELD_X + s.x - 5, FIELD_Y + s.y - 6,
      FIELD_X + s.x - 5, FIELD_Y + s.y + 6,
      FIELD_X + s.x + 7, FIELD_Y + s.y,
    );
    this.scene.add.text(390, 270, '♠   ROYAL TABLE   ♦', {
      fontFamily: FONT, fontSize: '28px', fontStyle: 'bold', color: '#5cb187',
    }).setOrigin(0.5).setAlpha(0.055).setDepth(0);
  }

  /** 매 프레임 호출: core 상태를 화면에 반영 */
  update(game: Game, selectedUnitId: number | null, placingTier: HandRank | null, fx: Fx[], dt: number): void {
    this.updateUnits(game, selectedUnitId);
    this.updateEnemies(game);
    this.updateHighlight(game, placingTier);
    this.updateRange(game, selectedUnitId, placingTier);
    this.updateFx(fx, dt);
  }

  private updateUnits(game: Game, selectedUnitId: number | null): void {
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
        const body = this.scene.add.circle(0, 0, 13, UI.panelDeep, 1).setStrokeStyle(2, def.color, 1);
        const core = this.scene.add.circle(0, 0, 10, def.color, 0.92);
        const glyph = this.scene.add
          .text(0, 0, def.glyph, {
            fontFamily: FONT, fontSize: '13px', color: '#0b140e', fontStyle: 'bold',
          })
          .setOrigin(0.5);
        const root = this.scene.add.container(0, 0, [shadow, selection, halo, body, core, glyph]).setDepth(2);
        view = { root, selection };
        this.unitViews.set(u.id, view);
      }
      const p = unitPos(u);
      const selected = u.id === selectedUnitId;
      view.root.setPosition(FIELD_X + p.x, FIELD_Y + p.y);
      view.root.setScale(selected ? 1.12 : 1);
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
        const root = enemyArt(this.scene, e.kind, r, def.color);
        const barWidth = e.kind === 'boss' ? 42 : 24;
        const hpBg = this.scene.add.rectangle(0, 0, barWidth, e.kind === 'boss' ? 5 : 3, 0x000000, 0.78).setDepth(3);
        const hpFg = this.scene.add.rectangle(0, 0, barWidth, e.kind === 'boss' ? 5 : 3, 0x76d67a).setDepth(3);
        view = { root, hpBg, hpFg, barWidth };
        this.enemyViews.set(e.id, view);
      }
      const p = enemyPos(e);
      const sx = FIELD_X + p.x;
      const sy = FIELD_Y + p.y;
      const r = ENEMY_RADIUS[e.kind];
      view.root.setPosition(sx, sy);
      view.root.setScale(e.kind === 'boss' ? 1 + Math.sin(game.field.time * 5) * 0.055 : 1);
      view.root.setAlpha(game.field.time < e.stunUntil ? 0.62 : 1);
      const ratio = Math.max(0, e.hp / e.maxHp);
      view.hpBg.setPosition(sx, sy - r - 6);
      view.hpFg.setPosition(sx - view.barWidth / 2 + (view.barWidth * ratio) / 2, sy - r - 6);
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

  private updateHighlight(game: Game, placingTier: HandRank | null): void {
    this.highlightG.clear();
    this.placementHint.setVisible(placingTier !== null);
    if (placingTier === null) return;
    const range = UNIT_DEFS[placingTier].range;
    for (let x = 0; x < GRID_W; x++) {
      for (let y = 0; y < GRID_H; y++) {
        if (isPlaceable(x, y) && !game.unitAt(x, y)) {
          const canReach = tileCanReachPath(x, y, range);
          this.highlightG.fillStyle(canReach ? UI.placeable : UI.danger, canReach ? 0.19 : 0.1);
          this.highlightG.fillRect(FIELD_X + x * TILE, FIELD_Y + y * TILE, TILE - 1, TILE - 1);
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
        const color = canReach ? UI.accent : UI.danger;
        this.rangeG.fillStyle(color, 0.22);
        this.rangeG.fillCircle(FIELD_X + p.x, FIELD_Y + p.y, 5);
        this.rangeG.lineStyle(2, color, 0.72);
        this.rangeG.strokeCircle(FIELD_X + p.x, FIELD_Y + p.y, def.range * TILE);
      }
      return;
    }
    if (selectedUnitId === null) return;
    const unit = game.field.units.find((u) => u.id === selectedUnitId);
    if (!unit) return;
    const p = unitPos(unit);
    const def = UNIT_DEFS[unit.tier];
    this.rangeG.lineStyle(1.5, UI.accent, 0.5);
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
      this.fxG.lineStyle(2, f.color, Math.min(1, f.ttl / 0.08));
      this.fxG.lineBetween(FIELD_X + f.x1, FIELD_Y + f.y1, FIELD_X + f.x2, FIELD_Y + f.y2);
      this.fxG.fillStyle(f.color, Math.min(0.9, f.ttl / 0.08));
      this.fxG.fillCircle(FIELD_X + f.x2, FIELD_Y + f.y2, 2 + 4 * (f.ttl / 0.08));
    }
  }
}
