# Changelog

All notable changes to atmos-fx will be documented in this file.

The project follows semantic versioning once published.

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
