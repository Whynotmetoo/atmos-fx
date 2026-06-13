# atmos-fx

DOM-aware atmosphere effects for creative interfaces.

atmos-fx is an early-stage TypeScript library for making weather-like visual effects part of the DOM instead of a detached background. The first target effect is Apple Weather-inspired precipitation where child UI can become glass, stay opaque, or act as collision surfaces.

## Installation

```bash
npm i atmos-fx
```

## Usage

```ts
import { createAtmosphere } from 'atmos-fx'

const controller = createAtmosphere(document.querySelector('#hero')!, {
  preset: 'rain',
  density: 0.7,
  wind: -0.15,
  surfaceOpacity: 0.16,
})

controller.start()
```

```tsx
import { useRef } from 'react'
import { AtmosFx, AtmosCard } from 'atmos-fx'

export function WeatherPanel() {
  const rootRef = useRef<HTMLDivElement>(null)

  return (
    <AtmosFx ref={rootRef} mode="rain" density={0.7} className="weather-panel">
      <AtmosCard transMode="glass">
        <div>Rain can land on this surface and splash from the top edge.</div>
      </AtmosCard>
      
      {/* Polymorphic element example using asChild */}
      <AtmosCard asChild transMode="solid">
        <button>Opaque action</button>
      </AtmosCard>

      <AtmosCard transMode="opacity" opacity={0.64}>
        <span>Custom opacity</span>
      </AtmosCard>
    </AtmosFx>
  )
}
```

## DOM Controls

Styling rules are automatically injected into the document head upon initialization, so no manual stylesheet import is required.

- `data-atmos-opaque` keeps an element out of automatic glass or opacity treatment.
- `data-atmos-opacity="0.64"` applies a per-element opacity value.
- `data-atmos-glass` opts nested elements into the glass surface style.
- `data-atmos-collision` makes the element's top edge a precipitation collision surface.
- `transparency: 'glass' | 'opacity' | 'none'` controls the root integration mode.

## API Reference

`createAtmosphere(element, options)` returns a controller with `start()`, `stop()`, `pause()`, `resume()`, `resize()`, `update(options)`, and `destroy()`.

Core options:

- `preset`: `'rain' | 'storm' | 'snow' | 'hail'`
- `density`: `0` to `1`
- `speed`: non-negative motion scalar
- `wind`: horizontal motion scalar, usually `-1` to `1`
- `color`: Canvas color string
- `quality`: `'auto' | 'low' | 'medium' | 'high'`
- `renderer`: `'canvas2d' | 'webgl' | 'auto'`; WebGL currently supports rain and falls back to Canvas 2D when unavailable
- `transparency`: `'glass' | 'opacity' | 'none'`
- `surfaceOpacity`: `0` to `1`, controls glass surface opacity
- `contentOpacity`: `0` to `1`, controls opacity-mode content fade
- `snowAccumulation`: `0` to `1`, controls snow buildup intensity
- `collisionSelector`: selector for precipitation landing surfaces
- `opaqueSelector`: selector for solid child controls
- `pauseWhenHidden` and `respectReducedMotion`: production performance/accessibility toggles

React is available directly from `atmos-fx`:

```tsx
<AtmosFx mode="snow" density={0.5} />
```

React is a required peer dependency.

## Performance Notes

- Prefer `quality: 'auto'` for responsive pages.
- Keep `renderer: 'canvas2d'` for full feature parity; `renderer: 'webgl'` is the initial rain foundation with Canvas 2D fallback.
- Transparent surfaces can reveal background-layer precipitation while foreground precipitation still collides with selected DOM surfaces.
- Keep collision surfaces intentional; target rects refresh outside the animation frame loop.
- Collision and dripping physics use the axis-aligned bounding box (AABB) of targeted elements. Rotated elements (e.g. using `transform: rotate()`) will have collisions calculated against their outer bounding rectangle rather than the rotated visual boundary.
- Snow accumulation is bounded by quality, density, and the configured buildup intensity.
- Leave `respectReducedMotion` enabled in production.
- Use `controller.destroy()` when removing an atmosphere root outside React.

## Development

```bash
npm install
npm run typecheck
npm run build
npm test
```

The current implementation includes the project foundation, the core lifecycle shell, Canvas 2D rain, snow, and hail renderers with particle budgeting, an initial WebGL rain renderer foundation with Canvas fallback, glass orchestration, top-edge collision splashes for rain, bounded snow accumulation, light bounce and bounded accumulation for hail, and a static docs playground.

## Local Smoke Test

After building, open the interactive docs playground:

```bash
npm run build
npx vite --host 127.0.0.1 --port 4173
```

Then visit `http://127.0.0.1:4173/docs/` to play with the switcher and compare rain, storm, snow, and hail.

## Release and Contribution Docs

- Accessibility guidance: `docs/accessibility.md`
- Release checklist: `docs/release-checklist.md`
- Changelog: `CHANGELOG.md`
- Contributing: `CONTRIBUTING.md`

## License

MIT
