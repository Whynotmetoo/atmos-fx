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

  it('scales density continuously from zero', () => {
    const input = {
      width: 1280,
      height: 720,
      quality: 'high' as const,
    }

    expect(calculateRainParticleBudget({ ...input, density: 0 })).toBe(0)
    expect(calculateRainParticleBudget({ ...input, density: 0.001 })).toBe(2)
    expect(calculateRainParticleBudget({ ...input, density: 0.01 })).toBe(15)
    expect(calculateRainParticleBudget({ ...input, density: 0.5 })).toBe(750)
    expect(calculateRainParticleBudget({ ...input, density: 1 })).toBe(1500)
  })

  it('keeps particle density proportional to container area before caps', () => {
    const halfAreaBudget = calculateRainParticleBudget({
      width: 640,
      height: 720,
      density: 0.5,
      quality: 'high',
    })
    const referenceAreaBudget = calculateRainParticleBudget({
      width: 1280,
      height: 720,
      density: 0.5,
      quality: 'high',
    })

    expect(halfAreaBudget).toBe(375)
    expect(referenceAreaBudget).toBe(750)
  })

  it('uses the configured base rates at the reference area', () => {
    const input = { width: 1280, height: 720, density: 1 }
    const qualities = ['low', 'medium', 'high'] as const

    expect(
      qualities.map((quality) => calculateRainParticleBudget({ ...input, quality })),
    ).toEqual([375, 875, 1500])
    expect(
      qualities.map((quality) => calculateSnowParticleBudget({ ...input, quality })),
    ).toEqual([250, 625, 1125])
    expect(
      qualities.map((quality) => calculateHailParticleBudget({ ...input, quality })),
    ).toEqual([125, 275, 500])
    expect(
      qualities.map((quality) => calculateAccumulationBudget({ ...input, quality })),
    ).toEqual([90, 180, 360])
  })

  it('keeps mobile auto budgets in the low-quality range', () => {
    const budget = calculateRainParticleBudget({
      width: 390,
      height: 844,
      density: 0.8,
      quality: 'auto',
    })

    expect(budget).toBeGreaterThanOrEqual(80)
    expect(budget).toBeLessThanOrEqual(1200)
  })

  it('caps high-quality desktop budgets', () => {
    expect(
      calculateRainParticleBudget({
        width: 8000,
        height: 6000,
        density: 1,
        quality: 'high',
      }),
    ).toBe(8000)
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
    expect(highDensityBudget).toBeLessThanOrEqual(2500)
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
    ).toBe(500)
  })
})
