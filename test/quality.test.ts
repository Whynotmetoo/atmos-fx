import { describe, expect, it } from 'vitest'
import {
  calculateRainParticleBudget,
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
    expect(budget).toBeLessThanOrEqual(300)
  })

  it('caps high-quality desktop budgets', () => {
    expect(
      calculateRainParticleBudget({
        width: 2560,
        height: 1440,
        density: 1,
        quality: 'high',
      }),
    ).toBe(1200)
  })
})
