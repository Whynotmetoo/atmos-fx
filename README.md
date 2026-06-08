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
import { Atmosphere } from 'atoms-fx/react'
import 'atoms-fx/styles.css'

export function WeatherPanel() {
  return (
    <Atmosphere preset="rain" density={0.7}>
      <section data-atoms-collision>
        Rain can eventually land on this surface.
      </section>
      <button data-atoms-opaque>Opaque action</button>
    </Atmosphere>
  )
}
```

## Development

```bash
npm install
npm run typecheck
npm run build
npm test
```

The current implementation includes the project foundation plus the core lifecycle shell: canvas layer management, start/stop/pause/resume/update/destroy behavior, visibility pausing, and reduced-motion handling. Weather rendering, glass orchestration, collision, and docs playground work will land in focused follow-up PRs.
