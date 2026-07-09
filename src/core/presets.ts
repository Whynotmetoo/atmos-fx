import type { AtmosphereOptions, AtmospherePreset } from './types'

export const DEFAULT_OPTIONS = {
  preset: 'rain',
  density: 0.585,
  speed: 1,
  wind: -0.12,
  color: 'rgba(220, 235, 255, 0.72)',
  quality: 'auto',
  opacity: 0.1,
  alpha: 0.12,
  snowAccumulation: 0.55,
  hailBounce: 0.5,
  bottomCollision: true,
  pauseWhenHidden: true,
  respectReducedMotion: true,
  liquidDripping: true,
  liquidGatheringPoint: undefined,
  injectStyles: true,
  styleNonce: '',
} satisfies Required<Omit<AtmosphereOptions, 'liquidGatheringPoint'>> &
  Pick<AtmosphereOptions, 'liquidGatheringPoint'> & {
    snowAccumulation: number
    hailBounce: number
  }

export const PRESET_OPTIONS = {
  rain: {
    density: 0.585,
    speed: 1,
    wind: -0.12,
    color: 'rgba(220, 235, 255, 0.72)',
    liquidDripping: true,
  },
  snow: {
    density: 0.5,
    speed: 0.42,
    wind: 0.16,
    color: 'rgba(245, 250, 255, 0.86)',
    liquidDripping: false,
  },
  hail: {
    density: 0.46,
    speed: 0.92,
    wind: -0.08,
    color: 'rgba(218, 235, 247, 0.84)',
    hailBounce: 0.5,
    liquidDripping: false,
  },
} satisfies Record<
  AtmospherePreset,
  Partial<AtmosphereOptions> & {
    snowAccumulation?: number
    hailBounce?: number
  }
>

export function resolvePresetOptions(preset: AtmospherePreset): Partial<AtmosphereOptions> {
  return PRESET_OPTIONS[preset]
}
