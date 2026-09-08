import type { Enemy } from '../core/combat';
import { TILE } from '../core/map';

/** Simulation time freezes the short flash while paused; initial snapshots never flash. */
export class SpawnPortalPulse {
  private initialized = false;
  private lastId = 0;
  private startedAt = -Infinity;

  update(enemies: readonly Pick<Enemy, 'id' | 'alive' | 'dist'>[], time: number, reducedMotion: boolean): number {
    let spawned = false;
    for (const enemy of enemies) {
      if (this.initialized && enemy.id > this.lastId && enemy.alive && enemy.dist < TILE) spawned = true;
    }
    for (const enemy of enemies) this.lastId = Math.max(this.lastId, enemy.id);
    this.initialized = true;
    if (reducedMotion) {
      this.startedAt = -Infinity;
      return 0;
    }
    if (spawned) this.startedAt = time;
    return Math.max(0, 1 - (time - this.startedAt) / 0.3);
  }
}
