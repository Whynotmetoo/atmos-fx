import { describe, expect, it } from 'vitest'
import { SurfaceDropletsController } from '../src/dom/surfaceDroplets'
import { DEFAULT_OPTIONS } from '../src/core/presets'
import type { CollisionTargetRect } from '../src/dom/collisionTargets'
import type { NormalizedAtmosphereOptions } from '../src/core/types'

function createOptions(
  options: Partial<NormalizedAtmosphereOptions> = {},
): NormalizedAtmosphereOptions {
  return {
    ...DEFAULT_OPTIONS,
    surfaceDroplets: true,
    ...options,
  }
}

describe('SurfaceDropletsController & CardDropletsState', () => {
  it('manages card opt-in and initialization lifecycle', () => {
    const root = document.createElement('div')
    const cardEl = document.createElement('div')
    cardEl.dataset.atmosCollision = 'true'
    cardEl.dataset.atmosSurfaceDroplets = 'true'
    root.appendChild(cardEl)

    const controller = new SurfaceDropletsController(root)
    const targets: CollisionTargetRect[] = [
      {
        element: cardEl,
        x: 10,
        y: 20,
        width: 200,
        height: 150,
        right: 210,
        bottom: 170,
        borderRadius: 8,
      },
    ]

    controller.sync(createOptions(), targets)

    // Check if the compositor canvas is added
    const canvas = cardEl.querySelector('canvas[data-atmos-layer="surface-droplets"]')
    expect(canvas).not.toBeNull()

    // Disable surfaceDroplets and sync again
    controller.sync(createOptions({ surfaceDroplets: false }), targets)
    const canvasAfter = cardEl.querySelector('canvas[data-atmos-layer="surface-droplets"]')
    expect(canvasAfter).toBeNull()

    controller.destroy()
  })

  it('correctly updates positions and spawns droplets over time', () => {
    const root = document.createElement('div')
    const cardEl = document.createElement('div')
    cardEl.dataset.atmosCollision = 'true'
    cardEl.dataset.atmosSurfaceDroplets = 'true'
    root.appendChild(cardEl)

    const controller = new SurfaceDropletsController(root)
    const targets: CollisionTargetRect[] = [
      {
        element: cardEl,
        x: 10,
        y: 20,
        width: 300,
        height: 300,
        right: 310,
        bottom: 320,
        borderRadius: 4,
      },
    ]

    controller.sync(createOptions({ density: 1.0 }), targets)

    // Retrieve internal CardDropletsState from controller's private activeCards map
    const activeCards = (controller as any).activeCards
    const state = activeCards.get(cardEl)
    expect(state).toBeDefined()

    // Trigger update with enough time to spawn droplets
    state.update(4.0, createOptions({ density: 1.0 }))
    expect(state.droplets.length).toBeGreaterThan(0)

    // Simulate sliding droplets falling and static ones staying
    const slidingDrop = state.droplets.find((d: any) => d.type === 'sliding')
    if (slidingDrop) {
      const initialY = slidingDrop.y
      state.update(0.5, createOptions({ density: 1.0 }))
      expect(slidingDrop.y).toBeGreaterThan(initialY)
    }

    controller.destroy()
  })

  it('merges droplets when they overlap', () => {
    const root = document.createElement('div')
    const cardEl = document.createElement('div')
    cardEl.dataset.atmosCollision = 'true'
    cardEl.dataset.atmosSurfaceDroplets = 'true'
    root.appendChild(cardEl)

    const controller = new SurfaceDropletsController(root)
    const targets: CollisionTargetRect[] = [
      {
        element: cardEl,
        x: 10,
        y: 20,
        width: 100,
        height: 100,
        right: 110,
        bottom: 120,
        borderRadius: 4,
      },
    ]

    controller.sync(createOptions(), targets)
    const activeCards = (controller as any).activeCards
    const state = activeCards.get(cardEl)

    // Clear droplets and insert two overlapping droplets manually
    state.droplets = [
      {
        x: 50,
        y: 50,
        rx: 5.0,
        ry: 6.0,
        baseRx: 5.0,
        baseRy: 6.0,
        vx: 0,
        vy: 10,
        type: 'sliding',
        alpha: 1.0,
        trailTimer: 0,
        isKilled: false,
      },
      {
        x: 52,
        y: 52,
        rx: 3.0,
        ry: 3.0,
        baseRx: 3.0,
        baseRy: 3.0,
        vx: 0,
        vy: 0,
        type: 'static',
        alpha: 1.0,
        trailTimer: 0,
        isKilled: false,
      },
    ]

    // Update to trigger collision resolution
    state.update(0.01, createOptions())

    // Overlapping droplets should merge into one
    expect(state.droplets.length).toBe(1)
    expect(state.droplets[0].type).toBe('sliding')
    expect(state.droplets[0].rx).toBeGreaterThan(5.0)

    controller.destroy()
  })
})
