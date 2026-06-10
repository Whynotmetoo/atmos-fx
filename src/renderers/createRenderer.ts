import type { NormalizedAtmosphereOptions } from '../core/types'
import type { CanvasLayerSize } from '../dom/canvasLayer'
import { createHailRenderer } from './canvas2d/hail'
import { createRainRenderer } from './canvas2d/rain'
import { createSnowRenderer } from './canvas2d/snow'
import type { Canvas2DRenderer, RendererCanvases } from './canvas2d/types'
import { createWebGLHailRenderer } from './webgl/hail'
import { createWebGLRainRenderer } from './webgl/rain'
import { createWebGLSnowRenderer } from './webgl/snow'

export function createRenderer(
  canvases: RendererCanvases,
  size: CanvasLayerSize,
  options: NormalizedAtmosphereOptions,
): Canvas2DRenderer {
  const shouldTryWebGL =
    options.renderer === 'webgl' || options.renderer === 'auto'

  if (shouldTryWebGL) {
    if (options.particle === 'rain') {
      const webglRenderer = createWebGLRainRenderer(canvases, size, options)
      if (webglRenderer) {
        return webglRenderer
      }
    } else if (options.particle === 'snow') {
      const webglRenderer = createWebGLSnowRenderer(canvases, size, options)
      if (webglRenderer) {
        return webglRenderer
      }
    } else if (options.particle === 'hail') {
      const webglRenderer = createWebGLHailRenderer(canvases, size, options)
      if (webglRenderer) {
        return webglRenderer
      }
    }
  }

  if (options.particle === 'snow') {
    return createSnowRenderer(canvases, size, options)
  }

  if (options.particle === 'hail') {
    return createHailRenderer(canvases, size, options)
  }

  return createRainRenderer(canvases, size, options)
}
