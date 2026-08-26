# Poker Defense v1.1 Breakout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 액티브 무늬 스킬, 고유 보스, 공유 카드와 플레이 로그를 추가해 공개 플레이테스트용 v1.1을 만든다.

**Architecture:** 전투 규칙은 순수 core 모듈에, 공유·저장은 meta 모듈에 둔다. Phaser는 새 API를 표시하고 입력만 전달한다.

**Tech Stack:** TypeScript strict, Phaser 3.90, Vite 5, Vitest 2, Canvas, Web Share API

**Spec:** `docs/superpowers/specs/2026-08-26-poker-defense-v1-1-breakout-design.md`

## Global Constraints

- core는 DOM·Phaser에 의존하지 않는다.
- 모든 랜덤 결과는 게임 시드로 재현한다.
- 외부 서버·이미지·음원을 추가하지 않는다.
- v1 localStorage 프로필을 손실 없이 읽는다.

---

### Task 1: Suit powers

**Files:** Create `src/core/abilities.ts`; Create `tests/abilities.test.ts`; Modify `src/core/combat.ts`; Modify `src/core/game.ts`.

**Interfaces:** `dominantSuit(cards): Suit`, `Game.powerCharges`, `Game.useSuitPower(suit): SuitPowerResult | null`.

- [ ] Write failing tests for tie-breaking, charge caps, phase guard, and all four effects.
- [ ] Run the focused tests and confirm missing behavior failures.
- [ ] Implement combat primitives and Game integration.
- [ ] Run focused and full tests.

### Task 2: Six boss identities

**Files:** Create `src/core/bosses.ts`; Create `tests/bosses.test.ts`; Modify `src/core/combat.ts`; Modify `src/core/game.ts`; Modify `src/core/enemies.ts`.

**Interfaces:** `bossDef(round)`, `bossModifiers(round, hpRatio)`, summon and tax timers.

- [ ] Write failing tests for six definitions and each combat/economy behavior.
- [ ] Implement damage, regen, speed, tax, summon, and final phase effects.
- [ ] Run focused and full tests.

### Task 3: Profile v2 and sharing

**Files:** Modify `src/meta/profile.ts`; Modify `tests/profile.test.ts`; Create `src/meta/share.ts`; Create `tests/share.test.ts`.

**Interfaces:** `Profile.recentRuns`, `exportPlaytestData(profile)`, `shareText(summary, mode, date)`, `challengeUrl(base, date)`.

- [ ] Write failing migration, capped history, export, share copy, and URL tests.
- [ ] Implement defensive v1→v2 migration and pure share helpers.
- [ ] Run focused and full tests.

### Task 4: Breakout UI and game feel

**Files:** Create `src/game/SuitPowerBar.ts`; Create `src/game/BossHud.ts`; Create `src/game/ShareCard.ts`; Modify `PlayScene.ts`, `FieldRenderer.ts`, `SidePanel.ts`, `MenuScene.ts`, `AudioManager.ts`.

**Interfaces:** Power bar invokes `useSuitPower`; boss HUD consumes live boss; end overlay invokes share/download; menu exports playtest JSON.

- [ ] Add skill buttons and keyboard `Q/W/R/T` bindings.
- [ ] Add named boss HUD, summon/tax warnings, damage numbers, camera feedback, and ×4 speed.
- [ ] Add share/copy/download result controls and play-log export.
- [ ] Run typecheck, tests, build, and Chrome smoke.

### Task 5: Balance and documentation

**Files:** Modify `src/core/balance.ts`, `src/sim/run.ts`, `README.md`, `scripts/smoke.mjs`; Create Obsidian v1.1 notes.

**Interfaces:** Simulator spends suit charges deterministically and reports power usage; smoke validates share controls.

- [ ] Apply 0.45s spawn and 32s timeout, teach bot suit powers.
- [ ] Run 100 games and record results.
- [ ] Run full verification and sync non-destructive Obsidian v1.1 notes.
