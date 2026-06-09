import type { AtmosphereQuality } from '../../core/types'

export type RainBudgetInput = {
  width: number
  height: number
  density: number
  quality: AtmosphereQuality
}

const REFERENCE_AREA = 1280 * 720

const QUALITY_BASE = {
  low: 240,
  medium: 560,
  high: 950,
} satisfies Record<Exclude<AtmosphereQuality, 'auto'>, number>

const QUALITY_LIMITS = {
  low: { min: 40, max: 300 },
  medium: { min: 80, max: 800 },
  high: { min: 120, max: 1200 },
} satisfies Record<Exclude<AtmosphereQuality, 'auto'>, { min: number; max: number }>

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function resolveAutoQuality(width: number, height: number): Exclude<AtmosphereQuality, 'auto'> {
  const area = width * height

  if (width < 520 || height < 420 || area < 320_000) {
    return 'low'
  }

  if (area < 1_100_000) {
    return 'medium'
  }

  return 'high'
}

export function calculateRainParticleBudget({
  width,
  height,
  density,
  quality,
}: RainBudgetInput): number {
  if (width <= 0 || height <= 0 || density <= 0) {
    return 0
  }

  const resolvedQuality = quality === 'auto' ? resolveAutoQuality(width, height) : quality
  const areaScale = Math.sqrt((width * height) / REFERENCE_AREA)
  const densityScale = 0.25 + clamp(density, 0, 1) * 0.75
  const limits = QUALITY_LIMITS[resolvedQuality]
  const budget = Math.round(QUALITY_BASE[resolvedQuality] * areaScale * densityScale)

  return clamp(budget, limits.min, limits.max)
}
