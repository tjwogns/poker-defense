# Poker Defense v1.0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 합성, 유물, 데일리 런, 기록, 튜토리얼과 연출을 갖춘 재방문 가능한 포커 디펜스 v1.0을 만든다.

**Architecture:** 기존 순수 TypeScript 코어에 합성·유물·점수를 추가하고, 브라우저 전용 상태는 meta 계층에 격리한다. Phaser에는 메뉴와 v1.0 컨트롤을 추가하되 게임 규칙은 계속 core API만 호출한다.

**Tech Stack:** TypeScript strict, Phaser 3.90, Vite 5, Vitest 2, localStorage, Web Audio API

**Spec:** `docs/superpowers/specs/2026-08-26-poker-defense-v1-design.md`

## Global Constraints

- core는 Phaser와 DOM에 의존하지 않는다.
- RNG는 mulberry32만 사용하고 Math.random은 사용하지 않는다.
- 전투 중 경제·배치 변경을 금지한다.
- 저장 실패가 게임 플레이를 막지 않는다.
- 외부 이미지·음원·서버 의존성을 추가하지 않는다.

---

### Task 1: Relic engine

**Files:** Create `src/core/relics.ts`; Create `tests/relics.test.ts`; Modify `src/core/game.ts`.

**Interfaces:** Produces `RelicId`, `RELIC_DEFS`, `relicChoices(seed, milestone, owned)` and Game `relicChoices`, `chooseRelic()`.

- [ ] Write tests proving deterministic unique offers, owned exclusion, selection gating, and each aggregate modifier.
- [ ] Run `npm test -- tests/relics.test.ts` and confirm failures caused by missing module/API.
- [ ] Implement definitions, deterministic offer generation, Game selection and derived modifiers.
- [ ] Run relic and full test suites.

### Task 2: Unit fusion and phase invariants

**Files:** Modify `tests/game.test.ts`; Modify `src/core/game.ts`; Modify `src/core/balance.ts`; Modify `src/core/enemies.ts`.

**Interfaces:** Produces `fusionCandidates(tier)`, `fuseUnits(unitIds)`, `fieldCap`, guarded `sellUnit` and `buyUpgrade`.

- [ ] Write tests for three-of-a-kind fusion, invalid materials, royal cap, and combat mutation rejection.
- [ ] Run targeted tests and confirm expected failures.
- [ ] Implement minimal fusion and phase guards; connect `BOSS_HP_MULT` as the boss definition source.
- [ ] Run full tests.

### Task 3: Scoring and profile persistence

**Files:** Create `src/core/scoring.ts`; Create `src/meta/profile.ts`; Create `tests/scoring.test.ts`; Create `tests/profile.test.ts`; Modify `src/core/game.ts`.

**Interfaces:** Produces Game `score`, `kills`, `summary()` and meta `loadProfile`, `recordRun`, `saveProfile`, `dailySeed`.

- [ ] Write literal expectation tests for score events, stable date seed, malformed storage recovery, best records and achievements.
- [ ] Confirm tests fail for missing APIs.
- [ ] Implement pure scoring and defensive versioned persistence.
- [ ] Run targeted and full tests.

### Task 4: Menu, tutorial, sound, and game controls

**Files:** Create `src/game/MenuScene.ts`; Create `src/game/AudioManager.ts`; Create `src/game/TutorialOverlay.ts`; Modify `src/main.ts`; Modify `src/game/PlayScene.ts`; Modify `src/game/SidePanel.ts`; Modify `src/game/ui.ts`; Modify `index.html`.

**Interfaces:** Menu starts `play` with `{seed, mode}`; PlayScene persists Game summary and returns to menu; controls expose pause, sound, fusion and relic choice.

- [ ] Add menu scene with standard/daily actions and persisted stats.
- [ ] Add generated Web Audio cues and saved mute preference.
- [ ] Add tutorial overlay, keyboard shortcuts, pause, fusion, relic cards, score and run mode UI.
- [ ] Add mobile landscape guidance and accessible page metadata.
- [ ] Run typecheck and full tests.

### Task 5: Rendering polish and portable smoke test

**Files:** Modify `src/game/FieldRenderer.ts`; Modify `src/game/HandBar.ts`; Modify `scripts/smoke.mjs`; Modify `README.md`.

**Interfaces:** Browser smoke starts its own preview target through `BASE_URL`, writes screenshots to `os.tmpdir()`, and validates menu/play/combat state.

- [ ] Add readable placement/fusion feedback, boss emphasis, richer attack effects and status copy.
- [ ] Remove user-specific filesystem paths from smoke test.
- [ ] Update README for v1.0 systems and controls.
- [ ] Run production and single-file builds plus smoke test.

### Task 6: Balance, documentation, and release verification

**Files:** Modify `src/sim/run.ts`; Create/update Obsidian project notes under `1. Project/20260825 포커 디펜스/`.

**Interfaces:** Simulator uses legal v1.0 fusion/relic decisions and reports score; Obsidian notes link the product, architecture, balance and release record.

- [ ] Teach the heuristic bot to fuse and choose relics.
- [ ] Run 100 deterministic games and record the distribution.
- [ ] Run `npm test`, `npm run build`, and `SINGLEFILE=1 npm run build` fresh.
- [ ] Update the Obsidian MOC, design, architecture, balance and v1.0 release notes.
