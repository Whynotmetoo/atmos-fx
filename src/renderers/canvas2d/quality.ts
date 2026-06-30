import type { AtmosphereQuality } from '../../core/types'

export type ParticleBudgetInput = {
  width: number
  height: number
  density: number
  quality: AtmosphereQuality
}

const REFERENCE_AREA = 1280 * 720

const QUALITY_BASE = {
  low: 375,
  medium: 875,
  high: 1500,
} satisfies Record<Exclude<AtmosphereQuality, 'auto'>, number>

const SNOW_QUALITY_BASE = {
  low: 250,
  medium: 625,
  high: 1125,
} satisfies Record<Exclude<AtmosphereQuality, 'auto'>, number>

const HAIL_QUALITY_BASE = {
  low: 125,
  medium: 275,
  high: 500,
} satisfies Record<Exclude<AtmosphereQuality, 'auto'>, number>

const QUALITY_MAX = {
  low: 1200,
  medium: 3000,
  high: 8000,
} satisfies Record<Exclude<AtmosphereQuality, 'auto'>, number>

const SNOW_QUALITY_MAX = {
  low: 1000,
  medium: 2500,
  high: 6000,
} satisfies Record<Exclude<AtmosphereQuality, 'auto'>, number>

const HAIL_QUALITY_MAX = {
  low: 500,
  medium: 1200,
  high: 3000,
} satisfies Record<Exclude<AtmosphereQuality, 'auto'>, number>

const ACCUMULATION_QUALITY_MAX = {
  low: 120,
  medium: 240,
  high: 500,
} satisfies Record<Exclude<AtmosphereQuality, 'auto'>, number>

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function resolveBudgetQuality(quality: AtmosphereQuality): Exclude<AtmosphereQuality, 'auto'> {
  // Controllers normally resolve auto before reaching a renderer. Keep direct
  // budget calls aligned with auto's medium starting tier.
  return quality === 'auto' ? 'medium' : quality
}

function calculateAreaScaledBudget(
  width: number,
  height: number,
  density: number,
  base: number,
  maximum: number,
): number {
  if (width <= 0 || height <= 0 || density <= 0) {
    return 0
  }

  const areaScale = (width * height) / REFERENCE_AREA
  const densityScale = clamp(density, 0, 1)
  const budget = Math.round(base * areaScale * densityScale)

  return clamp(budget, 0, maximum)
}

export function calculateRainParticleBudget({
  width,
  height,
  density,
  quality,
}: ParticleBudgetInput): number {
  const resolvedQuality = resolveBudgetQuality(quality)

  return calculateAreaScaledBudget(
    width,
    height,
    density,
    QUALITY_BASE[resolvedQuality],
    QUALITY_MAX[resolvedQuality],
  )
}

export function calculateSnowParticleBudget({
  width,
  height,
  density,
  quality,
}: ParticleBudgetInput): number {
  const resolvedQuality = resolveBudgetQuality(quality)

  return calculateAreaScaledBudget(
    width,
    height,
    density,
    SNOW_QUALITY_BASE[resolvedQuality],
    SNOW_QUALITY_MAX[resolvedQuality],
  )
}

export function calculateHailParticleBudget({
  width,
  height,
  density,
  quality,
}: ParticleBudgetInput): number {
  const resolvedQuality = resolveBudgetQuality(quality)

  return calculateAreaScaledBudget(
    width,
    height,
    density,
    HAIL_QUALITY_BASE[resolvedQuality],
    HAIL_QUALITY_MAX[resolvedQuality],
  )
}

export function calculateAccumulationBudget({
  width,
  height,
  density,
  quality,
}: ParticleBudgetInput): number {
  const resolvedQuality = resolveBudgetQuality(quality)
  const base = resolvedQuality === 'low' ? 90 : resolvedQuality === 'medium' ? 180 : 360

  return calculateAreaScaledBudget(
    width,
    height,
    density,
    base,
    ACCUMULATION_QUALITY_MAX[resolvedQuality],
  )
}
