# Royal Garden — v2.9.3

The user selected the bottom (third) garden concept. `reference.png` preserves that visual target.

## Scope

- Change only the LIFE cross-road battlefield background.
- Retain actual path, 17×12 grid, placement rules, field dimensions, arrows and entry/exit indicators.
- Keep preparation/combat layout identical and CLASSIC appearance unchanged.
- Subsequently authorized by the user for v2.9.3 commit and deployment.

## Assets

- `public/assets/field/royal-garden-ground.png`: generated top-down dark moss ground with a thin weathered stone/ivy boundary; no baked paths, text or UI.
- `public/assets/field/royal-garden-path.png`: generated pale limestone tile with subtle wear and moss; reused only at existing path cells.
- Selected reference supplied to built-in image generation for both assets. No external paid service was provisioned.
- Prompt direction: selected royal garden palette and orthographic perspective; quiet detail for mobile legibility; separate decorative ground from logical movement paths.

## Verification

See project-root `design-qa.md`: visual comparison passed after arrow/marker contrast correction. `desktop.png`, `mobile.png` and `combat.png` are browser-rendered evidence; `before-contrast.png` records the earlier issue.
