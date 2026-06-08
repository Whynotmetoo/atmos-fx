import type { NormalizedAtmosphereOptions } from '../../core/types'
import type { CanvasLayerSize } from '../../dom/canvasLayer'

export type Canvas2DRenderer = {
  resize(size: CanvasLayerSize): void
  updateOptions(options: NormalizedAtmosphereOptions): void
  render(time: number): void
  destroy(): void
}
