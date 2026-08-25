import Phaser from 'phaser';
import { Game } from '../core/game';
import { enemyPos, unitPos } from '../core/combat';
import { UNIT_DEFS } from '../core/units';
import { ENEMY_KINDS, EnemyKindId } from '../core/enemies';
import { GRID_W, GRID_H, TILE, isPathTile, isPlaceable, tileCenter } from '../core/map';
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
  body: Phaser.GameObjects.Arc;
  hpBg: Phaser.GameObjects.Rectangle;
  hpFg: Phaser.GameObjects.Rectangle;
}

export class FieldRenderer {
  private scene: Phaser.Scene;
  private highlightG: Phaser.GameObjects.Graphics;
  private rangeG: Phaser.GameObjects.Graphics;
  private fxG: Phaser.GameObjects.Graphics;
  private enemyViews = new Map<number, EnemyView>();
  private unitViews = new Map<number, Phaser.GameObjects.Container>();

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.drawStatic();
    this.highlightG = scene.add.graphics().setDepth(1);
    this.rangeG = scene.add.graphics().setDepth(1);
    this.fxG = scene.add.graphics().setDepth(4);
  }

  private drawStatic(): void {
    const g = this.scene.add.graphics().setDepth(0);
    for (let x = 0; x < GRID_W; x++) {
      for (let y = 0; y < GRID_H; y++) {
        const color = isPathTile(x, y) ? UI.pathTile : UI.fieldTile;
        g.fillStyle(color, 1);
        g.fillRect(FIELD_X + x * TILE, FIELD_Y + y * TILE, TILE - 1, TILE - 1);
      }
    }
    // 스폰 지점 표시
    const s = tileCenter(1, 1);
    g.fillStyle(UI.danger, 0.9);
    g.fillTriangle(
      FIELD_X + s.x - 7, FIELD_Y + s.y - 7,
      FIELD_X + s.x - 7, FIELD_Y + s.y + 7,
      FIELD_X + s.x + 8, FIELD_Y + s.y,
    );
  }

  /** 매 프레임 호출: core 상태를 화면에 반영 */
  update(game: Game, selectedUnitId: number | null, placing: boolean, fx: Fx[], dt: number): void {
    this.updateUnits(game, selectedUnitId);
    this.updateEnemies(game);
    this.updateHighlight(game, placing);
    this.updateRange(game, selectedUnitId);
    this.updateFx(fx, dt);
  }

  private updateUnits(game: Game, selectedUnitId: number | null): void {
    const liveIds = new Set<number>();
    for (const u of game.field.units) {
      liveIds.add(u.id);
      let view = this.unitViews.get(u.id);
      if (!view) {
        const def = UNIT_DEFS[u.tier];
        const body = this.scene.add.circle(0, 0, 15, def.color);
        body.setStrokeStyle(2, 0x0d1a12, 1);
        const glyph = this.scene.add
          .text(0, 0, def.glyph, {
            fontFamily: FONT, fontSize: '15px', color: '#0d1a12', fontStyle: 'bold',
          })
          .setOrigin(0.5);
        view = this.scene.add.container(0, 0, [body, glyph]).setDepth(2);
        this.unitViews.set(u.id, view);
      }
      const p = unitPos(u);
      view.setPosition(FIELD_X + p.x, FIELD_Y + p.y);
      view.setScale(u.id === selectedUnitId ? 1.15 : 1);
    }
    for (const [id, view] of this.unitViews) {
      if (!liveIds.has(id)) {
        view.destroy();
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
        const body = this.scene.add.circle(0, 0, r, def.color).setDepth(3);
        body.setStrokeStyle(1, 0x000000, 0.5);
        const hpBg = this.scene.add.rectangle(0, 0, 22, 4, 0x000000, 0.7).setDepth(3);
        const hpFg = this.scene.add.rectangle(0, 0, 22, 4, 0x76d67a).setDepth(3);
        view = { body, hpBg, hpFg };
        this.enemyViews.set(e.id, view);
      }
      const p = enemyPos(e);
      const sx = FIELD_X + p.x;
      const sy = FIELD_Y + p.y;
      const r = ENEMY_RADIUS[e.kind];
      view.body.setPosition(sx, sy);
      const ratio = Math.max(0, e.hp / e.maxHp);
      view.hpBg.setPosition(sx, sy - r - 6);
      view.hpFg.setPosition(sx - 11 + 11 * ratio, sy - r - 6);
      view.hpFg.width = 22 * ratio;
      view.hpFg.setFillStyle(ratio > 0.5 ? 0x76d67a : ratio > 0.25 ? 0xe0a33c : 0xd06258);
    }
    for (const [id, view] of this.enemyViews) {
      if (!liveIds.has(id)) {
        view.body.destroy();
        view.hpBg.destroy();
        view.hpFg.destroy();
        this.enemyViews.delete(id);
      }
    }
  }

  private updateHighlight(game: Game, placing: boolean): void {
    this.highlightG.clear();
    if (!placing) return;
    this.highlightG.fillStyle(UI.placeable, 0.16);
    for (let x = 0; x < GRID_W; x++) {
      for (let y = 0; y < GRID_H; y++) {
        if (isPlaceable(x, y) && !game.unitAt(x, y)) {
          this.highlightG.fillRect(FIELD_X + x * TILE, FIELD_Y + y * TILE, TILE - 1, TILE - 1);
        }
      }
    }
  }

  private updateRange(game: Game, selectedUnitId: number | null): void {
    this.rangeG.clear();
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
    }
  }
}
