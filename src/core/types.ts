export type AtmospherePreset = 'rain' | 'storm' | 'snow' | 'hail'

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
  collisionSelector?: string
  opaqueSelector?: string
  pauseWhenHidden?: boolean
  respectReducedMotion?: boolean
}

export type NormalizedAtmosphereOptions = Required<AtmosphereOptions>

export type AtmosphereController = {
  start(): void
  stop(): void
  pause(): void
  resume(): void
  resize(): void
  update(options: Partial<AtmosphereOptions>): void
  destroy(): void
}
