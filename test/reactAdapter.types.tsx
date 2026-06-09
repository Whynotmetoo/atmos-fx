import { createRef } from 'react'
import { Atmosphere, type AtmosphereProps } from '../src/react'

const rootRef = createRef<HTMLDivElement>()

export const reactAtmosphereProps: AtmosphereProps = {
  preset: 'storm',
  density: 0.7,
  wind: -0.2,
  quality: 'high',
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
    </Atmosphere>
  )
}
