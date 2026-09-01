# Cross-road LIFE LAB Design QA

- Source visual truth: `/tmp/codex-remote-attachments/01a03d67-9ca8-7011-81aa-63769ae5d0a5/0ce4c839-6ace-4470-a0e9-17c8868dd26a/1-Photo-1.jpg`
- Implementation screenshot: `/Users/jaehooon/project/poker-defense/docs/cross-road-implementation.png`
- Source pixels: 960 × 1280
- Implementation pixels: 1280 × 720
- CSS viewport: 1280 × 720, device scale factor 1
- State: LIFE LAB, desktop, round 1 preparation phase
- Density normalization: conceptual route comparison only; the hand sketch is portrait paper and the game is a landscape canvas, so crops were not forced to identical aspect ratio.

## Full-view comparison evidence

The two images were opened together in one comparison input after the route order was clarified. The implementation now forms four rectangular placement regions separated by a full outer road and central cross. Enemies start and exit at the same upper-left S/E portal, traverse all four sides, and reuse the center vertical and horizontal roads in opposite directions. The existing Royal Siege palette, grid, HUD, typography, and unit art are intentionally preserved instead of copying the paper styling.

## Focused region comparison evidence

A separate crop was unnecessary because the full 17 × 12 field, four placement regions, outer road, center cross, paired direction arrows, and S/E portal are clearly visible at 1280 × 720. Automated waypoint checks cover all 13 ordered turns; live combat confirmed the lower-left traversal and center-road reuse.

## Required fidelity surfaces

- Fonts and typography: existing game typography is unchanged; the sketch contains no UI type target.
- Spacing and layout rhythm: route fits inside the existing field without moving the HUD, hand bar, or side panel.
- Colors and visual tokens: road, direction markers, spawn, and exit reuse current semantic game colors.
- Image quality and asset fidelity: no new raster asset was implied by the schematic; the route is native game geometry and remains sharp at desktop and portrait scale.
- Copy and content: LIFE LAB labels and existing gameplay copy remain unchanged.

## Findings

- No actionable P0/P1/P2 mismatch was found for the requested movement pattern.
- P3 follow-up: route order may still need numbered checkpoints if paired arrows alone are insufficient for first-time players.
- Balance note, not a visual mismatch: the corrected route is 92 tiles versus the 46-tile classic ring and creates much longer repeated attack exposure.

## Comparison history

- Initial pass: [P1] the sketch was misread as an 18-tile lower-center-to-upper-left route.
- Clarified pass: replaced it with the exact 13-waypoint, 92-tile S/E route; added four placement regions, shared S/E portal, and offset arrows for opposite-direction road reuse.
- Post-fix evidence: source and corrected implementation were opened together; no remaining P0/P1/P2 mismatch was found.

## Primary interactions tested

- Started LIFE LAB.
- Confirmed a hand and placed a unit beside the new route.
- Started combat and observed the outer route and center-road reuse.
- Confirmed LIFE LAB does not end at the old 32-second limit and instead waits for all enemies to die or escape.
- Checked the in-app browser console at `/?experiment=life`; no errors or warnings were recorded.

final result: passed
