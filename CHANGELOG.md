# Changelog

All notable changes to atmos-fx will be documented in this file.

The project follows semantic versioning once published.

## [Unreleased]

## [0.4.0] - 2026-07-09

- **Feature (Card Rain):** Implemented a high-fidelity WebGL-based card surface water droplets effect (Apple Weather style). Renders shader-lit droplets with normal-vector reflections, shadows, and trailing physics. Droplets slide down, merge on contact, and trail dynamically.
- **Performance & Pooling:**
  - Implemented a single shared WebGL renderer across all glass cards to drastically cut GPU overhead and context switching.
  - Automatically pauses off-screen card surface droplet rendering using visibility tracking.
  - Integrated with the quality scaling system: disabled card droplets entirely under `low` quality tier to guarantee performance on mobile.
- **Refactor:** Removed the global `liquidGatheringPoint` option from `AtmosFx` options validation, presets, and React component props, while keeping the card-level `liquidGatheringPoint` override attribute (`data-atmos-liquid-gathering-point`) and React prop.
- **Visuals & UX:**
  - Redesigned showcase cards with polished monochrome active/hover states.
  - Refined card water droplet density and scale for a cleaner aesthetic.
- **Accessibility:** Added an atmospheric background video (`cloudy-sky.webm`) to the showcase stage that dynamically respects the user's `prefers-reduced-motion` OS preferences, pausing playback automatically when reduced motion is requested.
- **Performance:** Added support for `data-atmos-quality` attributes on target cards, automatically disabling CPU-heavy full-screen backdrop-filter blur styles when the renderer drops to `low` quality.
- **Migration Note:** For users upgrading from versions prior to `0.3.0`, note that the public API has been simplified by removing deprecated options (`particle`, `transparency`, `contentOpacity`, `surfaceOpacity`, `collisionSelector`, `opaqueSelector`, `autoScaleQuality`, and the React `mode` alias).

## [0.3.0] - 2026-07-02

- **Breaking:** Simplified the public API by removing `particle`, the React `mode` alias, `transparency`, `autoScaleQuality`, `collisionSelector`, and `solidSelector`. Presets now determine the renderer, adaptive quality is always enabled, and DOM integration uses fixed data attributes.
- **Defaults:** Changed opacity from `0.72` to `0.1` and glass alpha from `0.08` to `0.12`.
- **Performance:** Optimized core renderers (rain, snow, hail) and physics update loops by breaking early during collision target lookups using sorted Y-coordinate boundaries.
- **Documentation:** Reduced the API reference to common consumer options and clarified that `data-atmos-liquid-gathering-point="0.5"` is an optional override, not the default.
- Bump version to 0.3.0.

## [0.2.0] - 2026-06-30

- **Breaking:** Removed `snowAccumulation` and `hailBounce` from the public options and React props. Snow and hail now use internally tuned accumulation and bounce behavior.
- **Liquid:** Added global, per-card, and data-attribute control over the rainwater gathering point. Reworked gathering timing, wave motion, droplet geometry, acceleration, pinch-off, and splash transitions for more natural card dripping.
- **Collision:** Added side-wall responses for rain, snow, hail, and falling accumulation. Rounded collision surfaces now use effective corner insets, and foreground particles that miss a rounded top edge route behind the card instead of crossing its content.
- **Accumulation:** Rebuilt snow and hail accumulation with two-dimensional stacking, settling, overlap resolution, melting, side falloff, and collisions while falling.
- **Adaptive quality:** Added frame-time monitoring, viewport auto-pause, and card-level liquid visibility tracking. `quality: 'auto'` now starts at medium, adapts from measured performance independently of container size, and reseeds particles across the viewport when tiers change.
- **Density:** Defined `density` as a linear particles-per-unit-area multiplier with a true zero-particle state. Increased rain, snow, and hail base rates by 25% across all quality tiers while leaving accumulation rates unchanged.
- **WebGL:** Moved rain streak expansion to GPU instancing, separated splash rendering, and tightened WebGL resource cleanup during renderer rebuilds and destruction.
- **Performance:** Throttled collision refresh work, removed hot-path allocations from liquid and accumulation updates, and skipped offscreen liquid DOM work without freezing droplets that are still falling above the viewport.
- **Fixes:** Prevented rain splashes from drawing over card content, kept auto-quality changes synchronized with renderer state, and forwarded `autoScaleQuality` correctly through the React adapter.
- **Documentation:** Expanded API guidance, synchronized defaults and runtime behavior, and added Japanese, Spanish, and Brazilian Portuguese README translations.

## [0.1.4] - 2026-06-17

- **Performance:** Optimized collision detection logic by sorting target rects and using binary search to dramatically reduce overhead when rendering high numbers of particles with many collision surfaces.
- **Visuals:** Massively increased particle budget caps for WebGL rendering and bumped the high-quality mode limit to 8000.
- **Documentation:** Consolidated favicon colors to better support dark mode and added the `atmos-fx` icon directly into the `README.md` and `README_zh.md` main titles.

## [0.1.3] - 2026-06-16

- **Breaking Change:** Changed the default value of `bottomCollision` from `false` to `true`. Rain and snow now collide and accumulate on the bottom edge of the container by default.
- Increased the default particle count budgets and maximum limits across all quality levels (low, medium, high) for denser precipitation rendering.
- Fully translated `README.md` and API references into Chinese (`README_zh.md`).
- Added AtmosCard design guidelines, rendering context (`asChild`), and integration examples to documentation.
- Improved the interactive docs playground UI and added custom brand favicons.
- Synced all API documentation and code snippet examples to ensure parity between the `README` and interactive playground.

## [0.1.2] - 2026-06-13

- Upgraded the default frosted glass styling to a premium glassmorphic aesthetic with a linear gradient background, refined borders, and updated box-shadows.
- Reduced default backdrop blur from `24px` to `8px` for better rendering performance and visual clarity.
- Introduced `bottomCollision` toggle option to control container bottom boundary collision across all weather modes.
- Added `liquidDripping` option and implemented rainwater gathering along card bottoms with tension-stretching snapping dripping physics.
- Added support for dynamically setting card opacity and `data-atmos-opaque` attribute in playground transparency modes.
- Resolved a double-line border rendering artifact on glass card top borders by removing the redundant top highlight inset shadow.
- Prevented snow landing logic from spawning accumulation when `snowAccumulation` is set to 0.
- Supported custom surface opacity values dynamically in the React adapter and playground code generation.
- Fixed release checklist references, local project documentation, and formatting.

## [0.1.1] - 2026-06-12

- Added dedicated Vite build configuration for bundling the interactive docs playground independently.
- Renamed all package name, DOM dataset attribute, CSS variable, and file references from `atoms-fx` / `atoms` to `atmos-fx` / `atmos`.

## [0.1.0] - 2026-06-12

- Added the framework-agnostic `createAtmosphere()` core API.
- Added Canvas 2D rain, storm, snow, and hail presets.
- Added glass, opacity, opaque, and collision DOM integration controls.
- Added top-edge rain collision splashes.
- Added background and foreground precipitation layers so transparent surfaces can reveal rain behind them.
- Added configurable `surfaceOpacity` and `contentOpacity` options.
- Added the React `<AtmosFx />` and `<AtmosCard />` adapters.
- Added an interactive docs playground.
- Added release, accessibility, and contribution documentation.
- Added bounded snow accumulation on collision surfaces and the root bottom edge.
- Added light collision bounce and bounded accumulation for hail.
- Added an initial WebGL rain renderer foundation with Canvas 2D fallback.
