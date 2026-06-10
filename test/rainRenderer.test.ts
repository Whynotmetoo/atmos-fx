import { describe, expect, it, vi } from 'vitest'
import type { NormalizedAtmosphereOptions } from '../src/core/types'
import type { CanvasLayerSize } from '../src/dom/canvasLayer'
import { createRainRenderer } from '../src/renderers/canvas2d/rain'

type MutableRainParticle = {
  x: number
  y: number
  vx: number
  vy: number
  length: number
  width: number
  alpha: number
  depth: number
  layer: 'background' | 'foreground'
}

function createContext() {
  return {
    setTransform: vi.fn(),
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    lineCap: 'butt',
    lineWidth: 1,
    globalAlpha: 1,
    strokeStyle: '',
    fillStyle: '',
  } as unknown as CanvasRenderingContext2D
}

function createCanvas(context: CanvasRenderingContext2D) {
  const canvas = document.createElement('canvas')
  vi.spyOn(canvas, 'getContext').mockReturnValue(context)
  return canvas
}

function createCanvases(
  backgroundContext: CanvasRenderingContext2D,
  foregroundContext: CanvasRenderingContext2D = backgroundContext,
) {
  return {
    background: createCanvas(backgroundContext),
    foreground: createCanvas(foregroundContext),
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
  preset: 'rain',
  particle: 'rain',
  renderer: 'canvas2d',
  density: 0.7,
  speed: 1,
  wind: -0.12,
  color: 'rgba(220, 235, 255, 0.72)',
  quality: 'medium',
  transparency: 'glass',
  contentOpacity: 0.72,
  surfaceOpacity: 0.14,
  snowAccumulation: 0.55,
  rainDripping: 0.5,
  hailBounce: 0.5,
  collisionSelector: '[data-atoms-collision]',
  opaqueSelector: '[data-atoms-opaque]',
  pauseWhenHidden: true,
  respectReducedMotion: true,
}

describe('RainRenderer', () => {
  it('creates a particle pool from the quality budget', () => {
    const renderer = createRainRenderer(createCanvases(createContext()), size, options)

    expect(renderer.getParticleCount()).toBeGreaterThan(0)
    expect(renderer.getBackgroundParticleCount()).toBeGreaterThan(0)
    expect(renderer.getForegroundParticleCount()).toBeGreaterThan(0)
  })

  it('resizes the particle pool when density changes', () => {
    const renderer = createRainRenderer(createCanvases(createContext()), size, {
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

  it('draws rain streaks without creating a new particle pool', () => {
    const backgroundContext = createContext()
    const foregroundContext = createContext()
    const renderer = createRainRenderer(
      createCanvases(backgroundContext, foregroundContext),
      size,
      options,
    )
    const count = renderer.getParticleCount()

    renderer.render(16)
    renderer.render(32)

    expect(backgroundContext.setTransform).toHaveBeenCalledWith(2, 0, 0, 2, 0, 0)
    expect(foregroundContext.setTransform).toHaveBeenCalledWith(2, 0, 0, 2, 0, 0)
    expect(backgroundContext.clearRect).toHaveBeenCalledWith(0, 0, 800, 600)
    expect(foregroundContext.clearRect).toHaveBeenCalledWith(0, 0, 800, 600)
    expect(backgroundContext.stroke).toHaveBeenCalled()
    expect(foregroundContext.stroke).toHaveBeenCalled()
    expect(renderer.getParticleCount()).toBe(count)
  })

  it('clears the canvas and releases particles on destroy', () => {
    const context = createContext()
    const renderer = createRainRenderer(createCanvases(context), size, options)

    renderer.destroy()

    expect(context.clearRect).toHaveBeenCalledWith(0, 0, 800, 600)
    expect(renderer.getParticleCount()).toBe(0)
  })

  it('clears the canvas without releasing particles', () => {
    const context = createContext()
    const renderer = createRainRenderer(createCanvases(context), size, options)
    const count = renderer.getParticleCount()

    renderer.clear()

    expect(context.clearRect).toHaveBeenCalledWith(0, 0, 800, 600)
    expect(renderer.getParticleCount()).toBe(count)
  })

  it('spawns splash particles when rain crosses a collision top edge', () => {
    const renderer = createRainRenderer(createCanvases(createContext()), size, options)
    const particle = (renderer as unknown as { particles: MutableRainParticle[] }).particles.find(
      (candidate) => candidate.layer === 'foreground',
    )

    expect(particle).toBeDefined()

    particle!.x = 120
    particle!.y = 90
    particle!.vx = 0
    particle!.vy = 1200
    particle!.length = 18
    particle!.width = 1
    particle!.alpha = 0.7
    particle!.depth = 1

    renderer.setCollisionTargets([
      {
        x: 80,
        y: 100,
        width: 140,
        height: 60,
        right: 220,
        bottom: 160,
      },
    ])

    renderer.render(16)

    expect(renderer.getActiveSplashCount()).toBeGreaterThan(0)
  })

  it('lets background rain pass behind collision surfaces', () => {
    const renderer = createRainRenderer(createCanvases(createContext()), size, options)
    const particles = (renderer as unknown as { particles: MutableRainParticle[] }).particles
    const backgroundParticle = particles.find((particle) => particle.layer === 'background')

    expect(backgroundParticle).toBeDefined()

    for (const particle of particles) {
      if (particle.layer === 'foreground') {
        particle.x = -500
        particle.y = 0
        particle.vx = 0
        particle.vy = 0
      }
    }

    backgroundParticle!.x = 120
    backgroundParticle!.y = 90
    backgroundParticle!.vx = 0
    backgroundParticle!.vy = 1200
    backgroundParticle!.length = 18
    backgroundParticle!.width = 1
    backgroundParticle!.alpha = 0.7
    backgroundParticle!.depth = 1

    renderer.setCollisionTargets([
      {
        x: 80,
        y: 100,
        width: 140,
        height: 60,
        right: 220,
        bottom: 160,
      },
    ])

    renderer.render(16)

    expect(renderer.getActiveSplashCount()).toBe(0)
    expect(backgroundParticle!.y).toBeGreaterThan(100)
  })

  it('spawns and updates rainwater dripping along card bottom edges', () => {
    const renderer = createRainRenderer(createCanvases(createContext()), size, {
      ...options,
      rainDripping: 1, // force dripping spawn probability to be high
    })
    const particles = (renderer as unknown as { particles: MutableRainParticle[] }).particles
    const particle = particles.find((p) => p.layer === 'foreground')
    expect(particle).toBeDefined()

    particle!.x = 120
    particle!.y = 90
    particle!.vx = 0
    particle!.vy = 1200
    particle!.length = 18
    particle!.width = 1
    particle!.alpha = 0.7
    particle!.depth = 1

    renderer.setCollisionTargets([
      {
        x: 80,
        y: 100,
        width: 140,
        height: 60,
        right: 220,
        bottom: 160,
      },
    ])

    // Render should trigger collision and spawn drip
    renderer.render(16)
    expect(renderer.getActiveDripCount()).toBeGreaterThan(0)

    // Render again to update the drip pool
    renderer.render(32)
    expect(renderer.getActiveDripCount()).toBeGreaterThan(0)
  })
})
