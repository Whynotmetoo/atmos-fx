import type { NormalizedAtmosphereOptions } from '../../core/types'
import type { CanvasLayerSize } from '../../dom/canvasLayer'
import type { CollisionTargetRect } from '../../dom/collisionTargets'

export type Canvas2DRenderer = {
  resize(size: CanvasLayerSize): void
  updateOptions(options: NormalizedAtmosphereOptions): void
  setCollisionTargets(targets: readonly CollisionTargetRect[]): void
  render(time: number): void
  clear(): void
  destroy(): void
}
