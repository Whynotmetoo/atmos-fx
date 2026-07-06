import { createOffscreenCanvas, type ImageLike } from './utils'

export const DROP_TEXTURE_SIZE = 64
export const DROP_DEPTH_LEVELS = 51
export const HIGHLIGHT_AREA_LEVELS = 5
export const MAX_DROP_DEPTH = 0.9

export function createDropTextures(
  dropAlpha: ImageLike,
  dropColor: ImageLike,
): HTMLCanvasElement[] {
  const textureCount = DROP_DEPTH_LEVELS * HIGHLIGHT_AREA_LEVELS
  const colorBuffer = createOffscreenCanvas(DROP_TEXTURE_SIZE, DROP_TEXTURE_SIZE)
  const colorCtx = colorBuffer.getContext('2d')!

  return Array.from({ length: textureCount }, (_, packedValue) => {
    const texture = createOffscreenCanvas(DROP_TEXTURE_SIZE, DROP_TEXTURE_SIZE)
    const textureCtx = texture.getContext('2d')!

    colorCtx.clearRect(0, 0, DROP_TEXTURE_SIZE, DROP_TEXTURE_SIZE)
    colorCtx.globalCompositeOperation = 'source-over'
    colorCtx.drawImage(dropColor, 0, 0, DROP_TEXTURE_SIZE, DROP_TEXTURE_SIZE)
    colorCtx.globalCompositeOperation = 'screen'
    colorCtx.fillStyle = `rgb(0,0,${packedValue})`
    colorCtx.fillRect(0, 0, DROP_TEXTURE_SIZE, DROP_TEXTURE_SIZE)

    textureCtx.drawImage(dropAlpha, 0, 0, DROP_TEXTURE_SIZE, DROP_TEXTURE_SIZE)
    textureCtx.globalCompositeOperation = 'source-in'
    textureCtx.drawImage(colorBuffer, 0, 0, DROP_TEXTURE_SIZE, DROP_TEXTURE_SIZE)

    return texture
  })
}

export function getDropTextureIndex(depth: number, highlightAreaLevel: number): number {
  const depthLevel = Math.round((depth / MAX_DROP_DEPTH) * (DROP_DEPTH_LEVELS - 1))
  return depthLevel * HIGHLIGHT_AREA_LEVELS + highlightAreaLevel
}
