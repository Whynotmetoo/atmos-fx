import type { AtmosphereQuality } from '../../core/types'

export type ParticleBudgetInput = {
  width: number
  height: number
  density: number
  quality: AtmosphereQuality
}

const REFERENCE_AREA = 1280 * 720

const QUALITY_BASE = {
  low: 300,
  medium: 700,
  high: 1200,
} satisfies Record<Exclude<AtmosphereQuality, 'auto'>, number>

const SNOW_QUALITY_BASE = {
  low: 200,
  medium: 500,
  high: 900,
} satisfies Record<Exclude<AtmosphereQuality, 'auto'>, number>

const HAIL_QUALITY_BASE = {
  low: 100,
  medium: 220,
  high: 400,
} satisfies Record<Exclude<AtmosphereQuality, 'auto'>, number>

const QUALITY_LIMITS = {
  low: { min: 40, max: 1200 },
  medium: { min: 80, max: 3000 },
  high: { min: 120, max: 8000 },
} satisfies Record<Exclude<AtmosphereQuality, 'auto'>, { min: number; max: number }>

const SNOW_QUALITY_LIMITS = {
  low: { min: 32, max: 1000 },
  medium: { min: 72, max: 2500 },
  high: { min: 110, max: 6000 },
} satisfies Record<Exclude<AtmosphereQuality, 'auto'>, { min: number; max: number }>

const HAIL_QUALITY_LIMITS = {
  low: { min: 18, max: 500 },
  medium: { min: 36, max: 1200 },
  high: { min: 54, max: 3000 },
} satisfies Record<Exclude<AtmosphereQuality, 'auto'>, { min: number; max: number }>

const ACCUMULATION_QUALITY_LIMITS = {
  low: { min: 24, max: 70 },
  medium: { min: 40, max: 130 },
  high: { min: 60, max: 220 },
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
}: ParticleBudgetInput): number {
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

export function calculateSnowParticleBudget({
  width,
  height,
  density,
  quality,
}: ParticleBudgetInput): number {
  if (width <= 0 || height <= 0 || density <= 0) {
    return 0
  }

  const resolvedQuality = quality === 'auto' ? resolveAutoQuality(width, height) : quality
  const areaScale = Math.sqrt((width * height) / REFERENCE_AREA)
  const densityScale = 0.2 + clamp(density, 0, 1) * 0.8
  const limits = SNOW_QUALITY_LIMITS[resolvedQuality]
  const budget = Math.round(SNOW_QUALITY_BASE[resolvedQuality] * areaScale * densityScale)

  return clamp(budget, limits.min, limits.max)
}

export function calculateHailParticleBudget({
  width,
  height,
  density,
  quality,
}: ParticleBudgetInput): number {
  if (width <= 0 || height <= 0 || density <= 0) {
    return 0
  }

  const resolvedQuality = quality === 'auto' ? resolveAutoQuality(width, height) : quality
  const areaScale = Math.sqrt((width * height) / REFERENCE_AREA)
  const densityScale = 0.18 + clamp(density, 0, 1) * 0.82
  const limits = HAIL_QUALITY_LIMITS[resolvedQuality]
  const budget = Math.round(HAIL_QUALITY_BASE[resolvedQuality] * areaScale * densityScale)

  return clamp(budget, limits.min, limits.max)
}

export function calculateAccumulationBudget({
  width,
  height,
  density,
  quality,
}: ParticleBudgetInput): number {
  if (width <= 0 || height <= 0 || density <= 0) {
    return 0
  }

  const resolvedQuality = quality === 'auto' ? resolveAutoQuality(width, height) : quality
  const areaScale = Math.sqrt((width * height) / REFERENCE_AREA)
  const densityScale = 0.25 + clamp(density, 0, 1) * 0.75
  const limits = ACCUMULATION_QUALITY_LIMITS[resolvedQuality]
  const base = resolvedQuality === 'low' ? 52 : resolvedQuality === 'medium' ? 96 : 168
  const budget = Math.round(base * areaScale * densityScale)

  return clamp(budget, limits.min, limits.max)
}
