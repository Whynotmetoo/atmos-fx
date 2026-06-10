import { describe, expect, it, vi } from 'vitest'
import type { NormalizedAtmosphereOptions } from '../src/core/types'
import type { CanvasLayerSize } from '../src/dom/canvasLayer'
import { createSnowRenderer } from '../src/renderers/canvas2d/snow'

type MutableSnowParticle = {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  alpha: number
  depth: number
  phase: number
  phaseSpeed: number
  drift: number
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

function createCanvases(
  backgroundContext: CanvasRenderingContext2D,
  foregroundContext: CanvasRenderingContext2D = createContext(),
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
  preset: 'snow',
  particle: 'snow',
  renderer: 'canvas2d',
  density: 0.5,
  speed: 0.42,
  wind: 0.16,
  color: 'rgba(245, 250, 255, 0.86)',
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

describe('SnowRenderer', () => {
  it('creates a particle pool from the snow quality budget', () => {
    const renderer = createSnowRenderer(createCanvases(createContext()), size, options)

    expect(renderer.getParticleCount()).toBeGreaterThan(0)
    expect(renderer.getAccumulationCapacity()).toBeGreaterThan(0)
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
    const foregroundContext = createContext()
    const renderer = createSnowRenderer(createCanvases(context, foregroundContext), size, options)
    const count = renderer.getParticleCount()

    renderer.render(16)
    renderer.render(32)

    expect(context.setTransform).toHaveBeenCalledWith(2, 0, 0, 2, 0, 0)
    expect(context.clearRect).toHaveBeenCalledWith(0, 0, 800, 600)
    expect(foregroundContext.clearRect).toHaveBeenCalledWith(0, 0, 800, 600)
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
    expect(renderer.getActiveAccumulationCount()).toBe(0)
  })

  it('spawns accumulation when snow crosses a collision top edge', () => {
    const renderer = createSnowRenderer(createCanvases(createContext()), size, options)
    const particle = (renderer as unknown as { particles: MutableSnowParticle[] }).particles[0]

    particle.x = 120
    particle.y = 90
    particle.vx = 0
    particle.vy = 900
    particle.radius = 2
    particle.alpha = 0.8
    particle.depth = 1
    particle.phase = 0
    particle.phaseSpeed = 0
    particle.drift = 0

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

    expect(renderer.getActiveAccumulationCount()).toBeGreaterThan(0)
  })

  it('spawns accumulation on the root bottom edge', () => {
    const renderer = createSnowRenderer(createCanvases(createContext()), size, options)
    const particle = (renderer as unknown as { particles: MutableSnowParticle[] }).particles[0]

    particle.x = 120
    particle.y = 592
    particle.vx = 0
    particle.vy = 900
    particle.radius = 2
    particle.alpha = 0.8
    particle.depth = 1
    particle.phase = 0
    particle.phaseSpeed = 0
    particle.drift = 0

    renderer.render(16)

    expect(renderer.getActiveAccumulationCount()).toBeGreaterThan(0)
  })

  it('clears bottom-edge accumulation when the root size changes', () => {
    const renderer = createSnowRenderer(createCanvases(createContext()), size, options)
    const particle = (renderer as unknown as { particles: MutableSnowParticle[] }).particles[0]

    particle.x = 120
    particle.y = 592
    particle.vx = 0
    particle.vy = 900
    particle.radius = 2
    particle.alpha = 0.8
    particle.depth = 1
    particle.phase = 0
    particle.phaseSpeed = 0
    particle.drift = 0

    renderer.render(16)

    expect(renderer.getActiveAccumulationCount()).toBeGreaterThan(0)

    renderer.resize({
      ...size,
      height: 720,
      canvasHeight: 1440,
    })

    expect(renderer.getActiveAccumulationCount()).toBe(0)
  })

  it('disables snow accumulation when configured to zero', () => {
    const renderer = createSnowRenderer(createCanvases(createContext()), size, {
      ...options,
      snowAccumulation: 0,
    })

    expect(renderer.getAccumulationCapacity()).toBe(0)
  })

  it('clears accumulation when collision targets change', () => {
    const renderer = createSnowRenderer(createCanvases(createContext()), size, options)
    const particle = (renderer as unknown as { particles: MutableSnowParticle[] }).particles[0]

    particle.x = 120
    particle.y = 90
    particle.vx = 0
    particle.vy = 900
    particle.radius = 2
    particle.alpha = 0.8
    particle.depth = 1
    particle.phase = 0
    particle.phaseSpeed = 0
    particle.drift = 0

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

    expect(renderer.getActiveAccumulationCount()).toBeGreaterThan(0)

    renderer.setCollisionTargets([
      {
        x: 120,
        y: 180,
        width: 120,
        height: 40,
        right: 240,
        bottom: 220,
      },
    ])

    expect(renderer.getActiveAccumulationCount()).toBe(0)
  })

  it('slides snow particles off card edges when they accumulate too close to the side', () => {
    const renderer = createSnowRenderer(createCanvases(createContext()), size, options)
    const accumulationPool = (renderer as any).accumulation

    renderer.setCollisionTargets([
      {
        x: 100,
        y: 150,
        width: 100,
        height: 40,
        right: 200,
        bottom: 190,
      },
    ])

    // Spawn snow particle near the right edge of target card: x = 199 (right is 200)
    accumulationPool.spawn(199, 150, 4, 0.8, 1, (renderer as any).collisionTargets[0])

    const particle = accumulationPool.particles[0]
    expect(particle.active).toBe(true)
    expect(particle.onSurface).toBe(true)

    // Render multiple frames to trigger physics updates
    // In accumulation.ts: since p.x (199) is within edgeThreshold (p.radius*1.5 = 6px) from right (200)
    // it will slide off to the right (vx > 0), causing p.x > 200, setting p.onSurface = false.
    renderer.render(16)
    renderer.render(32)

    expect(particle.onSurface).toBe(false)
    expect(particle.vy).toBeGreaterThan(0) // falling now
  })
})
