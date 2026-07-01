import { describe, expect, it, vi } from 'vitest'
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
  it('syncs root transparency state', () => {
    const root = document.createElement('section')
    const controller = createGlassController(root)

    controller.sync(createOptions({ transparency: 'glass' }))
    expect(root.dataset.atmosTransparency).toBe('glass')

    controller.sync(createOptions({ transparency: 'opacity' }))
    expect(root.dataset.atmosTransparency).toBe('opacity')

    controller.destroy()
    expect(root.dataset.atmosTransparency).toBeUndefined()
  })

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

  it('manages custom solid selector attributes without removing user attributes', () => {
    const root = document.createElement('section')
    const managed = document.createElement('div')
    const explicit = document.createElement('div')
    managed.className = 'solid'
    explicit.className = 'solid'
    explicit.dataset.atmosSolid = ''
    root.append(managed, explicit)

    const controller = createGlassController(root)
    controller.sync(createOptions({ solidSelector: '.solid' }))

    expect(managed.dataset.atmosSolid).toBe('managed')
    expect(explicit.dataset.atmosSolid).toBe('')

    managed.className = ''
    controller.sync(createOptions({ solidSelector: '.solid' }))

    expect(managed.dataset.atmosSolid).toBeUndefined()

    controller.destroy()
    expect(explicit.dataset.atmosSolid).toBe('')
  })

  it('observes attribute changes used by custom solid selectors', () => {
    let observerCallback: MutationCallback | undefined

    class MockMutationObserver {
      observe = vi.fn()
      disconnect = vi.fn()

      constructor(callback: MutationCallback) {
        observerCallback = callback
      }
    }

    Object.defineProperty(window, 'MutationObserver', {
      configurable: true,
      value: MockMutationObserver,
    })

    const root = document.createElement('section')
    const child = document.createElement('button')
    root.append(child)

    const controller = createGlassController(root)
    controller.sync(createOptions({ solidSelector: '[data-solid]' }))

    expect(child.dataset.atmosSolid).toBeUndefined()

    child.dataset.solid = ''
    observerCallback?.([], {} as MutationObserver)

    expect(child.dataset.atmosSolid).toBe('managed')

    delete child.dataset.solid
    observerCallback?.([], {} as MutationObserver)

    expect(child.dataset.atmosSolid).toBeUndefined()
  })


  it('manages data-atmos-solid="managed" attribute dynamically', () => {
    const root = document.createElement('section')
    const firstTarget = document.createElement('article')
    const secondTarget = document.createElement('aside')
    root.append(firstTarget, secondTarget)
    firstTarget.dataset.atmosSolid = 'custom'
    secondTarget.className = 'solid'

    const controller = createGlassController(root)
    controller.sync(createOptions({ solidSelector: '[data-atmos-solid], .solid' }))

    // The element matching [data-atmos-solid] should keep its original attribute
    expect(firstTarget.dataset.atmosSolid).toBe('custom')
    // The element matching .solid should get "managed"
    expect(secondTarget.dataset.atmosSolid).toBe('managed')

    // Change options to only match the original selector
    controller.sync(createOptions({ solidSelector: '[data-atmos-solid]' }))
    // .solid element should lose the managed attribute
    expect(secondTarget.dataset.atmosSolid).toBeUndefined()
    expect(firstTarget.dataset.atmosSolid).toBe('custom')

    // Add .solid back
    controller.sync(createOptions({ solidSelector: '.solid' }))
    expect(secondTarget.dataset.atmosSolid).toBe('managed')

    // Destroy the controller
    controller.destroy()
    // It should clean up the managed attribute
    expect(secondTarget.dataset.atmosSolid).toBeUndefined()
  })
})
