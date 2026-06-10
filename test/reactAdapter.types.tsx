import { createRef } from 'react'
import { Atmosphere, type AtmosphereProps } from '../src/react'

const rootRef = createRef<HTMLDivElement>()
const cleanupRef = (node: HTMLDivElement | null) => {
  if (!node) {
    return undefined
  }

  return () => undefined
}

export const reactAtmosphereProps: AtmosphereProps = {
  preset: 'storm',
  density: 0.7,
  wind: -0.2,
  quality: 'high',
  contentOpacity: 0.66,
  surfaceOpacity: 0.18,
  snowAccumulation: 0.6,
  className: 'weather',
  role: 'region',
  'aria-label': 'Weather atmosphere',
}

export function ReactAdapterTypeSmoke() {
  return (
    <Atmosphere ref={rootRef} {...reactAtmosphereProps}>
      <section data-atoms-collision>
        <button data-atoms-opaque>Action</button>
      </section>
      <Atmosphere ref={cleanupRef} preset="rain" />
    </Atmosphere>
  )
}
