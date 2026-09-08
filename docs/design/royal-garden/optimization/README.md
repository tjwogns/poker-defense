# Garden payload optimization — 2026-09-08

Release follow-up: included in v2.9.4 by subsequent user authorization. The local-only status below records the original implementation stage.

Local only; no version bump, commit or deployment. Earlier combat-inspector changes are preserved.

| Asset | Before bytes | After bytes | Runtime format |
| --- | ---: | ---: | --- |
| Ground | 2,379,754 | 365,568 | JPEG quality 82, 1428×1008 |
| Path | 2,722,704 | 11,096 | PNG, 84×84 |
| Total | 5,102,458 | 376,664 | 92.6% reduction |

Original opaque PNGs are preserved as `../source-ground.png` and `../source-path.png`, outside the public deployment tree. Ground keeps 2× the normal desktop board dimensions; the path tile keeps 2× its 42px desktop size. No asset regeneration or art redesign occurred. Texture keys, path cells and fallback behavior are unchanged.

## Visual verification

Identical local R1 preparation fixture `?visualTest=ui-clean-prep&lang=ko`, same hand, captured before/after at desktop 1280×720 and mobile 390×844. Both pairs were opened in the same comparison input.

- Desktop: `before-desktop.png` / `after-desktop.png`.
- Mobile: `before-mobile.png` / `after-mobile.png`.
- Stone microtexture is slightly smoother, expected from downsampling; paths, moss/wall boundaries, arrows and labels remain readable at actual game scale. No material new visual defect found in these viewports.
- Browser console error query: none.
- No claim of lossless ground compression or pixel-identical images.

## Loading limits

Measured reduction concerns the two image files, not complete startup duration. No controlled cold-cache mobile network timing was performed; caching, other assets and network conditions still affect loading. Production build must contain only the runtime JPEG/PNG pair, not source masters.
