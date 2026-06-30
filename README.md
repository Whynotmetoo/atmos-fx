# <img src="./docs/favicon.svg" width="36" height="36" align="center" alt="atmos-fx icon" /> atmos-fx
<div>
    <b>English</b> · <a href="README_zh.md">简体中文</a> · <a href="README_ja.md">日本語</a> · <a href="README_es.md">Español</a> · <a href="README_pt-BR.md">Português (Brasil)</a>
</div>
<br>
atmos-fx is a DOM-aware atmosphere effects library for making weather-like visual effects part of the DOM instead of a detached background. The first target effect is Apple Weather-inspired precipitation where child UI can become glass, stay opaque, or act as collision surfaces.

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
import { AtmosFx, AtmosCard } from 'atmos-fx'

export function FunctionalDemo() {
  return (
    <AtmosFx preset="rain" density={0.7} className="functional-demo">
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

### CDN

With a bundler such as Vite or webpack, install the package and import the core API normally:

```javascript
import { createAtmosphere } from 'atmos-fx'
```

For plain HTML without a build step, use an ESM CDN:

```html
<script type="module">
  import { createAtmosphere } from 'https://esm.sh/atmos-fx'

  const controller = createAtmosphere(document.querySelector('#container'), {
    preset: 'rain',
    density: 0.7,
  })

  controller.start()
</script>
```

### Vanilla JS
```html
<div id="container">
  <div data-atmos-collision data-atmos-glass data-atmos-liquid-dripping="true">
    <h1>Interactive Opaque Shelf</h1>
    <p>Precipitation splashes here.</p>
  </div>
</div>
```

```javascript
import { createAtmosphere } from 'atmos-fx'

const controller = createAtmosphere(document.querySelector('#container'), {
  preset: 'rain',
  density: 0.7,
  wind: -0.15,
  surfaceOpacity: 0.16,
})

controller.start()

// When removing the atmosphere root outside React, make sure to destroy it:
// controller.destroy()
```
### Vue Example

```html
<template>
  <div ref="containerRef" id="container">
    <!-- Use data attributes to define collision and glass surfaces -->
    <div data-atmos-collision data-atmos-glass>
      <h1>Interactive Opaque Shelf</h1>
      <p>Precipitation splashes here.</p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { createAtmosphere } from 'atmos-fx'

const containerRef = ref(null)
let controller = null

onMounted(() => {
  if (containerRef.value) {
    controller = createAtmosphere(containerRef.value, {
      preset: 'rain',
      density: 0.7,
      wind: -0.15,
      surfaceOpacity: 0.16,
    })
    controller.start()
  }
})

onUnmounted(() => {
  if (controller) {
    controller.destroy()
  }
})
</script>
```

## API Reference
### `AtmosFx` Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `preset` | `'rain' \| 'snow' \| 'hail'` | `'rain'` | Applies preset default physical and visual values. (Alias: `mode`) |
| `particle` | `'rain' \| 'snow' \| 'hail'` | (Inherits preset) | Overrides preset particle rendering without overwriting speed/wind presets. |
| `density` | `number` | `0.65` | Controls particles per unit area (0 disables particles; 1 uses the full quality-tier rate). |
| `speed` | `number` | `1.0` | Scalar multiplier for gravity and vertical fall speed. |
| `wind` | `number` | `-0.12` | Affects horizontal sway and particle drift. |
| `color` | `string` | `'rgba(220, 235, 255, 0.72)'` | Browser-supported CSS color for precipitation and rain liquid; its alpha channel is preserved. |
| `quality` | `'auto' \| 'low' \| 'medium' \| 'high'` | `'auto'` | Manual tiers set particle rate; `auto` starts at medium and adapts to measured frame performance. |
| `autoScaleQuality` | `boolean` | `true` | Enables frame-performance adaptation. When disabled, `auto` stays at medium and manual tiers keep the full DPR cap. |
| `transparency` | `'glass' \| 'opacity' \| 'none'` | `'glass'` | Sets the root integration mode; individual surfaces are configured with `AtmosCard` or data attributes. |
| `surfaceOpacity` | `number` | `0.14` | Glass surface background base, clamped from `0` to `1`. |
| `contentOpacity` | `number` | `0.72` | Fallback opacity for elements marked with `data-atmos-opacity`, clamped from `0` to `1`. |
| `bottomCollision` | `boolean` | `true` | Determines whether particles collide with the bottom edge of the container. |
| `collisionSelector` | `string` | `[data-atmos-collision]` | Query selector for DOM collision targets whose top, side, and rounded-corner geometry affects foreground particles. |
| `opaqueSelector` | `string` | `[data-atmos-opaque]` | Query selector for elements that skip transparency blurs. |
| `liquidDripping` | `boolean` | `true` | Globally toggles the water condensation and dripping animation (only in Rain mode). |
| `liquidGatheringPoint` | `number` | Random | Sets the horizontal liquid gathering point from `0.33` to `0.66`. The default is stable-random per card. |
| `pauseWhenHidden` | `boolean` | `true` | Automatically pause animation when document is hidden or the root element is out of the viewport. |
| `respectReducedMotion`| `boolean` | `true` | Honors OS `prefers-reduced-motion` settings. |
| `injectStyles` | `boolean` | `true` | Injects the default rules; disable it when loading `atmos-fx/styles.css` yourself. |
| `styleNonce` | `string` | `''` | CSP nonce applied to the automatically injected style tag. |

### `AtmosCard` Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `transMode` | `'glass' \| 'opacity' \| 'solid'` | `'glass'` | Specifies card integration style. |
| `liquidDripping` | `boolean` | `true` | Toggles the water condensation and dripping animation. |
| `liquidGatheringPoint` | `number` | Inherits / Random | Overrides the liquid gathering point for this card from `0.33` to `0.66`. |
| `asChild` | `boolean` | `false` | Merges properties onto the underlying child element to avoid rendering an extra wrapper element. |
| `opacity` | `number` | `0.72` in opacity mode | Element opacity used by `transMode="opacity"`; ignored by glass and solid modes. |

### Vanilla JS `createAtmosphere` Options

`createAtmosphere(element, options)` returns a controller with `start()`, `stop()`, `pause()`, `resume()`, `resize()`, `update(options)`, and `destroy()`.

The `options` object accepts exactly the same parameters as the `AtmosFx` Props (excluding the `mode` alias).

#### Define HTML with data attributes for inner cards:

- `data-atmos-opaque` keeps an element out of automatic glass or opacity treatment.
- `data-atmos-opacity="0.64"` applies a per-element opacity value.
- `data-atmos-glass` opts nested elements into the glass surface style.
- `data-atmos-collision` makes the element a top- and side-edge collision surface for foreground precipitation.
- `data-atmos-liquid-dripping="true"` toggles the water condensation and dripping animation (only in Rain mode).
- `data-atmos-liquid-gathering-point="0.5"` sets a card's liquid gathering point from `0.33` to `0.66`.

## Design & UI Guidelines

To ensure visually realistic atmosphere effects, here are some guidelines to follow when designing with `AtmosCard`:

- **Particle Layering & Dripping**: Particles are rendered in foreground and background layers. Foreground particles are blocked by collidable `AtmosCard` elements. If `liquidDripping` is enabled on a card, the accumulated rainwater will drip down and correctly collide with any collidable `AtmosCard`s positioned below it.
- **Width-aware Gathering**: Wider cards spend longer in Gathering (`1250ms + 2.8ms` per CSS pixel, capped at `5500ms`; `300px` takes `2090ms`). Later drip phases keep fixed durations.
- **Avoid Wide Blocking Cards**: A very wide collidable `AtmosCard` will act like an umbrella, blocking most of the foreground rain. This prevents rain from reaching the elements below it, significantly reducing their rain splash animations. Unless this "umbrella" effect is specifically intended, avoid overly wide collision surfaces.
- **Avoid Nesting Cards**: Unless you have a highly specific visual effect in mind, avoid nesting an `AtmosCard` directly inside another `AtmosCard`. This can cause conflicting collision bounds and visual behaviors that defy natural physics.
- **Card Modes (`transMode`)**:
  - `glass`: The default frosted glass effect, triggering high-fidelity backdrop blurs.
  - `opacity`: A translucent mode where the card relies on standard CSS opacity to blend with the weather background.
  - `solid`: Leaves the element with its default opaque style, allowing you to fully customize its appearance without library-applied transparency.

## Performance Notes

- Prefer `quality: 'auto'` for adaptive performance scaling. Container area changes particle count, but does not select the quality tier.
- Rendering defaults to WebGL, automatically falling back to a silent dummy Canvas 2D context if WebGL initialization fails.
- Transparent surfaces can reveal background-layer precipitation while foreground precipitation still collides with selected DOM surfaces.
- Keep collision surfaces intentional; target rects refresh outside the animation frame loop.
- Collision and dripping physics use the axis-aligned bounding box (AABB) of targeted elements. Rotated elements (e.g. using `transform: rotate()`) will have collisions calculated against their outer bounding rectangle rather than the rotated visual boundary.
- Snow and hail accumulation use bounded pools whose capacity scales with quality and density.
- Leave `respectReducedMotion` enabled in production.

## Development

```bash
npm install
npm run typecheck
npm run build
npm test
```

The current implementation includes the core lifecycle, WebGL rain, snow, and hail renderers, adaptive quality scaling, a silent dummy Canvas 2D fallback, glass orchestration, rounded top- and side-edge collision responses, rainwater gathering and dripping physics, two-dimensional snow and hail accumulation, and a static docs playground.

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
