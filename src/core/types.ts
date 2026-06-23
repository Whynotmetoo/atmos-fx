export type AtmospherePreset = 'rain' | 'snow' | 'hail'

export type AtmosphereParticle = 'rain' | 'snow' | 'hail'

export type AtmosphereQuality = 'auto' | 'low' | 'medium' | 'high'

export type TransparencyMode = 'glass' | 'opacity' | 'none'

export type AtmosphereOptions = {
  preset?: AtmospherePreset
  particle?: AtmosphereParticle
  density?: number
  speed?: number
  wind?: number
  color?: string
  quality?: AtmosphereQuality
  transparency?: TransparencyMode
  contentOpacity?: number
  surfaceOpacity?: number
  bottomCollision?: boolean
  collisionSelector?: string
  opaqueSelector?: string
  pauseWhenHidden?: boolean
  respectReducedMotion?: boolean
  liquidDripping?: boolean
  liquidGatheringPoint?: number
  injectStyles?: boolean
  styleNonce?: string
  autoScaleQuality?: boolean
}

export type NormalizedAtmosphereOptions = Required<
  Omit<AtmosphereOptions, 'liquidGatheringPoint'>
> & Pick<AtmosphereOptions, 'liquidGatheringPoint'> & {
  snowAccumulation: number
  hailBounce: number
}

export type AtmosphereController = {
  start(): void
  stop(): void
  pause(): void
  resume(): void
  resize(): void
  update(options: Partial<AtmosphereOptions>): void
  destroy(): void
}
