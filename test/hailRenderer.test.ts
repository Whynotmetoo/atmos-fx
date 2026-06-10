import { describe, expect, it, vi } from 'vitest'
import type { NormalizedAtmosphereOptions } from '../src/core/types'
import type { CanvasLayerSize } from '../src/dom/canvasLayer'
import { createHailRenderer } from '../src/renderers/canvas2d/hail'

type MutableHailParticle = {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  alpha: number
  depth: number
  bounces: number
}

function createContext() {
  return {
    setTransform: vi.fn(),
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
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
    background: createCanvas(createContext()),
    foreground: createCanvas(context),
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
  preset: 'hail',
  particle: 'hail',
  renderer: 'canvas2d',
  density: 0.46,
  speed: 0.92,
  wind: -0.08,
  color: 'rgba(218, 235, 247, 0.84)',
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

describe('HailRenderer', () => {
  it('creates a bounded particle pool from the hail quality budget', () => {
    const renderer = createHailRenderer(createCanvases(createContext()), size, options)

    expect(renderer.getParticleCount()).toBeGreaterThan(0)
    expect(renderer.getAccumulationCapacity()).toBeGreaterThan(0)
  })

  it('resizes particle and accumulation budgets when density changes', () => {
    const renderer = createHailRenderer(createCanvases(createContext()), size, {
      ...options,
      density: 1,
    })
    const highDensityCount = renderer.getParticleCount()
    const highDensityAccumulationCapacity = renderer.getAccumulationCapacity()

    renderer.updateOptions({
      ...options,
      density: 0.1,
    })

    expect(renderer.getParticleCount()).toBeLessThan(highDensityCount)
    expect(renderer.getAccumulationCapacity()).toBeLessThan(highDensityAccumulationCapacity)
  })

  it('draws hail pellets without creating a new particle pool', () => {
    const context = createContext()
    const renderer = createHailRenderer(createCanvases(context), size, options)
    const count = renderer.getParticleCount()

    renderer.render(16)
    renderer.render(32)

    expect(context.setTransform).toHaveBeenCalledWith(2, 0, 0, 2, 0, 0)
    expect(context.clearRect).toHaveBeenCalledWith(0, 0, 800, 600)
    expect(context.arc).toHaveBeenCalled()
    expect(context.fill).toHaveBeenCalled()
    expect(renderer.getParticleCount()).toBe(count)
  })

  it('bounces and accumulates when hail crosses a collision top edge', () => {
    const renderer = createHailRenderer(createCanvases(createContext()), size, options)
    const particle = (renderer as unknown as { particles: MutableHailParticle[] }).particles[0]

    particle.x = 120
    particle.y = 90
    particle.vx = 0
    particle.vy = 900
    particle.radius = 3
    particle.alpha = 0.8
    particle.depth = 1
    particle.bounces = 0

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

    expect(particle.vy).toBeLessThan(0)
    expect(particle.bounces).toBe(1)
    expect(renderer.getActiveAccumulationCount()).toBeGreaterThan(0)
  })

  it('re-seeds hail motion when speed changes from zero', () => {
    const renderer = createHailRenderer(createCanvases(createContext()), size, {
      ...options,
      speed: 0,
      wind: 0,
    })
    const particles = (renderer as unknown as { particles: MutableHailParticle[] }).particles

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
    const renderer = createHailRenderer(createCanvases(context), size, options)

    renderer.destroy()

    expect(context.clearRect).toHaveBeenCalledWith(0, 0, 800, 600)
    expect(renderer.getParticleCount()).toBe(0)
    expect(renderer.getActiveAccumulationCount()).toBe(0)
  })

  it('triggers rolling state when hail hits a surface with horizontal velocity', () => {
    const renderer = createHailRenderer(createCanvases(createContext()), size, options)
    const particle = (renderer as any).particles[0]

    particle.x = 120
    particle.y = 98
    particle.vx = 40 // high horizontal speed to trigger roll
    particle.vy = 160
    particle.radius = 3
    particle.alpha = 0.8
    particle.depth = 1
    particle.bounces = 2 // forces no more bounces, goes to roll check

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
    expect(particle.rolling).toBe(true)
    expect(particle.vy).toBe(0)
  })

  it('settles overlapping pile particles horizontally', () => {
    const renderer = createHailRenderer(createCanvases(createContext()), size, options)
    const accumulationPool = (renderer as any).accumulation

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

    const target = (renderer as any).collisionTargets[0]
    // Spawn two overlapping particles at the same x=120, y=100
    accumulationPool.spawn(120, 100, 4, 0.8, 1, target)
    accumulationPool.spawn(120, 100, 4, 0.8, 1, target)

    const p1 = accumulationPool.particles[0]
    const p2 = accumulationPool.particles[1]

    expect(p1.x).toBe(120)
    expect(p2.x).toBe(120)

    // Render should trigger update() and settle/push them apart
    renderer.render(16)

    expect(Math.abs(p1.x - p2.x)).toBeGreaterThan(0)
  })
})
