import { describe, expect, it } from 'vitest'
import { normalizeAtmosphereOptions } from '../src/core/options'

describe('normalizeAtmosphereOptions', () => {
  it('applies rain defaults', () => {
    expect(normalizeAtmosphereOptions()).toMatchObject({
      preset: 'rain',
      density: 0.65,
      quality: 'auto',
      opacity: 0.1,
      alpha: 0.12,
      snowAccumulation: 0.55,
      hailBounce: 0.5,
      bottomCollision: true,
      liquidDripping: true,
      liquidGatheringPoint: undefined,
    })
  })

  it('applies preset defaults before user overrides', () => {
    expect(
      normalizeAtmosphereOptions({
        preset: 'snow',
        density: 0.2,
      }),
    ).toMatchObject({
      preset: 'snow',
      density: 0.2,
      liquidDripping: false,
    })
  })

  it('applies hail preset defaults', () => {
    expect(normalizeAtmosphereOptions({ preset: 'hail' })).toMatchObject({
      preset: 'hail',
      density: 0.46,
      hailBounce: 0.5,
      liquidDripping: false,
    })
  })

  it('clamps density and speed to safe ranges', () => {
    expect(
      normalizeAtmosphereOptions({
        density: 2,
        speed: -1,
        opacity: 2,
        alpha: -1,
        snowAccumulation: 2,
        hailBounce: -1,
      } as any),
    ).toMatchObject({
      density: 1,
      opacity: 1,
      alpha: 0,
      snowAccumulation: 1,
      hailBounce: 0,
      speed: 0,
    })
  })

  it('falls back when optional numeric options are explicitly undefined', () => {
    expect(
      normalizeAtmosphereOptions({
        density: undefined,
        speed: undefined,
        opacity: undefined,
        alpha: undefined,
        snowAccumulation: undefined,
        hailBounce: undefined,
      } as any),
    ).toMatchObject({
      density: 0.65,
      opacity: 0.1,
      alpha: 0.12,
      snowAccumulation: 0.55,
      hailBounce: 0.5,
      speed: 1,
    })
  })

  it('clamps an explicit liquid gathering point while preserving random-by-default behavior', () => {
    expect(normalizeAtmosphereOptions().liquidGatheringPoint).toBeUndefined()
    expect(
      normalizeAtmosphereOptions({ liquidGatheringPoint: 0.2 })
        .liquidGatheringPoint,
    ).toBe(0.33)
    expect(
      normalizeAtmosphereOptions({ liquidGatheringPoint: 0.8 })
        .liquidGatheringPoint,
    ).toBe(0.66)
    expect(
      normalizeAtmosphereOptions({ liquidGatheringPoint: 0.5 })
        .liquidGatheringPoint,
    ).toBe(0.5)
  })
})
