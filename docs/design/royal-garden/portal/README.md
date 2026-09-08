# Text-free spawn portal — local change, 2026-09-08

Release follow-up: included in v2.9.4 by subsequent user authorization; original implementation-stage status below is retained as history.

- User requested removing entrance/exit labels and replacing them with another indication of enemy emergence.
- Cross-road now has one small dark oval with a mint outline on the existing shared start/end cell. S/E text, dark rectangular backing and overlaid start/exit arrows are removed. Route arrows remain.
- Portal pulse lasts 0.3 simulation seconds for newly observed living enemy IDs near the starting tile. Initial enemy snapshot is a baseline, not a spawn event. Mid-path split children do not trigger it; split children within one tile of the start can still trigger this location-based visual heuristic.
- Pause freezes pulse time. Reduced-motion preference suppresses the pulse. Portal remains below enemies and within one tile.
- CLASSIC, near-exit danger warning, path/placement, field size and game rules unchanged. Earlier inspector/asset optimizations preserved.

## Verification

- Mobile 390×844 and desktop 1280×720 checked. Screenshots: `before-mobile.png`, `after-mobile.png`, `after-desktop.png`.
- Actual R1 hand confirmation, legal placement and combat start checked. First enemy appeared on the portal with a light ring: `spawn.png`.
- Browser error log query empty.
- Independent tests: 52 files / 450 tests, type check/build/diff check passed.
- No new assets, dependencies, paid services, version change, commit or deployment.
