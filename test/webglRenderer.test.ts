import { describe, expect, it, vi } from 'vitest'
import type { NormalizedAtmosphereOptions } from '../src/core/types'
import type { CanvasLayerSize } from '../src/dom/canvasLayer'
import { createRenderer } from '../src/renderers/createRenderer'
import { createWebGLRainRenderer } from '../src/renderers/webgl/rain'

function createWebGLContext() {
  return {
    VERTEX_SHADER: 0x8b31,
    FRAGMENT_SHADER: 0x8b30,
    COMPILE_STATUS: 0x8b81,
    LINK_STATUS: 0x8b82,
    ARRAY_BUFFER: 0x8892,
    DYNAMIC_DRAW: 0x88e8,
    FLOAT: 0x1406,
    LINES: 0x0001,
    COLOR_BUFFER_BIT: 0x4000,
    createShader: vi.fn(() => ({})),
    shaderSource: vi.fn(),
    compileShader: vi.fn(),
    getShaderParameter: vi.fn(() => true),
    deleteShader: vi.fn(),
    createProgram: vi.fn(() => ({})),
    attachShader: vi.fn(),
    linkProgram: vi.fn(),
    getProgramParameter: vi.fn(() => true),
    deleteProgram: vi.fn(),
    createBuffer: vi.fn(() => ({})),
    getAttribLocation: vi.fn((_program, name) => (name === 'a_position' ? 0 : 1)),
    getUniformLocation: vi.fn(() => ({})),
    viewport: vi.fn(),
    clearColor: vi.fn(),
    clear: vi.fn(),
    useProgram: vi.fn(),
    bindBuffer: vi.fn(),
    bufferData: vi.fn(),
    enableVertexAttribArray: vi.fn(),
    vertexAttribPointer: vi.fn(),
    uniform1f: vi.fn(),
    uniform2f: vi.fn(),
    uniform4f: vi.fn(),
    drawArrays: vi.fn(),
  } as unknown as WebGLRenderingContext
}

function createCanvas(context: WebGLRenderingContext | null) {
  const canvas = document.createElement('canvas')
  vi.spyOn(canvas, 'getContext').mockImplementation((contextId) => {
    if (contextId === 'webgl' || contextId === 'experimental-webgl') {
      return context
    }

    return null
  })
  return canvas
}

function createCanvases(context: WebGLRenderingContext | null) {
  return {
    background: createCanvas(context),
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
  preset: 'rain',
  particle: 'rain',
  density: 0.7,
  speed: 1,
  wind: -0.12,
  color: 'rgba(220, 235, 255, 0.72)',
  quality: 'medium',
  transparency: 'glass',
  contentOpacity: 0.72,
  surfaceOpacity: 0.14,
  snowAccumulation: 0.55,
  hailBounce: 0.5,
  bottomCollision: false,
  collisionSelector: '[data-atoms-collision]',
  opaqueSelector: '[data-atoms-opaque]',
  pauseWhenHidden: true,
  respectReducedMotion: true,
}

describe('WebGL renderer foundation', () => {
  it('creates and renders the initial WebGL rain path', () => {
    const context = createWebGLContext()
    const renderer = createWebGLRainRenderer(createCanvases(context), size, options)

    expect(renderer).toBeDefined()
    expect(renderer?.backend).toBe('webgl')
    expect(renderer?.getStats().particleCount).toBeGreaterThan(0)

    renderer?.render(16)
    renderer?.render(32)

    expect(context.viewport).toHaveBeenCalledWith(0, 0, 1600, 1200)
    expect(context.bufferData).toHaveBeenCalled()
    expect(context.drawArrays).toHaveBeenCalled()

    renderer?.destroy()
  })

  it('pauses drawing while the WebGL context is lost and resumes after restore', () => {
    const context = createWebGLContext()
    const canvases = createCanvases(context)
    const renderer = createWebGLRainRenderer(canvases, size, options)

    renderer?.render(16)
    const drawCountBeforeLoss = vi.mocked(context.drawArrays).mock.calls.length

    canvases.background.dispatchEvent(new Event('webglcontextlost', { cancelable: true }))
    renderer?.render(32)

    expect(context.drawArrays).toHaveBeenCalledTimes(drawCountBeforeLoss)

    canvases.background.dispatchEvent(new Event('webglcontextrestored'))
    renderer?.render(48)

    expect(vi.mocked(context.drawArrays).mock.calls.length).toBeGreaterThan(drawCountBeforeLoss)

    renderer?.destroy()
  })

  it('falls back to Canvas 2D dummy when WebGL is unavailable', () => {
    const renderer = createRenderer(createCanvases(null), size, options)

    expect(renderer.backend).toBe('canvas2d')
    expect(renderer.getStats().particleCount).toBe(0)
  })

  it('creates and renders the WebGL snow path', () => {
    const context = createWebGLContext()
    const renderer = createRenderer(createCanvases(context), size, {
      ...options,
      preset: 'snow',
      particle: 'snow',
    })

    expect(renderer.backend).toBe('webgl')
    expect(renderer.getStats().particleCount).toBeGreaterThan(0)

    renderer.render(16)
    renderer.render(32)

    expect(context.viewport).toHaveBeenCalled()
    expect(context.bufferData).toHaveBeenCalled()
    expect(context.drawArrays).toHaveBeenCalled()

    renderer.destroy()
  })

  it('creates and renders the WebGL hail path', () => {
    const context = createWebGLContext()
    const renderer = createRenderer(createCanvases(context), size, {
      ...options,
      preset: 'hail',
      particle: 'hail',
    })

    expect(renderer.backend).toBe('webgl')
    expect(renderer.getStats().particleCount).toBeGreaterThan(0)

    renderer.render(16)
    renderer.render(32)

    expect(context.viewport).toHaveBeenCalled()
    expect(context.bufferData).toHaveBeenCalled()
    expect(context.drawArrays).toHaveBeenCalled()

    renderer.destroy()
  })

  it('spawns splash particles when WebGL rain crosses a collision top edge', () => {
    const context = createWebGLContext()
    const renderer = createRenderer(createCanvases(context), size, {
      ...options,
      preset: 'rain',
      particle: 'rain',
    })

    expect(renderer.backend).toBe('webgl')
    const webglRenderer = renderer as any
    const particle = webglRenderer.particles.find(
      (candidate: any) => candidate.layer === 'foreground',
    )
    expect(particle).toBeDefined()

    // Move other particles away to prevent random noise
    for (const p of webglRenderer.particles) {
      if (p !== particle) {
        p.y = -500
        p.vy = 0
      }
    }

    particle.x = 120
    particle.y = 90
    particle.vx = 0
    particle.vy = 1200
    particle.length = 18
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
    expect(webglRenderer.getActiveSplashCount()).toBeGreaterThan(0)

    renderer.destroy()
  })

  it('spawns accumulation when WebGL snow lands on collision targets', () => {
    const context = createWebGLContext()
    const renderer = createRenderer(createCanvases(context), size, {
      ...options,
      preset: 'snow',
      particle: 'snow',
      snowAccumulation: 0.5,
    })

    expect(renderer.backend).toBe('webgl')
    const webglRenderer = renderer as any
    const particle = webglRenderer.particles[0]
    expect(particle).toBeDefined()

    particle.x = 120
    particle.y = 90
    particle.vx = 0
    particle.vy = 900
    particle.radius = 2
    particle.alpha = 0.7
    particle.depth = 1
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
    expect(webglRenderer.getActiveAccumulationCount()).toBeGreaterThan(0)

    renderer.destroy()
  })

  it('spawns accumulation and bounces when WebGL hail lands on collision targets', () => {
    const context = createWebGLContext()
    const renderer = createRenderer(createCanvases(context), size, {
      ...options,
      preset: 'hail',
      particle: 'hail',
    })

    expect(renderer.backend).toBe('webgl')
    const webglRenderer = renderer as any
    const particle = webglRenderer.particles[0]
    expect(particle).toBeDefined()

    particle.x = 120
    particle.y = 90
    particle.vx = 0
    particle.vy = 800
    particle.radius = 3
    particle.alpha = 0.7
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
    expect(webglRenderer.getActiveAccumulationCount()).toBeGreaterThan(0)
    expect(particle.bounces).toBe(1)
    expect(particle.vy).toBeLessThan(0)

    renderer.destroy()
  })

  it('correctly parses non-rgb/rgba CSS colors like Hex strings in WebGL for rain, snow, and hail', () => {
    // Test Rain
    {
      const context = createWebGLContext()
      const renderer = createRenderer(createCanvases(context), size, {
        ...options,
        color: '#9ccfff',
      })
      expect(renderer.backend).toBe('webgl')
      renderer.render(16)
      const calls = vi.mocked(context.uniform4f).mock.calls
      const match = calls.find((call) => Math.abs(call[1] - 156 / 255) < 0.05)
      expect(match).toBeDefined()
      renderer.destroy()
    }

    // Test Snow
    {
      const context = createWebGLContext()
      const renderer = createRenderer(createCanvases(context), size, {
        ...options,
        preset: 'snow',
        particle: 'snow',
        color: '#9ccfff',
      })
      expect(renderer.backend).toBe('webgl')
      renderer.render(16)
      const calls = vi.mocked(context.uniform4f).mock.calls
      const match = calls.find((call) => Math.abs(call[1] - 156 / 255) < 0.05)
      expect(match).toBeDefined()
      renderer.destroy()
    }

    // Test Hail
    {
      const context = createWebGLContext()
      const renderer = createRenderer(createCanvases(context), size, {
        ...options,
        preset: 'hail',
        particle: 'hail',
        color: '#9ccfff',
      })
      expect(renderer.backend).toBe('webgl')
      renderer.render(16)
      const calls = vi.mocked(context.uniform4f).mock.calls
      const match = calls.find((call) => Math.abs(call[1] - 156 / 255) < 0.05)
      expect(match).toBeDefined()
      renderer.destroy()
    }
  })

  it('handles bottomCollision options correctly for rain, snow, and hail', () => {
    // Test Rain bottom collision
    {
      const context = createWebGLContext()
      const renderer = createRenderer(createCanvases(context), size, {
        ...options,
        bottomCollision: true,
      })
      expect(renderer.backend).toBe('webgl')
      const webglRenderer = renderer as any
      const particle = webglRenderer.particles.find(
        (candidate: any) => candidate.layer === 'foreground',
      )
      expect(particle).toBeDefined()

      // Move other particles away to prevent random noise
      for (const p of webglRenderer.particles) {
        if (p !== particle) {
          p.y = -500
          p.vy = 0
        }
      }

      particle.x = 120
      particle.y = 590
      particle.vx = 0
      particle.vy = 1200
      particle.length = 18

      renderer.render(16)
      expect(webglRenderer.getActiveSplashCount()).toBeGreaterThan(0)
      renderer.destroy()
    }

    // Test Snow bottom collision
    {
      const context = createWebGLContext()
      const renderer = createRenderer(createCanvases(context), size, {
        ...options,
        preset: 'snow',
        particle: 'snow',
        bottomCollision: true,
        snowAccumulation: 0.5,
      })
      expect(renderer.backend).toBe('webgl')
      const webglRenderer = renderer as any
      const particle = webglRenderer.particles[0]
      expect(particle).toBeDefined()

      // Move other particles away to prevent random noise
      for (const p of webglRenderer.particles) {
        if (p !== particle) {
          p.y = -500
          p.vy = 0
        }
      }

      particle.x = 120
      particle.y = 590
      particle.vx = 0
      particle.vy = 900
      particle.radius = 2
      particle.drift = 0

      renderer.render(16)
      expect(webglRenderer.getActiveAccumulationCount()).toBeGreaterThan(0)
      renderer.destroy()
    }

    // Test Hail bottom collision
    {
      const context = createWebGLContext()
      const renderer = createRenderer(createCanvases(context), size, {
        ...options,
        preset: 'hail',
        particle: 'hail',
        bottomCollision: true,
      })
      expect(renderer.backend).toBe('webgl')
      const webglRenderer = renderer as any
      const particle = webglRenderer.particles[0]
      expect(particle).toBeDefined()

      // Move other particles away to prevent random noise
      for (const p of webglRenderer.particles) {
        if (p !== particle) {
          p.y = -500
          p.vy = 0
        }
      }

      particle.x = 120
      particle.y = 590
      particle.vx = 0
      particle.vy = 800
      particle.radius = 3

      renderer.render(16)
      expect(webglRenderer.getActiveAccumulationCount()).toBeGreaterThan(0)
      renderer.destroy()
    }
  })

  it('recycles background rain silently on card top edge crossings', () => {
    const context = createWebGLContext()
    const renderer = createRenderer(createCanvases(context), size, options)
    const webglRenderer = renderer as any

    // Move all other particles away to prevent random noise
    for (const p of webglRenderer.particles) {
      p.y = -500
      p.vy = 0
    }

    const particle = webglRenderer.particles[0] // background count is index 0
    expect(particle).toBeDefined()

    particle.x = 120
    particle.y = 90
    particle.vx = 0
    particle.vy = 1200
    particle.length = 18

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
    // Background rain should recycle silently (no splash created)
    expect(webglRenderer.getActiveSplashCount()).toBe(0)
    renderer.destroy()
  })
})
