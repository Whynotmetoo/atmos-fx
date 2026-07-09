export type AtmospherePreset = 'rain' | 'snow' | 'hail'

export type AtmosphereQuality = 'auto' | 'low' | 'medium' | 'high'

export type AtmosphereOptions = {
  preset?: AtmospherePreset
  density?: number
  speed?: number
  wind?: number
  color?: string
  quality?: AtmosphereQuality
  opacity?: number
  alpha?: number
  bottomCollision?: boolean
  pauseWhenHidden?: boolean
  respectReducedMotion?: boolean
  liquidDripping?: boolean
  injectStyles?: boolean
  styleNonce?: string
}

export type NormalizedAtmosphereOptions = Required<AtmosphereOptions> & {
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
