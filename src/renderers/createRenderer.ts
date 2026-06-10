import type { NormalizedAtmosphereOptions } from '../core/types'
import type { CanvasLayerSize } from '../dom/canvasLayer'
import type { Canvas2DRenderer, RendererCanvases } from './canvas2d/types'
import { createWebGLHailRenderer } from './webgl/hail'
import { createWebGLRainRenderer } from './webgl/rain'
import { createWebGLSnowRenderer } from './webgl/snow'

function createDummyRenderer(canvases: RendererCanvases, size: CanvasLayerSize): Canvas2DRenderer {
  return {
    backend: 'canvas2d',
    resize(newSize) {
      size = newSize
    },
    updateOptions() {},
    setCollisionTargets() {},
    render() {},
    clear() {
      canvases.background.getContext('2d')?.clearRect(0, 0, size.width, size.height)
      canvases.foreground.getContext('2d')?.clearRect(0, 0, size.width, size.height)
    },
    destroy() {},
    getStats() {
      return { backend: 'canvas2d', particleCount: 0 }
    },
  }
}

export function createRenderer(
  canvases: RendererCanvases,
  size: CanvasLayerSize,
  options: NormalizedAtmosphereOptions,
): Canvas2DRenderer {
  if (options.particle === 'snow') {
    const webglRenderer = createWebGLSnowRenderer(canvases, size, options)
    if (webglRenderer) {
      return webglRenderer
    }
  } else if (options.particle === 'hail') {
    const webglRenderer = createWebGLHailRenderer(canvases, size, options)
    if (webglRenderer) {
      return webglRenderer
    }
  } else {
    // Default to rain
    const webglRenderer = createWebGLRainRenderer(canvases, size, options)
    if (webglRenderer) {
      return webglRenderer
    }
  }

  // Fallback to a safe, silent dummy renderer
  return createDummyRenderer(canvases, size)
}
