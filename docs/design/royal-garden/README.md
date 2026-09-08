# Royal Garden — v2.9.3

The user selected the bottom (third) garden concept. `reference.png` preserves that visual target.

## Scope

- Change only the LIFE cross-road battlefield background.
- Retain actual path, 17×12 grid, placement rules, field dimensions, arrows and entry/exit indicators.
- Keep preparation/combat layout identical and CLASSIC appearance unchanged.
- Subsequently authorized by the user for v2.9.3 commit and deployment.

## Assets

- `public/assets/field/royal-garden-ground.jpg`: generated top-down dark moss ground with a thin weathered stone/ivy boundary; no baked paths, text or UI. Originally PNG in v2.9.3; subsequent local optimization uses a resized JPEG.
- `public/assets/field/royal-garden-path.png`: generated pale limestone tile with subtle wear and moss; reused only at existing path cells.
- Selected reference supplied to built-in image generation for both assets. No external paid service was provisioned.
- Prompt direction: selected royal garden palette and orthographic perspective; quiet detail for mobile legibility; separate decorative ground from logical movement paths.

## Subsequent asset optimization (v2.9.4)

- Preserve original generated PNGs as `source-ground.png` and `source-path.png` outside `public`, so the production build does not copy the source masters.
- Ground: 1428×1008 JPEG at quality 82, retaining twice the 714×504 desktop board dimensions.
- Path: 84×84 PNG, twice the 42×42 desktop tile size; same texture key and logical cells.
- Original combined payload: 5,102,458 bytes. Optimized payload: 376,664 bytes (92.6% smaller).
- This is a byte-size reduction, not a measured 92.6% improvement in total loading time. Other assets, caching, server and network still affect startup.
- No new dependency, paid service or game rule introduced. Initially local-only; subsequently included in the user-authorized v2.9.4 release.

## Verification

See project-root `design-qa.md`: visual comparison passed after arrow/marker contrast correction. `desktop.png`, `mobile.png` and `combat.png` are browser-rendered evidence; `before-contrast.png` records the earlier issue.
