import { describe, expect, it, vi } from 'vitest'
import type { CanvasLayerSize } from '../src/dom/canvasLayer'
import { SplashPool } from '../src/renderers/canvas2d/splash'

function createContext() {
  return {
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    lineWidth: 1,
    globalAlpha: 1,
    strokeStyle: '',
  } as unknown as CanvasRenderingContext2D
}

const size: CanvasLayerSize = {
  width: 320,
  height: 180,
  pixelRatio: 1,
  canvasWidth: 320,
  canvasHeight: 180,
}

describe('SplashPool', () => {
  it('spawns, renders, and clears pooled particles', () => {
    const context = createContext()
    const splashes = new SplashPool(20)

    splashes.spawn(100, 80, -40, 1)

    expect(splashes.getActiveCount()).toBeGreaterThan(0)

    splashes.render(context, 1 / 60, size, 'rgba(255, 255, 255, 0.7)')

    expect(context.stroke).toHaveBeenCalled()

    splashes.clear()

    expect(splashes.getActiveCount()).toBe(0)
  })

  it('expires short-lived particles', () => {
    const splashes = new SplashPool(20)

    splashes.spawn(100, 80, 0, 1)
    splashes.render(createContext(), 1, size, 'white')

    expect(splashes.getActiveCount()).toBe(0)
  })
})
