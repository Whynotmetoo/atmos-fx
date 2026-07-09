import { beforeEach, describe, expect, it, vi } from 'vitest'
import { normalizeAtmosphereOptions } from '../src/core/options'
import type { CollisionTargetRect } from '../src/dom/collisionTargets'

const rainMocks = vi.hoisted(() => {
  const effects: MockRainEffect[] = []
  const renderers: MockRainRenderer[] = []

  class MockRainEffect {
    ready = Promise.resolve()
    start = vi.fn(() => this)
    stop = vi.fn(() => this)
    setDensity = vi.fn((_density: number) => this)
    isReady = vi.fn(() => true)
    getSize = vi.fn(() => ({ width: 200, height: 100 }))
    render = vi.fn()
    clear = vi.fn()
    resize = vi.fn()
    destroy = vi.fn()

    constructor() {
      effects.push(this)
    }
  }

  class MockRainRenderer {
    canvas: HTMLCanvasElement
    resize = vi.fn((width: number, height: number) => {
      this.canvas.width = width
      this.canvas.height = height
    })
    destroy = vi.fn()

    constructor(canvas: HTMLCanvasElement) {
      this.canvas = canvas
      renderers.push(this)
    }
  }

  return { effects, renderers, MockRainEffect, MockRainRenderer }
})

vi.mock('../src/dom/rain-card', () => ({
  loadSharedRainAssets: vi.fn(async () => ({ refraction: document.createElement('img') })),
  RainEffect: rainMocks.MockRainEffect,
  RainRenderer: rainMocks.MockRainRenderer,
}))

import { createCardRainController } from '../src/dom/cardRainEffect'

describe('card rain controller', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    rainMocks.effects.length = 0
    rainMocks.renderers.length = 0
  })

  it('uses one renderer and one frame callback for independent card effects', async () => {
    let frameCallback: FrameRequestCallback | undefined
    const requestFrame = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      frameCallback = callback
      return 1
    })
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined)

    const root = document.createElement('section')
    const cards = [document.createElement('article'), document.createElement('article')]
    for (const card of cards) {
      card.setAttribute('data-atmos-glass', '')
      root.append(card)
    }
    document.body.append(root)

    const targets: CollisionTargetRect[] = cards.map((element, index) => ({
      element,
      x: index * 220,
      y: 0,
      width: 200,
      height: 100,
      right: index * 220 + 200,
      bottom: 100,
    }))
    const controller = createCardRainController(root)
    controller.sync(normalizeAtmosphereOptions({ preset: 'rain', quality: 'medium' }), targets)
    expect(rainMocks.effects).toHaveLength(0)

    controller.resume()
    await Promise.resolve()
    await Promise.resolve()

    expect(rainMocks.effects).toHaveLength(2)
    expect(rainMocks.effects[0]).not.toBe(rainMocks.effects[1])
    expect(rainMocks.effects[0]?.setDensity.mock.calls[0]?.[0]).toBeCloseTo(0.585)
    expect(rainMocks.effects[1]?.setDensity.mock.calls[0]?.[0]).toBeCloseTo(0.585)
    expect(rainMocks.renderers).toHaveLength(1)
    expect(requestFrame).toHaveBeenCalledTimes(1)

    frameCallback?.(123)

    expect(rainMocks.effects[0]?.render).toHaveBeenCalledWith(123, rainMocks.renderers[0])
    expect(rainMocks.effects[1]?.render).toHaveBeenCalledWith(123, rainMocks.renderers[0])
    expect(requestFrame).toHaveBeenCalledTimes(2)

    controller.sync(normalizeAtmosphereOptions({ preset: 'snow', quality: 'medium' }), targets)
    expect(root.querySelectorAll('[data-atmos-layer="card-rain"]')).toHaveLength(2)
    expect(rainMocks.effects.every(effect => effect.stop.mock.calls.length > 0)).toBe(true)
    expect(rainMocks.effects.every(effect => effect.clear.mock.calls.length > 0)).toBe(true)

    controller.sync(normalizeAtmosphereOptions({ preset: 'rain', quality: 'medium' }), targets)
    expect(root.querySelectorAll('[data-atmos-layer="card-rain"]')).toHaveLength(2)
    expect(rainMocks.effects).toHaveLength(2)
    expect(rainMocks.effects.every(effect => effect.start.mock.calls.length >= 2)).toBe(true)
    expect(rainMocks.effects[0]?.setDensity.mock.calls.at(-1)?.[0]).toBeCloseTo(0.585)
    expect(rainMocks.effects[1]?.setDensity.mock.calls.at(-1)?.[0]).toBeCloseTo(0.585)

    controller.destroy()
    expect(rainMocks.renderers[0]?.destroy).toHaveBeenCalledTimes(1)
  })

  it('disables low quality and does not recreate cards while inactive', () => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 1)
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined)

    const root = document.createElement('section')
    const card = document.createElement('article')
    card.setAttribute('data-atmos-glass', '')
    root.append(card)
    document.body.append(root)

    const targets: CollisionTargetRect[] = [{
      element: card,
      x: 0,
      y: 0,
      width: 200,
      height: 100,
      right: 200,
      bottom: 100,
    }]
    const controller = createCardRainController(root)

    controller.sync(normalizeAtmosphereOptions({ preset: 'rain', quality: 'low' }), targets)
    controller.resume()
    expect(root.querySelector('[data-atmos-layer="card-rain"]')).toBeNull()

    controller.sync(normalizeAtmosphereOptions({ preset: 'rain', quality: 'medium' }), targets)
    expect(root.querySelectorAll('[data-atmos-layer="card-rain"]')).toHaveLength(1)

    controller.pause()
    controller.sync(normalizeAtmosphereOptions({ preset: 'rain', quality: 'medium' }), [])
    controller.sync(normalizeAtmosphereOptions({ preset: 'rain', quality: 'medium' }), targets)
    expect(root.querySelector('[data-atmos-layer="card-rain"]')).toBeNull()

    controller.resume()
    expect(root.querySelectorAll('[data-atmos-layer="card-rain"]')).toHaveLength(1)

    controller.destroy()
  })
})
