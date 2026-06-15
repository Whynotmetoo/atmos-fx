# atmos-fx
<div>
    <b>English</b> · <a href="README_zh.md">简体中文</a>
</div>

DOM-aware atmosphere effects for creative interfaces.

atmos-fx is an early-stage TypeScript library for making weather-like visual effects part of the DOM instead of a detached background. The first target effect is Apple Weather-inspired precipitation where child UI can become glass, stay opaque, or act as collision surfaces.

![demo-high](https://atmosfx.carsonye.com/assets/demo-high.gif)

> **To view the demo and use the playground, visit [https://atmosfx.carsonye.com/](https://atmosfx.carsonye.com/)**

[Install](#install) • [Quick start](#quick-start) • [API Reference](#api-reference) • [Design Guidelines](#design--ui-guidelines)

## Install

```bash
npm i atmos-fx
```

## Quick start

### React

React is a required peer dependency for the wrapper components.

```tsx
import { useRef } from 'react'
import { AtmosFx, AtmosCard } from 'atmos-fx'

export function FunctionalDemo() {
  const rootRef = useRef<HTMLDivElement>(null)

  return (
    <AtmosFx ref={rootRef} mode="rain" density={0.7} className="functional-demo">
      <AtmosCard transMode="glass">
        <div>Rain can land on this surface and splash from the top edge.</div>
      </AtmosCard>
      
      {/* Use asChild to avoid rendering an extra wrapper element */}
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

### Vanilla JS

```ts
import { createAtmosphere } from 'atmos-fx'

const controller = createAtmosphere(document.querySelector('#hero')!, {
  preset: 'rain',
  density: 0.7,
  wind: -0.15,
  surfaceOpacity: 0.16,
})

controller.start()

// When removing the atmosphere root outside React, make sure to destroy it:
// controller.destroy()
```

**Define HTML with data attributes for inner cards**:
- `data-atmos-opaque` keeps an element out of automatic glass or opacity treatment.
- `data-atmos-opacity="0.64"` applies a per-element opacity value.
- `data-atmos-glass` opts nested elements into the glass surface style.
- `data-atmos-collision` makes the element's top edge a precipitation collision surface.
- `transparency: 'glass' | 'opacity' | 'none'` controls the root integration mode.

## API Reference
### `AtmosFx` Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `mode` | `'rain' \| 'snow' \| 'hail'` | `'rain'` | The weather preset. |
| `density` | `number` | `0.5` | Intensity of the effect (0 to 1). |
| `speed` | `number` | `1.0` | Non-negative motion scalar. |
| `wind` | `number` | `0.0` | Horizontal motion scalar, usually -1 to 1. |
| `color` | `string` | `'#ffffff'` | Canvas particle color. |
| `quality` | `'auto' \| 'low' \| 'medium' \| 'high'` | `'auto'` | Rendering fidelity and particle count. |
| `transMode` | `'glass' \| 'opacity' \| 'none'` | `'glass'` | The root integration mode for children components. |
| `surfaceOpacity` | `number` | `0.12` | Glass surface opacity base. |
| `contentOpacity` | `number` | `0.2` | Controls opacity-mode content fade. |
| `snowAccumulation` | `number` | `0` | Controls snow buildup intensity (0 to 1). |
| `hailBounce` | `number` | `0.85` | Controls hail bounce restitution scalar (0 to 1). |
| `bottomCollision` | `boolean` | `true` | Controls container bottom boundary collision. |
| `pauseWhenHidden` | `boolean` | `true` | Automatically pause animation when document is hidden. |
| `respectReducedMotion`| `boolean` | `true` | Honors OS `prefers-reduced-motion` settings. |
| `injectStyles` | `boolean` | `true` | Whether default stylesheet rules are automatically injected. |
| `styleNonce` | `string` | `undefined` | CSP nonce for the injected style tag. |

### `AtmosCard` Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `transMode` | `'glass' \| 'opacity' \| 'solid'` | `'glass'` | Transparency behavior applied to the card. |
| `liquidDripping` | `boolean` | `true` | Toggles the water condensation and dripping animation (only in Rain mode). |
| `asChild` | `boolean` | `false` | Merges properties onto the underlying child element. **You can also use asChild when you want to avoid rendering an extra wrapper element.** |
| `opacity` | `number` | `undefined` | Custom backdrop opacity override (0 to 1). |

### `createAtmosphere` Options

`createAtmosphere(element, options)` returns a controller with `start()`, `stop()`, `pause()`, `resume()`, `resize()`, `update(options)`, and `destroy()`.

The `options` object accepts similar properties to the React components:

| Option | Type | Description |
| --- | --- | --- |
| `preset` | `'rain' \| 'snow' \| 'hail'` | The weather preset. |
| `density` | `number` | `0` to `1` |
| `speed` | `number` | non-negative motion scalar |
| `wind` | `number` | horizontal motion scalar, usually `-1` to `1` |
| `color` | `string` | Canvas color string |
| `quality` | `'auto' \| 'low' \| 'medium' \| 'high'` | Rendering fidelity |
| `transparency` | `'glass' \| 'opacity' \| 'none'` | Controls the root integration mode. |
| `surfaceOpacity` | `number` | `0` to `1`, controls glass surface opacity |
| `contentOpacity` | `number` | `0` to `1`, controls opacity-mode content fade |
| `snowAccumulation` | `number` | `0` to `1`, controls snow buildup intensity |
| `hailBounce` | `number` | `0` to `1`, controls hail bounce restitution scalar |
| `bottomCollision` | `boolean` | Controls container bottom boundary collision |
| `liquidDripping` | `boolean` | Controls whether rainwater dripping effect is active along card bottoms |
| `collisionSelector` | `string` | Selector for precipitation landing surfaces |
| `opaqueSelector` | `string` | Selector for solid child controls |
| `injectStyles` | `boolean` | Controls whether default stylesheet rules are automatically injected |
| `styleNonce` | `string` | CSP nonce for the injected style tag |
| `pauseWhenHidden` | `boolean` | Production performance toggle |
| `respectReducedMotion`| `boolean` | Production accessibility toggle |

## Design & UI Guidelines

To ensure visually realistic atmosphere effects, here are some guidelines to follow when designing with `AtmosCard`:

- **Particle Layering & Dripping**: Particles are rendered in foreground and background layers. Foreground particles are blocked by collidable `AtmosCard` elements. If `liquidDripping` is enabled on a card, the accumulated rainwater will drip down and correctly collide with any collidable `AtmosCard`s positioned below it.
- **Avoid Wide Blocking Cards**: A very wide collidable `AtmosCard` will act like an umbrella, blocking most of the foreground rain. This prevents rain from reaching the elements below it, significantly reducing their rain splash animations. Unless this "umbrella" effect is specifically intended, avoid overly wide collision surfaces.
- **Avoid Nesting Cards**: Unless you have a highly specific visual effect in mind, avoid nesting an `AtmosCard` directly inside another `AtmosCard`. This can cause conflicting collision bounds and visual behaviors that defy natural physics.
- **Card Modes (`transMode`)**:
  - `glass`: The default frosted glass effect, triggering high-fidelity backdrop blurs.
  - `opacity`: A translucent mode where the card relies on standard CSS opacity to blend with the weather background.
  - `solid`: Leaves the element with its default opaque style, allowing you to fully customize its appearance without library-applied transparency.

## Performance Notes

- Prefer `quality: 'auto'` for responsive pages.
- Rendering defaults to WebGL, automatically falling back to a silent dummy Canvas 2D context if WebGL initialization fails.
- Transparent surfaces can reveal background-layer precipitation while foreground precipitation still collides with selected DOM surfaces.
- Keep collision surfaces intentional; target rects refresh outside the animation frame loop.
- Collision and dripping physics use the axis-aligned bounding box (AABB) of targeted elements. Rotated elements (e.g. using `transform: rotate()`) will have collisions calculated against their outer bounding rectangle rather than the rotated visual boundary.
- Snow accumulation is bounded by quality, density, and the configured buildup intensity.
- Leave `respectReducedMotion` enabled in production.

## Development

```bash
npm install
npm run typecheck
npm run build
npm test
```

The current implementation includes the project foundation, the core lifecycle shell, WebGL rain, snow, and hail renderers, a silent dummy Canvas 2D fallback, glass orchestration, top-edge collision splashes for rain, rainwater gathering along card bottoms with tension-stretching snapping dripping physics, bounded snow accumulation, light bounce and bounded accumulation for hail, and a static docs playground.

## Local Smoke Test

After building, open the interactive docs playground:

```bash
npm run build
npx vite --host 127.0.0.1 --port 4173
```

Then visit `http://127.0.0.1:4173/docs/` to play with the switcher and compare rain, snow, and hail.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for details on building and testing.

## License

MIT
