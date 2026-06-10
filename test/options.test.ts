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
      }),
    ).toMatchObject({
      density: 1,
      speed: 0,
    })
  })
})
