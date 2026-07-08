import { describe, expect, it, vi } from 'vitest'
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

    expect(collectCollisionTargetRects(root)).toEqual([
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

  it('clamps oversized pill radii to the target dimensions', () => {
    const root = document.createElement('section')
    const target = document.createElement('div')
    root.append(target)
    target.dataset.atmosCollision = ''
    target.style.borderTopLeftRadius = '99px'

    root.getBoundingClientRect = vi.fn(() => rect(0, 0, 320, 180))
    target.getBoundingClientRect = vi.fn(() => rect(40, 60, 140, 8))

    expect(collectCollisionTargetRects(root)).toEqual([
      {
        element: target,
        x: 40,
        y: 60,
        width: 140,
        height: 8,
        right: 180,
        bottom: 68,
        borderRadius: 4,
      },
    ])
  })

  it('refreshes fixed collision targets and notifies listeners', () => {
    const root = document.createElement('section')
    const target = document.createElement('article')
    const unmarked = document.createElement('aside')
    unmarked.className = 'collision-target'
    root.append(target, unmarked)
    target.dataset.atmosCollision = ''

    root.getBoundingClientRect = vi.fn(() => rect(10, 20, 300, 200))
    target.getBoundingClientRect = vi.fn(() => rect(20, 30, 80, 30))
    unmarked.getBoundingClientRect = vi.fn(() => rect(40, 90, 110, 24))

    const onChange = vi.fn()
    const manager = createCollisionTargetManager(root, onChange)

    expect(manager.refresh()).toEqual([
      {
        element: target,
        x: 10,
        y: 10,
        width: 80,
        height: 30,
        right: 90,
        bottom: 40,
      },
    ])
    expect(onChange).toHaveBeenCalled()
    expect(unmarked.getBoundingClientRect).not.toHaveBeenCalled()

    manager.destroy()
    expect(manager.getTargets()).toEqual([])
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
    const manager = createCollisionTargetManager(root, onChange)

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

  it('filters high-frequency internal animation attributes before observation', () => {
    let observeOptions: MutationObserverInit | undefined

    class MockMutationObserver {
      observe(_target: Node, options?: MutationObserverInit) {
        observeOptions = options
      }
      disconnect() {}
    }

    vi.stubGlobal('MutationObserver', MockMutationObserver)
    const root = document.createElement('section')
    const manager = createCollisionTargetManager(root)

    expect(observeOptions?.attributeFilter).toContain('data-atmos-collision')
    expect(observeOptions?.attributeFilter).toContain('class')
    expect(observeOptions?.attributeFilter).not.toContain('data-atmos-card-fx')
    expect(observeOptions?.attributeFilter).not.toContain('d')

    manager.destroy()
    vi.unstubAllGlobals()
  })
})
