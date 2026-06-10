import type { NormalizedAtmosphereOptions } from '../core/types'
import type { CanvasLayerSize } from '../dom/canvasLayer'
import { createHailRenderer } from './canvas2d/hail'
import { createRainRenderer } from './canvas2d/rain'
import { createSnowRenderer } from './canvas2d/snow'
import type { Canvas2DRenderer, RendererCanvases } from './canvas2d/types'
import { createWebGLRainRenderer } from './webgl/rain'

export function createRenderer(
  canvases: RendererCanvases,
  size: CanvasLayerSize,
  options: NormalizedAtmosphereOptions,
): Canvas2DRenderer {
  const shouldTryWebGL =
    options.particle === 'rain' && (options.renderer === 'webgl' || options.renderer === 'auto')

  if (shouldTryWebGL) {
    const webglRenderer = createWebGLRainRenderer(canvases, size, options)

    if (webglRenderer) {
      return webglRenderer
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
