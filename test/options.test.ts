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
      }),
    ).toMatchObject({
      density: 1,
      contentOpacity: 1,
      surfaceOpacity: 0,
      snowAccumulation: 1,
      speed: 0,
    })
  })
})
