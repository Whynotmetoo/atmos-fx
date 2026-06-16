import { describe, expect, it } from 'vitest'
import {
  calculateAccumulationBudget,
  calculateHailParticleBudget,
  calculateRainParticleBudget,
  calculateSnowParticleBudget,
  resolveAutoQuality,
} from '../src/renderers/canvas2d/quality'

describe('canvas rain quality budgets', () => {
  it('uses low auto quality for small containers', () => {
    expect(resolveAutoQuality(390, 844)).toBe('low')
    expect(resolveAutoQuality(1440, 900)).toBe('high')
  })

  it('returns no particles for empty or disabled rain', () => {
    expect(
      calculateRainParticleBudget({
        width: 0,
        height: 600,
        density: 0.8,
        quality: 'auto',
      }),
    ).toBe(0)

    expect(
      calculateRainParticleBudget({
        width: 800,
        height: 600,
        density: 0,
        quality: 'auto',
      }),
    ).toBe(0)
  })

  it('keeps mobile auto budgets in the low-quality range', () => {
    const budget = calculateRainParticleBudget({
      width: 390,
      height: 844,
      density: 0.8,
      quality: 'auto',
    })

    expect(budget).toBeGreaterThanOrEqual(80)
    expect(budget).toBeLessThanOrEqual(800)
  })

  it('caps high-quality desktop budgets', () => {
    expect(
      calculateRainParticleBudget({
        width: 8000,
        height: 6000,
        density: 1,
        quality: 'high',
      }),
    ).toBe(5000)
  })

  it('budgets snow independently from rain density', () => {
    const lowDensityBudget = calculateSnowParticleBudget({
      width: 800,
      height: 600,
      density: 0.2,
      quality: 'medium',
    })
    const highDensityBudget = calculateSnowParticleBudget({
      width: 800,
      height: 600,
      density: 1,
      quality: 'medium',
    })

    expect(lowDensityBudget).toBeGreaterThan(0)
    expect(highDensityBudget).toBeGreaterThan(lowDensityBudget)
    expect(highDensityBudget).toBeLessThanOrEqual(1500)
  })

  it('keeps hail budgets lower than rain for heavier particles', () => {
    const rainBudget = calculateRainParticleBudget({
      width: 800,
      height: 600,
      density: 0.8,
      quality: 'medium',
    })
    const hailBudget = calculateHailParticleBudget({
      width: 800,
      height: 600,
      density: 0.8,
      quality: 'medium',
    })

    expect(hailBudget).toBeGreaterThan(0)
    expect(hailBudget).toBeLessThan(rainBudget)
  })

  it('caps accumulation separately from moving particle budgets', () => {
    expect(
      calculateAccumulationBudget({
        width: 2560,
        height: 1440,
        density: 1,
        quality: 'high',
      }),
    ).toBe(220)
  })
})
