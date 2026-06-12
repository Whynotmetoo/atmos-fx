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

  it('syncs configurable root opacity CSS variables', () => {
    const root = document.createElement('section')
    const controller = createGlassController(root)

    controller.sync(createOptions({ contentOpacity: 0.48, surfaceOpacity: 0.2 }))

    expect(root.style.getPropertyValue('--atmos-fx-content-opacity')).toBe('0.48')
    expect(root.style.getPropertyValue('--atmos-fx-surface-opacity')).toBe('0.2')

    controller.destroy()

    expect(root.style.getPropertyValue('--atmos-fx-content-opacity')).toBe('')
    expect(root.style.getPropertyValue('--atmos-fx-surface-opacity')).toBe('')
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

  it('manages custom opaque selector attributes without removing user attributes', () => {
    const root = document.createElement('section')
    const managed = document.createElement('div')
    const explicit = document.createElement('div')
    managed.className = 'solid'
    explicit.className = 'solid'
    explicit.dataset.atmosOpaque = ''
    root.append(managed, explicit)

    const controller = createGlassController(root)
    controller.sync(createOptions({ opaqueSelector: '.solid' }))

    expect(managed.dataset.atmosOpaque).toBe('managed')
    expect(explicit.dataset.atmosOpaque).toBe('')

    managed.className = ''
    controller.sync(createOptions({ opaqueSelector: '.solid' }))

    expect(managed.dataset.atmosOpaque).toBeUndefined()

    controller.destroy()
    expect(explicit.dataset.atmosOpaque).toBe('')
  })

  it('observes attribute changes used by custom opaque selectors', () => {
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
    controller.sync(createOptions({ opaqueSelector: '[data-solid]' }))

    expect(child.dataset.atmosOpaque).toBeUndefined()

    child.dataset.solid = ''
    observerCallback?.([], {} as MutationObserver)

    expect(child.dataset.atmosOpaque).toBe('managed')

    delete child.dataset.solid
    observerCallback?.([], {} as MutationObserver)

    expect(child.dataset.atmosOpaque).toBeUndefined()
  })

  it('marks direct children that contain opaque descendants', () => {
    const root = document.createElement('section')
    const panel = document.createElement('div')
    const button = document.createElement('button')
    panel.append(button)
    root.append(panel)

    const controller = createGlassController(root)
    controller.sync(createOptions({ opaqueSelector: 'button[disabled]' }))

    expect(panel.dataset.atmosContainsOpaque).toBeUndefined()

    button.disabled = true
    controller.sync(createOptions({ opaqueSelector: 'button[disabled]' }))

    expect(button.dataset.atmosOpaque).toBe('managed')
    expect(panel.dataset.atmosContainsOpaque).toBe('managed')

    button.disabled = false
    controller.sync(createOptions({ opaqueSelector: 'button[disabled]' }))

    expect(button.dataset.atmosOpaque).toBeUndefined()
    expect(panel.dataset.atmosContainsOpaque).toBeUndefined()
  })

  it('manages data-atmos-opaque="managed" attribute dynamically', () => {
    const root = document.createElement('section')
    const firstTarget = document.createElement('article')
    const secondTarget = document.createElement('aside')
    root.append(firstTarget, secondTarget)
    firstTarget.dataset.atmosOpaque = 'custom'
    secondTarget.className = 'solid'

    const controller = createGlassController(root)
    controller.sync(createOptions({ opaqueSelector: '[data-atmos-opaque], .solid' }))

    // The element matching [data-atmos-opaque] should keep its original attribute
    expect(firstTarget.dataset.atmosOpaque).toBe('custom')
    // The element matching .solid should get "managed"
    expect(secondTarget.dataset.atmosOpaque).toBe('managed')

    // Change options to only match the original selector
    controller.sync(createOptions({ opaqueSelector: '[data-atmos-opaque]' }))
    // .solid element should lose the managed attribute
    expect(secondTarget.dataset.atmosOpaque).toBeUndefined()
    expect(firstTarget.dataset.atmosOpaque).toBe('custom')

    // Add .solid back
    controller.sync(createOptions({ opaqueSelector: '.solid' }))
    expect(secondTarget.dataset.atmosOpaque).toBe('managed')

    // Destroy the controller
    controller.destroy()
    // It should clean up the managed attribute
    expect(secondTarget.dataset.atmosOpaque).toBeUndefined()
  })
})
