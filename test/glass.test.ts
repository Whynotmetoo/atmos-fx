import { describe, expect, it } from 'vitest'
import { DEFAULT_OPTIONS } from '../src/core/presets'
import type { NormalizedAtmosphereOptions } from '../src/core/types'
import { createGlassController } from '../src/dom/glass'

function createOptions(
  options: Partial<NormalizedAtmosphereOptions> = {},
): NormalizedAtmosphereOptions {
  return {
    ...DEFAULT_OPTIONS,
    ...options,
  }
}

describe('createGlassController', () => {
  it('syncs configurable root opacity and alpha CSS variables', () => {
    const root = document.createElement('section')
    const controller = createGlassController(root)

    controller.sync(createOptions({ opacity: 0.48, alpha: 0.2 }))

    expect(root.style.getPropertyValue('--atmos-fx-opacity')).toBe('0.48')
    expect(root.style.getPropertyValue('--atmos-fx-alpha')).toBe('0.2')

    controller.destroy()

    expect(root.style.getPropertyValue('--atmos-fx-opacity')).toBe('')
    expect(root.style.getPropertyValue('--atmos-fx-alpha')).toBe('')
  })

  it('maps data-atmos-opacity values into CSS variables', () => {
    const root = document.createElement('section')
    const child = document.createElement('div')
    child.dataset.atmosOpacity = '0.42'
    root.append(child)

    const controller = createGlassController(root)
    controller.sync(createOptions())

    expect(child.style.getPropertyValue('--atmos-fx-opacity')).toBe('0.42')

    child.dataset.atmosOpacity = '2'
    controller.sync(createOptions())

    expect(child.style.getPropertyValue('--atmos-fx-opacity')).toBe('1')

    delete child.dataset.atmosOpacity
    controller.sync(createOptions())

    expect(child.style.getPropertyValue('--atmos-fx-opacity')).toBe('')
  })

  it('maps data-atmos-alpha values into CSS variables', () => {
    const root = document.createElement('section')
    const child = document.createElement('div')
    child.dataset.atmosAlpha = '0.15'
    root.append(child)

    const controller = createGlassController(root)
    controller.sync(createOptions())

    expect(child.style.getPropertyValue('--atmos-fx-alpha')).toBe('0.15')

    child.dataset.atmosAlpha = '-0.5'
    controller.sync(createOptions())

    expect(child.style.getPropertyValue('--atmos-fx-alpha')).toBe('0')

    delete child.dataset.atmosAlpha
    controller.sync(createOptions())

    expect(child.style.getPropertyValue('--atmos-fx-alpha')).toBe('')
  })

})
