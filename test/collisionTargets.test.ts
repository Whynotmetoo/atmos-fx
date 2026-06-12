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
})
