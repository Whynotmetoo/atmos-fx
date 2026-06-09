# atoms-fx

DOM-aware atmosphere effects for creative interfaces.

atoms-fx is an early-stage TypeScript library for making weather-like visual effects part of the DOM instead of a detached background. The first target effect is Apple Weather-inspired precipitation where child UI can become glass, stay opaque, or act as collision surfaces.

## Planned Usage

```ts
import { createAtmosphere } from 'atoms-fx'
import 'atoms-fx/styles.css'

const controller = createAtmosphere(document.querySelector('#hero')!, {
  preset: 'rain',
  density: 0.7,
  wind: -0.15,
})

controller.start()
```

```tsx
import { useRef } from 'react'
import { Atmosphere } from 'atoms-fx/react'
import 'atoms-fx/styles.css'

export function WeatherPanel() {
  const rootRef = useRef<HTMLDivElement>(null)

  return (
    <Atmosphere ref={rootRef} preset="rain" density={0.7} className="weather-panel">
      <section data-atoms-collision>
        Rain can land on this surface and splash from the top edge.
      </section>
      <button data-atoms-opaque>Opaque action</button>
      <span data-atoms-opacity="0.64">Custom opacity</span>
    </Atmosphere>
  )
}
```

## DOM Controls

Import `atoms-fx/styles.css` to enable the default content integration styles.

- `data-atoms-opaque` keeps an element out of automatic glass or opacity treatment.
- `data-atoms-opacity="0.64"` applies a per-element opacity value.
- `data-atoms-glass` opts nested elements into the glass surface style.
- `data-atoms-collision` makes the element's top edge a rain collision surface.
- `transparency: 'glass' | 'opacity' | 'none'` controls the root integration mode.

## API Reference

`createAtmosphere(element, options)` returns a controller with `start()`, `stop()`, `pause()`, `resume()`, `resize()`, `update(options)`, and `destroy()`.

Core options:

- `preset`: `'rain' | 'storm' | 'snow'`
- `density`: `0` to `1`
- `speed`: non-negative motion scalar
- `wind`: horizontal motion scalar, usually `-1` to `1`
- `color`: Canvas color string
- `quality`: `'auto' | 'low' | 'medium' | 'high'`
- `transparency`: `'glass' | 'opacity' | 'none'`
- `collisionSelector`: selector for rain landing surfaces
- `opaqueSelector`: selector for solid child controls
- `pauseWhenHidden` and `respectReducedMotion`: production performance/accessibility toggles

React is available from `atoms-fx/react`:

```tsx
<Atmosphere preset="snow" density={0.5} />
```

## Performance Notes

- Prefer `quality: 'auto'` for responsive pages.
- Keep collision surfaces intentional; target rects refresh outside the animation frame loop.
- Leave `respectReducedMotion` enabled in production.
- Use `controller.destroy()` when removing an atmosphere root outside React.

## Development

```bash
npm install
npm run typecheck
npm run build
npm test
```

The current implementation includes the project foundation, the core lifecycle shell, Canvas 2D rain and snow renderers with particle budgeting, glass orchestration, top-edge collision splashes for rain, and a static docs playground.

## Local Smoke Test

After building, open the weather smoke example:

```bash
npm run build
npx vite --host 127.0.0.1 --port 4173
```

Then visit `http://127.0.0.1:4173/examples/rain.html` and use the preset switcher to compare rain, storm, and snow.

The React adapter smoke page is available at `http://127.0.0.1:4173/examples/react.html`.

The interactive docs playground is available at `http://127.0.0.1:4173/docs/`.
