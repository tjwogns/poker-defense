import { layoutMode, type LayoutMode } from './device';
import { portraitLogicalHeight } from './layout';

export interface CanvasLayout { mode: LayoutMode; width: number; height: number }

export function viewportCanvasLayout(width: number, height: number, visibleHeight = height): CanvasLayout {
  const mode = layoutMode(width, height);
  return mode === 'portrait'
    ? { mode, width: 390, height: portraitLogicalHeight(width, visibleHeight) }
    : { mode, width: 1280, height: 720 };
}

/** Debounced menu-only work. Modal work stays intact; call flush after its close. */
export class MenuViewportRefresh {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private pending = false;
  private disposed = false;
  constructor(private blocked: () => boolean, private refresh: () => void) {}
  request(): void {
    if (this.disposed) return;
    this.pending = true;
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = setTimeout(() => { this.timer = null; this.flush(); }, 150);
  }
  flush(): void {
    if (this.disposed || !this.pending || this.blocked() || this.timer !== null) return;
    this.pending = false;
    this.refresh();
  }
  dispose(): void {
    this.disposed = true;
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    this.pending = false;
  }
}
