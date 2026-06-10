import { describe, expect, it } from 'vitest'
import { normalizeAtmosphereOptions } from '../src/core/options'

describe('normalizeAtmosphereOptions', () => {
  it('applies rain defaults', () => {
    expect(normalizeAtmosphereOptions()).toMatchObject({
      preset: 'rain',
      particle: 'rain',
      density: 0.65,
      quality: 'auto',
      transparency: 'glass',
      contentOpacity: 0.72,
      surfaceOpacity: 0.14,
      snowAccumulation: 0.55,
      rainDripping: 0.5,
      hailBounce: 0.5,
      bottomCollision: false,
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
      particle: 'snow',
      density: 0.2,
    })
  })

  it('applies hail preset defaults', () => {
    expect(normalizeAtmosphereOptions({ preset: 'hail' })).toMatchObject({
      preset: 'hail',
      particle: 'hail',
      density: 0.46,
      hailBounce: 0.5,
    })
  })

  it('clamps density and speed to safe ranges', () => {
    expect(
      normalizeAtmosphereOptions({
        density: 2,
        speed: -1,
        contentOpacity: 2,
        surfaceOpacity: -1,
        snowAccumulation: 2,
        rainDripping: 2,
        hailBounce: -1,
      }),
    ).toMatchObject({
      density: 1,
      contentOpacity: 1,
      surfaceOpacity: 0,
      snowAccumulation: 1,
      rainDripping: 1,
      hailBounce: 0,
      speed: 0,
    })
  })

  it('falls back when optional numeric options are explicitly undefined', () => {
    expect(
      normalizeAtmosphereOptions({
        density: undefined,
        speed: undefined,
        contentOpacity: undefined,
        surfaceOpacity: undefined,
        snowAccumulation: undefined,
        rainDripping: undefined,
        hailBounce: undefined,
      }),
    ).toMatchObject({
      density: 0.65,
      contentOpacity: 0.72,
      surfaceOpacity: 0.14,
      snowAccumulation: 0.55,
      rainDripping: 0.5,
      hailBounce: 0.5,
      speed: 1,
    })
  })
})
