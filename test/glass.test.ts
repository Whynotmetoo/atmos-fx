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
    expect(root.dataset.atomsTransparency).toBe('glass')

    controller.sync(createOptions({ transparency: 'opacity' }))
    expect(root.dataset.atomsTransparency).toBe('opacity')

    controller.destroy()
    expect(root.dataset.atomsTransparency).toBeUndefined()
  })

  it('maps data-atoms-opacity values into CSS variables', () => {
    const root = document.createElement('section')
    const child = document.createElement('div')
    child.dataset.atomsOpacity = '0.42'
    root.append(child)

    const controller = createGlassController(root)
    controller.sync(createOptions())

    expect(child.style.getPropertyValue('--atoms-fx-opacity')).toBe('0.42')

    child.dataset.atomsOpacity = '2'
    controller.sync(createOptions())

    expect(child.style.getPropertyValue('--atoms-fx-opacity')).toBe('1')

    delete child.dataset.atomsOpacity
    controller.sync(createOptions())

    expect(child.style.getPropertyValue('--atoms-fx-opacity')).toBe('')
  })

  it('manages custom opaque selector attributes without removing user attributes', () => {
    const root = document.createElement('section')
    const managed = document.createElement('div')
    const explicit = document.createElement('div')
    managed.className = 'solid'
    explicit.className = 'solid'
    explicit.dataset.atomsOpaque = ''
    root.append(managed, explicit)

    const controller = createGlassController(root)
    controller.sync(createOptions({ opaqueSelector: '.solid' }))

    expect(managed.dataset.atomsOpaque).toBe('managed')
    expect(explicit.dataset.atomsOpaque).toBe('')

    managed.className = ''
    controller.sync(createOptions({ opaqueSelector: '.solid' }))

    expect(managed.dataset.atomsOpaque).toBeUndefined()

    controller.destroy()
    expect(explicit.dataset.atomsOpaque).toBe('')
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

    expect(child.dataset.atomsOpaque).toBeUndefined()

    child.dataset.solid = ''
    observerCallback?.([], {} as MutationObserver)

    expect(child.dataset.atomsOpaque).toBe('managed')

    delete child.dataset.solid
    observerCallback?.([], {} as MutationObserver)

    expect(child.dataset.atomsOpaque).toBeUndefined()
  })
})
