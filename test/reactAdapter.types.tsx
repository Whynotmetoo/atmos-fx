import { createRef } from 'react'
import { AtmosFx, type AtmosFxProps } from '../src/react'

const rootRef = createRef<HTMLDivElement>()
const cleanupRef = (node: HTMLDivElement | null) => {
  if (!node) {
    return undefined
  }

  return () => undefined
}

export const reactAtmosFxProps: AtmosFxProps = {
  preset: 'rain',
  density: 0.7,
  wind: -0.2,
  quality: 'high',
  contentOpacity: 0.66,
  surfaceOpacity: 0.18,
  liquidGatheringPoint: 0.5,
  className: 'weather',
  role: 'region',
  'aria-label': 'Weather atmosphere',
}

export function ReactAdapterTypeSmoke() {
  return (
    <AtmosFx ref={rootRef} {...reactAtmosFxProps}>
      <section data-atmos-collision>
        <button data-atmos-opaque>Action</button>
      </section>
      <AtmosFx ref={cleanupRef} preset="rain" />
    </AtmosFx>
  )
}
