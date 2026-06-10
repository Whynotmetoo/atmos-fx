import type { AtmosphereOptions, AtmospherePreset } from './types'

export const DEFAULT_OPTIONS = {
  preset: 'rain',
  particle: 'rain',
  density: 0.65,
  speed: 1,
  wind: -0.12,
  color: 'rgba(220, 235, 255, 0.72)',
  quality: 'auto',
  transparency: 'glass',
  collisionSelector: '[data-atoms-collision]',
  opaqueSelector: '[data-atoms-opaque]',
  pauseWhenHidden: true,
  respectReducedMotion: true,
} satisfies Required<AtmosphereOptions>

export const PRESET_OPTIONS = {
  rain: {
    particle: 'rain',
    density: 0.65,
    speed: 1,
    wind: -0.12,
    color: 'rgba(220, 235, 255, 0.72)',
  },
  storm: {
    particle: 'rain',
    density: 0.9,
    speed: 1.25,
    wind: -0.28,
    color: 'rgba(210, 228, 255, 0.8)',
  },
  snow: {
    particle: 'snow',
    density: 0.5,
    speed: 0.42,
    wind: 0.16,
    color: 'rgba(245, 250, 255, 0.86)',
  },
  hail: {
    particle: 'hail',
    density: 0.46,
    speed: 0.92,
    wind: -0.08,
    color: 'rgba(218, 235, 247, 0.84)',
  },
} satisfies Record<AtmospherePreset, Partial<AtmosphereOptions>>

export function resolvePresetOptions(preset: AtmospherePreset): Partial<AtmosphereOptions> {
  return PRESET_OPTIONS[preset]
}
