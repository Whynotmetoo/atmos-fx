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
  renderer: 'webgl',
  density: 0.7,
  speed: 1,
  wind: -0.12,
  color: 'rgba(220, 235, 255, 0.72)',
  quality: 'medium',
  transparency: 'glass',
  contentOpacity: 0.72,
  surfaceOpacity: 0.14,
  snowAccumulation: 0.55,
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

  it('falls back to Canvas 2D when WebGL is unavailable', () => {
    const renderer = createRenderer(createCanvases(null), size, options)

    expect(renderer.backend).toBe('canvas2d')
    expect(renderer.getStats().particleCount).toBeGreaterThan(0)
  })

  it('keeps non-rain particles on Canvas 2D for the foundation pass', () => {
    const renderer = createRenderer(createCanvases(createWebGLContext()), size, {
      ...options,
      preset: 'snow',
      particle: 'snow',
      renderer: 'auto',
    })

    expect(renderer.backend).toBe('canvas2d')
  })
})
