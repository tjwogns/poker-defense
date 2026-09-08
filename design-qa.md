# Royal Garden background QA — 2026-09-08

final result: passed

## Evidence and normalization

- Source: `docs/design/royal-garden/reference.png`, 1672×941 generated desktop mock.
- Normalized source: `/tmp/garden-reference-1280.png`, downsampled to 1280×720 for comparison.
- Rendered desktop: `docs/design/royal-garden/desktop.png`, 1280×720 CSS/pixels (1×).
- Rendered mobile: `docs/design/royal-garden/mobile.png`, 390×844 CSS/pixels (1×).
- Combat: `docs/design/royal-garden/combat.png`, 390×844, paused R24 fixture.
- Local routes: `?visualTest=ui-clean-prep&lang=ko` (R1, same hand as source), `?visualTest=formation-mastery-combat&lang=ko`.
- Source and final desktop were opened together in one comparison input at equal dimensions. Mobile and desktop were also viewed with the source together.
- Focused inspection: entrance panel, path arrows, central crossing and deployment grid were readable in the full-resolution 1280px comparison, so no separate crop was required.

## Comparison history and findings

1. Mac lock initially blocked browser capture; resolved after manual unlock.
2. First desktop capture `docs/design/royal-garden/before-contrast.png`: P2 path arrows and entrance/exit labels lost contrast against pale stone. Reference had dark marker backing and outlined arrows.
3. Fix: garden-only dark marker backing plus opaque gold arrows with dark outlines, preserving path/marker geometry and CLASSIC.
4. Final desktop/mobile captures show legible direction indicators and entrance/exit labels. No remaining actionable P0/P1/P2 visual differences in the scoped background change.

## Required fidelity surfaces

- Typography: existing heading/card/action fonts and hierarchy retained; no new wrapping or clipped controls in the captured viewports.
- Layout: existing 17×12 geometry and field/card/action regions retained. Portrait has the existing larger gap below the battlefield; no combat-only resize was introduced.
- Colors: dark moss, stone boundary and pale paving match the selected garden direction; arrow/marker contrast corrected.
- Image quality: generated raster ground and stone assets, not code-drawn substitutes. Compared with the concept, paving is quieter and boundary foliage less dense; accepted for small-screen clarity, not claimed pixel-identical. Paths remain the actual logical cells.
- Copy: unchanged product copy; fixture hand matches source. No prompt/instruction text introduced.

## Runtime and residual risks

- Browser navigation/load and R1 preparation/R24 combat fixture rendering checked. Console error query returned no errors.
- This pass did not manually replay a full run or retest every interaction; core placement and combat rules were not changed and remain covered by automated tests.
- 50 test files / 434 tests and production build passed independently; contrast patch has targeted tests/build and final full regression check.
- P3: PNG downloads total approximately 4.9MB. Consider lossless/runtime-size asset optimization later; no new paid infrastructure was provisioned.
