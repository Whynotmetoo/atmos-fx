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
}

function createContext() {
  return {
    setTransform: vi.fn(),
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    lineCap: 'butt',
    lineWidth: 1,
    globalAlpha: 1,
    strokeStyle: '',
  } as unknown as CanvasRenderingContext2D
}

function createCanvas(context: CanvasRenderingContext2D) {
  const canvas = document.createElement('canvas')
  vi.spyOn(canvas, 'getContext').mockReturnValue(context)
  return canvas
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
  density: 0.7,
  speed: 1,
  wind: -0.12,
  color: 'rgba(220, 235, 255, 0.72)',
  quality: 'medium',
  transparency: 'glass',
  collisionSelector: '[data-atoms-collision]',
  opaqueSelector: '[data-atoms-opaque]',
  pauseWhenHidden: true,
  respectReducedMotion: true,
}

describe('RainRenderer', () => {
  it('creates a particle pool from the quality budget', () => {
    const renderer = createRainRenderer(createCanvas(createContext()), size, options)

    expect(renderer.getParticleCount()).toBeGreaterThan(0)
  })

  it('resizes the particle pool when density changes', () => {
    const renderer = createRainRenderer(createCanvas(createContext()), size, {
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
    const context = createContext()
    const renderer = createRainRenderer(createCanvas(context), size, options)
    const count = renderer.getParticleCount()

    renderer.render(16)
    renderer.render(32)

    expect(context.setTransform).toHaveBeenCalledWith(2, 0, 0, 2, 0, 0)
    expect(context.clearRect).toHaveBeenCalledWith(0, 0, 800, 600)
    expect(context.stroke).toHaveBeenCalled()
    expect(renderer.getParticleCount()).toBe(count)
  })

  it('clears the canvas and releases particles on destroy', () => {
    const context = createContext()
    const renderer = createRainRenderer(createCanvas(context), size, options)

    renderer.destroy()

    expect(context.clearRect).toHaveBeenCalledWith(0, 0, 800, 600)
    expect(renderer.getParticleCount()).toBe(0)
  })

  it('clears the canvas without releasing particles', () => {
    const context = createContext()
    const renderer = createRainRenderer(createCanvas(context), size, options)
    const count = renderer.getParticleCount()

    renderer.clear()

    expect(context.clearRect).toHaveBeenCalledWith(0, 0, 800, 600)
    expect(renderer.getParticleCount()).toBe(count)
  })

  it('spawns splash particles when rain crosses a collision top edge', () => {
    const renderer = createRainRenderer(createCanvas(createContext()), size, options)
    const particle = (renderer as unknown as { particles: MutableRainParticle[] }).particles[0]

    particle.x = 120
    particle.y = 90
    particle.vx = 0
    particle.vy = 1200
    particle.length = 18
    particle.width = 1
    particle.alpha = 0.7
    particle.depth = 1

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
})
