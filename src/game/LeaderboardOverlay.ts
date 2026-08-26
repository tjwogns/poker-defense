import Phaser from 'phaser';
import { fetchDailyLeaderboard, leaderboardConfigured, LeaderboardEntry } from '../meta/leaderboard';
import { UI, makeButton, makeText } from './ui';

/** 오늘의 도전 TOP 10을 표시하는 온라인 랭킹 모달. */
export class LeaderboardOverlay {
  private root: Phaser.GameObjects.Container;
  private rowTexts: Phaser.GameObjects.Text[] = [];
  private statusText: Phaser.GameObjects.Text;
  private refreshButton: ReturnType<typeof makeButton>;
  private loading = false;

  constructor(
    scene: Phaser.Scene,
    private readonly date: string,
    private readonly playerId: string,
    playerName: string,
    onClose: () => void,
  ) {
    const children: Phaser.GameObjects.GameObject[] = [];
    const dim = scene.add.rectangle(640, 360, 1280, 720, 0x020705, 0.86).setInteractive();
    const shadow = scene.add.rectangle(640, 363, 760, 610, 0x000000, 0.45);
    const panel = scene.add.rectangle(640, 356, 760, 610, UI.panel, 1)
      .setStrokeStyle(2, UI.panelGlow, 0.95);
    children.push(dim, shadow, panel);

    children.push(
      makeText(scene, 300, 75, 'DAILY RANKING', 11, UI.accentText, true),
      makeText(scene, 300, 96, '오늘의 도전 TOP 10', 30, UI.text, true),
      makeText(scene, 300, 134, `${date} · 내 지휘관: ${playerName}`, 13, UI.textDim),
    );
    const close = makeButton(scene, 930, 96, 110, 36, '닫기  ESC', onClose, {
      fill: 0x42544a,
      fontSize: 11,
    });
    children.push(close.container);

    children.push(
      makeText(scene, 315, 177, '순위', 11, UI.gold, true),
      makeText(scene, 390, 177, '지휘관', 11, UI.gold, true),
      makeText(scene, 690, 177, '라운드', 11, UI.gold, true),
      makeText(scene, 860, 177, '점수', 11, UI.gold, true),
      scene.add.rectangle(640, 198, 690, 1, UI.panelLine, 1),
    );

    for (let index = 0; index < 10; index++) {
      const y = 222 + index * 35;
      if (index % 2 === 0) children.push(scene.add.rectangle(640, y, 680, 31, UI.panelRaised, 0.7));
      const rank = makeText(scene, 318, y, '-', 13, UI.textDim, true).setOrigin(0, 0.5);
      const name = makeText(scene, 390, y, '-', 13, UI.textDim).setOrigin(0, 0.5);
      const round = makeText(scene, 712, y, '-', 13, UI.textDim).setOrigin(0.5);
      const score = makeText(scene, 960, y, '-', 13, UI.textDim, true).setOrigin(1, 0.5);
      this.rowTexts.push(rank, name, round, score);
      children.push(rank, name, round, score);
    }

    this.statusText = makeText(scene, 640, 584, '랭킹을 불러오는 중…', 12, UI.textDim).setOrigin(0.5);
    this.refreshButton = makeButton(scene, 640, 625, 180, 38, '새로고침', () => void this.load(), {
      fill: 0x42544a,
      fontSize: 12,
    });
    children.push(this.statusText, this.refreshButton.container);
    this.root = scene.add.container(0, 0, children).setDepth(50);

    void this.load();
  }

  private async load(): Promise<void> {
    if (this.loading) return;
    if (!leaderboardConfigured()) {
      this.statusText.setText('온라인 랭킹 서버를 연결하면 순위가 표시됩니다.');
      this.statusText.setColor(UI.gold);
      this.refreshButton.setEnabled(false);
      return;
    }
    this.loading = true;
    this.refreshButton.setEnabled(false);
    this.statusText.setText('랭킹을 불러오는 중…').setColor(UI.textDim);
    try {
      const entries = await fetchDailyLeaderboard(this.date, this.playerId);
      this.renderEntries(entries);
      this.statusText.setText(entries.length > 0 ? '한 지휘관당 오늘의 최고 점수만 집계됩니다.' : '아직 등록된 기록이 없습니다. 첫 기록을 세워보세요!');
    } catch {
      this.statusText.setText('랭킹을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.').setColor(UI.dangerText);
    } finally {
      this.loading = false;
      this.refreshButton.setEnabled(true);
    }
  }

  private renderEntries(entries: LeaderboardEntry[]): void {
    for (let index = 0; index < 10; index++) {
      const entry = entries[index];
      const row = this.rowTexts.slice(index * 4, index * 4 + 4);
      if (!entry) {
        row.forEach((text) => text.setText('-').setColor(UI.textDim));
        continue;
      }
      const color = entry.isCurrentPlayer ? UI.gold : UI.text;
      row[0].setText(`#${entry.rank}`).setColor(color);
      row[1].setText(entry.name).setColor(color);
      row[2].setText(`${entry.round} / 60`).setColor(color);
      row[3].setText(entry.score.toLocaleString()).setColor(color);
    }
  }

  destroy(): void {
    this.root.destroy(true);
  }
}
