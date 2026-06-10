import { DEFAULT_OPTIONS, resolvePresetOptions } from './presets'
import type { AtmosphereOptions, NormalizedAtmosphereOptions } from './types'

function clamp01(value: number, fallback: number): number {
  if (Number.isNaN(value)) {
    return fallback
  }

  return Math.min(1, Math.max(0, value))
}

export function normalizeAtmosphereOptions(
  options: AtmosphereOptions = {},
): NormalizedAtmosphereOptions {
  const preset = options.preset ?? DEFAULT_OPTIONS.preset
  const presetOptions = resolvePresetOptions(preset)
  const merged = {
    ...DEFAULT_OPTIONS,
    ...presetOptions,
    ...options,
    preset,
  }

  return {
    ...merged,
    density: clamp01(merged.density, DEFAULT_OPTIONS.density),
    contentOpacity: clamp01(merged.contentOpacity, DEFAULT_OPTIONS.contentOpacity),
    surfaceOpacity: clamp01(merged.surfaceOpacity, DEFAULT_OPTIONS.surfaceOpacity),
    speed: Math.max(0, merged.speed),
  }
}
