import { describe, expect, it, vi } from 'vitest'
import type { NormalizedAtmosphereOptions } from '../src/core/types'
import type { CanvasLayerSize } from '../src/dom/canvasLayer'
import { createSnowRenderer } from '../src/renderers/canvas2d/snow'

type MutableSnowParticle = {
  vx: number
  vy: number
}

function createContext() {
  return {
    setTransform: vi.fn(),
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    fillStyle: '',
    globalAlpha: 1,
  } as unknown as CanvasRenderingContext2D
}

function createCanvas(context: CanvasRenderingContext2D) {
  const canvas = document.createElement('canvas')
  vi.spyOn(canvas, 'getContext').mockReturnValue(context)
  return canvas
}

function createCanvases(context: CanvasRenderingContext2D) {
  return {
    background: createCanvas(context),
    foreground: createCanvas(createContext()),
  }
}

const size: CanvasLayerSize = {
  width: 800,
  height: 600,
  pixelRatio: 2,
  canvasWidth: 1600,
  canvasHeight: 1200,
}

const options: NormalizedAtmosphereOptions = {
  preset: 'snow',
  particle: 'snow',
  density: 0.5,
  speed: 0.42,
  wind: 0.16,
  color: 'rgba(245, 250, 255, 0.86)',
  quality: 'medium',
  transparency: 'glass',
  contentOpacity: 0.72,
  surfaceOpacity: 0.14,
  collisionSelector: '[data-atoms-collision]',
  opaqueSelector: '[data-atoms-opaque]',
  pauseWhenHidden: true,
  respectReducedMotion: true,
}

describe('SnowRenderer', () => {
  it('creates a particle pool from the snow quality budget', () => {
    const renderer = createSnowRenderer(createCanvases(createContext()), size, options)

    expect(renderer.getParticleCount()).toBeGreaterThan(0)
  })

  it('resizes the particle pool when density changes', () => {
    const renderer = createSnowRenderer(createCanvases(createContext()), size, {
      ...options,
      density: 1,
    })
    const highDensityCount = renderer.getParticleCount()

    renderer.updateOptions({
      ...options,
      density: 0.1,
    })

    expect(renderer.getParticleCount()).toBeLessThan(highDensityCount)
  })

  it('draws drifting flakes without creating a new particle pool', () => {
    const context = createContext()
    const renderer = createSnowRenderer(createCanvases(context), size, options)
    const count = renderer.getParticleCount()

    renderer.render(16)
    renderer.render(32)

    expect(context.setTransform).toHaveBeenCalledWith(2, 0, 0, 2, 0, 0)
    expect(context.clearRect).toHaveBeenCalledWith(0, 0, 800, 600)
    expect(context.arc).toHaveBeenCalled()
    expect(context.fill).toHaveBeenCalled()
    expect(renderer.getParticleCount()).toBe(count)
  })

  it('re-seeds existing flake motion when speed changes from zero', () => {
    const renderer = createSnowRenderer(createCanvases(createContext()), size, {
      ...options,
      speed: 0,
      wind: 0,
    })
    const particles = (renderer as unknown as { particles: MutableSnowParticle[] }).particles

    expect(particles.every((particle) => particle.vx === 0 && particle.vy === 0)).toBe(true)

    renderer.updateOptions({
      ...options,
      speed: 1,
      wind: 0.2,
    })

    expect(particles.some((particle) => particle.vx !== 0 || particle.vy > 0)).toBe(true)
  })

  it('clears the canvas and releases particles on destroy', () => {
    const context = createContext()
    const renderer = createSnowRenderer(createCanvases(context), size, options)

    renderer.destroy()

    expect(context.clearRect).toHaveBeenCalledWith(0, 0, 800, 600)
    expect(renderer.getParticleCount()).toBe(0)
  })
})
