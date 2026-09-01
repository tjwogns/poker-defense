# Royal Siege redesign — design QA

- Date: 2026-08-31
- Reference: `design_handoff_royal_siege_redesign` screens 1a and 1d
- Implementation: local Poker Defense menu, preparation, placement, and selected-unit states
- Canonical viewport: 1280 × 720
- Comparison artifact: `/tmp/royal-siege-handoff-reference/design-qa-comparison-final.jpg`

## Pass 1 — visual fidelity

Compared the reference and implementation side by side at the same 1280 × 720 viewport.

- P0: none.
- P1: the hand name and dominant-suit choices occupied the same vertical band in the card dock, obscuring the main decision. Fixed by reducing the preview type scale and moving the suit controls to a dedicated row.
- P2: the disabled ranking affordance still accepted pointer input. Fixed by guarding the interaction when the leaderboard is not configured.
- P2: the hidden combat-start control remained interactive at zero opacity. Fixed by toggling container visibility instead of alpha.

## Pass 2 — product states and interaction

- Verified menu primary and daily CTAs, standard-run entry, hand confirmation, recommended placement, unit selection, inspector actions, and combat-start state in the local browser.
- Verified that the gameplay surface preserves the reference hierarchy: global status bar, field, card dock, right command rail, gold primary action, and floating unit inspector.
- Verified that menu utilities remain available: sound, data consent, export, patch notes, and ranking status.
- Added a direct privacy-notice link to the consent overlay and retained keyboard-first game controls.

## Pass 3 — resilience and engineering checks

- The 16:9 game canvas continues to use proportional FIT scaling; the portrait rotation gate and mobile shell contracts remain covered by automated tests.
- Layout sections are bounded and non-overlapping in `tests/ui-layout.test.ts`.
- `npm run build`: passed.
- `npm test`: 34 files, 238 tests passed.
- `git diff --check`: passed.
- Standalone Puppeteer smoke scripts could not launch Chrome in the restricted workspace, so interactive browser QA was performed in the Codex in-app browser instead.

## Final assessment

The implementation matches the supplied Obsidian Royal direction in layout, typography, palette, imagery, surface treatment, and primary interaction hierarchy. Dynamic run content differs from the sample state by design; no unresolved P0, P1, or P2 findings remain.

Desktop final result: passed

---

# Portrait 390×844 implementation — design QA

- Date: 2026-09-01
- Source visual truth: `/Users/jaehooon/Library/Mobile Documents/iCloud~md~obsidian/Documents/Jh/1. Project/20260825 포커 디펜스/디자인/새 아트 디렉션.dc.html`, screens 3a–3c
- Source specification: `/Users/jaehooon/Library/Mobile Documents/iCloud~md~obsidian/Documents/Jh/1. Project/20260825 포커 디펜스/디자인/README-portrait.md`
- Source capture: `/tmp/poker-defense-portrait-source-3a.jpg`
- Implementation captures: `/tmp/poker-defense-portrait-menu-final.jpg`, `/tmp/poker-defense-portrait-play-final.jpg`, `/tmp/poker-defense-portrait-suit-choice-final.jpg`, `/tmp/poker-defense-portrait-result.png`
- Combined comparison: `/tmp/poker-defense-portrait-comparison.jpg`
- Viewport and density: 390×844 CSS px, implementation canvas 390×844 CSS px, browser density 1×. The source frame is 390×844 logical px; the comparison uses its browser-rendered frame at the same logical size.
- States: main menu, preparation, representative-suit choice, hand confirmation, placement prompt, unit placement, combat, and round-47 defeat analysis.

## Full-view comparison

The source and implementation were opened in the in-app browser and combined into one comparison view. The implementation preserves the source hierarchy and measurements: 52px HUD, 374×264 field, 58px next-wave card, 66×92 five-card row, 56px primary action, 50px utility row, dark obsidian surfaces, one gold filled action, and the 390×844 frame without overflow.

## Focused comparison

Focused checks covered the hand/action thumb zone and the defeat-analysis action stack because these contain the tightest vertical spacing. Menu typography and record rows were also captured separately. No additional crop was necessary for the field because the complete 374×264 field is readable in the full-height implementation capture.

## Required fidelity surfaces

- Fonts and typography: Georgia/system serif remains the existing offline-safe Bodoni substitute; Pretendard/system Korean and monospace numeric roles preserve the intended hierarchy. Text is at least 12px in the interactive portrait flow.
- Spacing and layout rhythm: the canvas, safe margins, field, card row, 56px action, and 50px utility controls match the supplied coordinate system. Persistent controls remain inside the viewport.
- Colors and visual tokens: the implementation reuses the supplied obsidian, panel, gold, danger, info, safe, card-face, and card-ink tokens. Gold fill remains reserved for the current primary action.
- Image quality and assets: existing production unit and dragon raster assets are reused; no placeholder art was added. Portrait removes the field watermark, range ring, unit halo, and enemy HP bar as specified.
- Copy and content: menu, wave, hand, placement, combat, and defeat-analysis labels follow the Korean source copy, with live game values replacing sample values.

## Comparison history

- Pass 1 — P1: after confirming a hand, exchange/confirm buttons remained under the placement instruction. Fixed by hiding hand actions and replacing the slot with a dedicated bordered placement banner. Post-fix capture showed a single unobstructed placement instruction.
- Pass 2 — P2: the field placement hint repeated directly above the next-wave card. Fixed by suppressing the redundant hint in portrait; recommended tiles remain visible.
- Pass 3 — P2: representative-suit buttons overlapped the hand summary and were left-aligned when only two suits were eligible. Fixed by shortening the prompt, moving the buttons to their own row, and centering the eligible set dynamically. Post-fix capture showed clear separation and no overlap.
- Pass 4 — no actionable P0/P1/P2 differences remained in the three supplied portrait screens.

## Verification

- Primary interactions tested: new run, suit choice, hand confirmation, recommended placement, combat start, combat pause affordance, and defeat result actions.
- Browser console: no warnings or errors in final menu/game/result passes.
- Automated checks: `npm run build` passed; `npm test` passed with 33 files and 238 tests; `git diff --check` passed.
- Residual P3: the portrait source shows decorative phone status/home chrome. The production web canvas intentionally relies on browser/device chrome rather than duplicating it inside the game.

final result: passed
