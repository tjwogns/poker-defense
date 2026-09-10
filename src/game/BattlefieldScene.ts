import Phaser from 'phaser';
import { BattlefieldMapId, GRID_H, GRID_W, TILE, isPlaceable, pathCorners, pathLength } from '../core/map';
import { ACTIVE_BATTLEFIELD_MAP_IDS, battlefieldExperiment, BattlefieldExperiment } from './experiment';
import { setActiveLayoutMode } from './device';
import { setActivePortraitHeight } from './layout';
import { MenuViewportRefresh, viewportCanvasLayout } from './viewportLayout';
import { FONT, UI, makeButton, makeText } from './ui';
import { tr } from '../i18n';

const COPY: Record<BattlefieldMapId, readonly [string, string, string, string]> = {
  'cross-road': ['교차로 · 기준', 'CROSSROAD · BASELINE', '중앙 재진입을 넓게 방어', 'Cover repeated center crossings'],
  'parallel-corridors': ['평행 회랑', 'PARALLEL CORRIDORS', '좁은 줄 사이에서 여러 차선을 공격', 'Attack neighboring lanes'],
  'twin-gardens': ['쌍정원', 'TWIN GARDENS', '좌우 정원과 중앙 다리에 화력 분배', 'Split coverage across two gardens'],
  'inward-spiral': ['안쪽 나선', 'INWARD SPIRAL', '외곽 초반과 안쪽 후반 방어를 선택', 'Balance outer and inner coverage'],
};

/** A deliberately separate, non-persistent map comparison entry point. */
export class BattlefieldScene extends Phaser.Scene {
  constructor() { super('battlefields'); }

  create(data: Partial<BattlefieldExperiment> = {}): void {
    const query = battlefieldExperiment(window.location.search, window.location.pathname);
    if (!query) { this.scene.start('menu'); return; }
    const selected = battlefieldExperiment(`?experiment=battlefields&map=${data.mapId ?? query.mapId}&seed=${data.seed ?? query.seed}`)!;
    const layout = viewportCanvasLayout(window.innerWidth, window.innerHeight, window.visualViewport?.height);
    setActiveLayoutMode(layout.mode);
    if (layout.mode === 'portrait') setActivePortraitHeight(layout.height);
    this.scale.setGameSize(layout.width, layout.height);
    this.cameras.main.setViewport(0, 0, layout.width, layout.height);
    const refresh = new MenuViewportRefresh(() => false, () => this.scene.restart(selected));
    const onResize = () => refresh.request();
    window.addEventListener('resize', onResize);
    window.visualViewport?.addEventListener('resize', onResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      refresh.dispose();
      window.removeEventListener('resize', onResize);
      window.visualViewport?.removeEventListener('resize', onResize);
    });
    const portrait = layout.mode === 'portrait';
    const cx = layout.width / 2;
    makeText(this, cx, 32, tr('전장 실험실', 'BATTLEFIELD LAB'), portrait ? 25 : 34, UI.gold, true).setOrigin(0.5, 0);
    makeText(this, cx, 77, tr('실험 전용 · 기록·학습·랭킹 미반영', 'EXPERIMENT ONLY · NO SAVED RECORDS OR RANKING'), portrait ? 12 : 16, UI.text).setOrigin(0.5, 0);
    makeText(this, cx, 101, tr('전투 수치 동일 · 경로별 체감 난도 차이', 'SAME COMBAT STATS · DIFFICULTY VARIES BY PATH'), portrait ? 10 : 13, UI.textDim).setOrigin(0.5, 0);
    makeText(this, cx, 116, tr('중앙 표식 +25% 유지 · 같은 묶음은 같은 첫 패', 'CENTER MARK +25% · SAME SET = SAME OPENING HAND'), portrait ? 9 : 11, UI.textDim).setOrigin(0.5, 0);
    const cardW = portrait ? 174 : 270;
    const cardH = portrait ? Math.min(244, (layout.height - 230) / 2) : 330;
    for (const [index, mapId] of ACTIVE_BATTLEFIELD_MAP_IDS.entries()) {
      const x = portrait ? (index === 2 ? cx - cardW / 2 : 15 + index * 186)
        : cx - (ACTIVE_BATTLEFIELD_MAP_IDS.length * 290 - 20) / 2 + index * 290;
      const y = portrait ? 135 + Math.floor(index / 2) * (cardH + 12) : 170;
      const [ko, en, strategyKo, strategyEn] = COPY[mapId];
      this.add.rectangle(x, y, cardW, cardH, UI.panel).setOrigin(0).setStrokeStyle(1, mapId === selected.mapId ? UI.goldNum : UI.panelLine);
      makeText(this, x + 10, y + 12, tr(ko, en), portrait ? 11 : 16, UI.text, true);
      const tile = (cardW - 24) / GRID_W;
      const path = pathCorners(mapId);
      const g = this.add.graphics();
      g.fillStyle(0x182720, 1).fillRect(x + 12, y + 40, GRID_W * tile, GRID_H * tile);
      g.lineStyle(Math.max(2, tile * 0.38), 0xb8b8a6, 1);
      for (let i = 1; i < path.length; i++) {
        g.lineBetween(x + 12 + (path[i - 1].x + .5) * tile, y + 40 + (path[i - 1].y + .5) * tile,
          x + 12 + (path[i].x + .5) * tile, y + 40 + (path[i].y + .5) * tile);
      }
      for (const [point, color] of [[path[0], 0x79d5bd], [path[path.length - 1], 0xffa08f]] as const) {
        g.fillStyle(color).fillCircle(x + 12 + (point.x + .5) * tile, y + 40 + (point.y + .5) * tile, 3);
      }
      const count = Array.from({ length: GRID_W * GRID_H }, (_, i) => isPlaceable(i % GRID_W, Math.floor(i / GRID_W), mapId)).filter(Boolean).length;
      makeText(this, x + 10, y + cardH - 76, tr(strategyKo, strategyEn), portrait ? 10 : 13, UI.textDim)
        .setWordWrapWidth(cardW - 20, true);
      const length = pathLength(mapId) / TILE;
      makeText(this, x + 10, y + cardH - 50, tr(`경로 ${length} · 배치 ${count}칸`, `PATH ${length} · ${count} BUILD TILES`), 10, UI.gold);
      makeButton(this, x + cardW / 2, y + cardH - 23, cardW - 20, 32, tr('이 전장 시작', 'PLAY THIS MAP'), () => {
        refresh.dispose();
        this.scene.start('play', { seed: selected.seed, mode: 'standard', experiment: { seed: selected.seed, mapId } });
      }, { fontSize: 12 });
    }
    const bottom = portrait ? 135 + 2 * (cardH + 12) + 8 : 540;
    makeText(this, cx, bottom, `DEAL #${selected.seed}`, 11, UI.textDim).setOrigin(0.5, 0);
    makeButton(this, cx - (portrait ? 88 : 140), bottom + 45, portrait ? 164 : 230, 42, tr('새 패 묶음', 'NEW DEAL SET'), () => {
      refresh.dispose();
      this.scene.restart({ ...selected, seed: (selected.seed * 1664525 + 1013904223) >>> 0 });
    }, { fill: UI.panelRaised, fontSize: 12 });
    makeButton(this, cx + (portrait ? 88 : 140), bottom + 45, portrait ? 164 : 230, 42, tr('실험 나가기', 'LEAVE EXPERIMENT'), () => {
      refresh.dispose();
      const url = new URL(window.location.href);
      for (const key of ['experiment', 'map', 'seed']) url.searchParams.delete(key);
      window.history.replaceState(null, '', url);
      this.scene.start('menu');
    }, { fill: UI.panelRaised, fontSize: 12 });
    this.add.text(cx, bottom + 76, tr('민트 고리: 입구 · 붉은 고리: 출구', 'MINT RING: ENTRY · CORAL RING: EXIT'), {
      fontFamily: FONT, fontSize: '10px', color: UI.textDim,
    }).setOrigin(0.5, 0);
  }
}
