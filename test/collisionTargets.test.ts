import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_OPTIONS } from '../src/core/presets'
import type { NormalizedAtmosphereOptions } from '../src/core/types'
import {
  collectCollisionTargetRects,
  createCollisionTargetManager,
} from '../src/dom/collisionTargets'

function rect(left: number, top: number, width: number, height: number): DOMRect {
  return {
    x: left,
    y: top,
    left,
    top,
    right: left + width,
    bottom: top + height,
    width,
    height,
    toJSON: () => ({}),
  } as DOMRect
}

function createOptions(
  options: Partial<NormalizedAtmosphereOptions> = {},
): NormalizedAtmosphereOptions {
  return {
    ...DEFAULT_OPTIONS,
    ...options,
  }
}

describe('collision targets', () => {
  it('collects root-relative target rects', () => {
    const root = document.createElement('section')
    const target = document.createElement('article')
    const canvas = document.createElement('canvas')
    root.append(target, canvas)
    target.dataset.atmosCollision = ''
    canvas.dataset.atmosLayer = 'weather'
    canvas.dataset.atmosCollision = ''

    root.getBoundingClientRect = vi.fn(() => rect(100, 50, 320, 180))
    target.getBoundingClientRect = vi.fn(() => rect(136, 94, 120, 40))
    canvas.getBoundingClientRect = vi.fn(() => rect(100, 50, 320, 180))

    expect(collectCollisionTargetRects(root, '[data-atmos-collision]')).toEqual([
      {
        element: target,
        x: 36,
        y: 44,
        width: 120,
        height: 40,
        right: 156,
        bottom: 84,
      },
    ])
  })

  it('updates selectors and notifies with refreshed rects', () => {
    const root = document.createElement('section')
    const firstTarget = document.createElement('article')
    const secondTarget = document.createElement('aside')
    root.append(firstTarget, secondTarget)
    firstTarget.dataset.atmosCollision = ''
    secondTarget.className = 'surface'

    root.getBoundingClientRect = vi.fn(() => rect(10, 20, 300, 200))
    firstTarget.getBoundingClientRect = vi.fn(() => rect(20, 30, 80, 30))
    secondTarget.getBoundingClientRect = vi.fn(() => rect(40, 90, 110, 24))

    const onChange = vi.fn()
    const manager = createCollisionTargetManager(root, createOptions(), onChange)

    expect(manager.refresh()).toHaveLength(1)

    const updated = manager.updateOptions(createOptions({ collisionSelector: '.surface' }))

    expect(updated).toEqual([
      {
        element: secondTarget,
        x: 30,
        y: 70,
        width: 110,
        height: 24,
        right: 140,
        bottom: 94,
      },
    ])
    expect(onChange).toHaveBeenCalled()

    manager.destroy()
    expect(manager.getTargets()).toEqual([])
  })

  it('manages data-atmos-collision="managed" attribute dynamically', () => {
    const root = document.createElement('section')
    const firstTarget = document.createElement('article')
    const secondTarget = document.createElement('aside')
    root.append(firstTarget, secondTarget)
    firstTarget.dataset.atmosCollision = 'custom'
    secondTarget.className = 'surface'

    root.getBoundingClientRect = vi.fn(() => rect(10, 20, 300, 200))
    firstTarget.getBoundingClientRect = vi.fn(() => rect(20, 30, 80, 30))
    secondTarget.getBoundingClientRect = vi.fn(() => rect(40, 90, 110, 24))

    const manager = createCollisionTargetManager(
      root,
      createOptions({ collisionSelector: '[data-atmos-collision], .surface' }),
    )

    // Initially refresh to trigger sync
    manager.refresh()

    // The element matching [data-atmos-collision] should keep its original attribute
    expect(firstTarget.dataset.atmosCollision).toBe('custom')
    // The element matching .surface should get "managed"
    expect(secondTarget.dataset.atmosCollision).toBe('managed')

    // Change options to only match the original selector
    manager.updateOptions(createOptions({ collisionSelector: '[data-atmos-collision]' }))
    // .surface element should lose the managed attribute
    expect(secondTarget.dataset.atmosCollision).toBeUndefined()
    expect(firstTarget.dataset.atmosCollision).toBe('custom')

    // Add .surface back
    manager.updateOptions(createOptions({ collisionSelector: '.surface' }))
    expect(secondTarget.dataset.atmosCollision).toBe('managed')

    // Destroy the manager
    manager.destroy()
    // It should clean up the managed attribute
    expect(secondTarget.dataset.atmosCollision).toBeUndefined()
  })

  it('throttles scroll events and filters unrelated scroll targets', () => {
    vi.useFakeTimers()
    const root = document.createElement('section')
    const firstTarget = document.createElement('article')
    root.append(firstTarget)
    firstTarget.dataset.atmosCollision = ''

    root.getBoundingClientRect = vi.fn(() => rect(10, 20, 300, 200))
    firstTarget.getBoundingClientRect = vi.fn(() => rect(20, 30, 80, 30))

    const onChange = vi.fn()
    const manager = createCollisionTargetManager(root, createOptions(), onChange)

    // Initial load
    manager.refresh()
    onChange.mockClear()

    // 1. Dispatch scroll on window - should trigger layout update
    const scrollEvent = new Event('scroll', { bubbles: true })
    window.dispatchEvent(scrollEvent)
    
    // Fast-forward timers to run scheduled refresh
    vi.runOnlyPendingTimers()
    expect(onChange).toHaveBeenCalledTimes(1)
    onChange.mockClear()

    // 2. Dispatch unrelated scroll - target is not child, ancestor, or window
    const unrelatedDiv = document.createElement('div')
    document.body.appendChild(unrelatedDiv)
    unrelatedDiv.dispatchEvent(new Event('scroll', { bubbles: true }))
    
    vi.runOnlyPendingTimers()
    expect(onChange).not.toHaveBeenCalled()
    document.body.removeChild(unrelatedDiv)

    // 3. Throttle check: dispatch 3 events within 50ms - should only trigger twice (immediate + trailing)
    window.dispatchEvent(scrollEvent) // Immediate
    vi.advanceTimersByTime(20)
    window.dispatchEvent(scrollEvent) // Throttled, trailing scheduled
    vi.advanceTimersByTime(20)
    window.dispatchEvent(scrollEvent) // Throttled, trailing rescheduled
    
    vi.runAllTimers()
    expect(onChange).toHaveBeenCalledTimes(2)

    manager.destroy()
    vi.useRealTimers()
  })
})
