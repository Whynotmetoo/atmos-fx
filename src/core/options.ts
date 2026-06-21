import { DEFAULT_OPTIONS, resolvePresetOptions } from './presets'
import type { AtmosphereOptions, NormalizedAtmosphereOptions } from './types'

function clamp01(value: number | undefined, fallback: number): number {
  if (value === undefined || Number.isNaN(value)) {
    return fallback
  }

  return Math.min(1, Math.max(0, value))
}

function clampOptional(
  value: number | undefined,
  minimum: number,
  maximum: number,
): number | undefined {
  if (value === undefined || Number.isNaN(value)) {
    return undefined
  }

  return Math.min(maximum, Math.max(minimum, value))
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
    snowAccumulation: clamp01(merged.snowAccumulation, DEFAULT_OPTIONS.snowAccumulation),
    hailBounce: clamp01(merged.hailBounce, DEFAULT_OPTIONS.hailBounce),
    bottomCollision: merged.bottomCollision ?? DEFAULT_OPTIONS.bottomCollision,
    speed: Math.max(0, merged.speed ?? DEFAULT_OPTIONS.speed),
    liquidDripping: merged.liquidDripping ?? DEFAULT_OPTIONS.liquidDripping,
    liquidGatheringPoint: clampOptional(merged.liquidGatheringPoint, 0.33, 0.66),
    injectStyles: merged.injectStyles ?? DEFAULT_OPTIONS.injectStyles,
    styleNonce: merged.styleNonce ?? DEFAULT_OPTIONS.styleNonce,
  }
}
