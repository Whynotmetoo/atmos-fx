import type { NormalizedAtmosphereOptions } from '../../core/types'
import type { CanvasLayerSize } from '../../dom/canvasLayer'
import type { CollisionTargetRect } from '../../dom/collisionTargets'

export type ActiveRendererBackend = 'canvas2d' | 'webgl'

export type RendererCanvases = {
  background: HTMLCanvasElement
  foreground: HTMLCanvasElement
}

export type RendererStats = {
  backend: ActiveRendererBackend
  particleCount: number
}

export type Canvas2DRenderer = {
  readonly backend: ActiveRendererBackend
  resize(size: CanvasLayerSize): void
  updateOptions(options: NormalizedAtmosphereOptions): void
  setCollisionTargets(targets: readonly CollisionTargetRect[]): void
  render(time: number): void
  clear(): void
  destroy(): void
  getStats(): RendererStats
  spawnSplash?(x: number, y: number, vx: number, depth?: number): void
}
