export type CanvasLayer = {
  canvas: HTMLCanvasElement
  backgroundCanvas: HTMLCanvasElement
  foregroundCanvas: HTMLCanvasElement
  getSize(): CanvasLayerSize
  resize(): CanvasLayerSize
  destroy(): void
}

export type CanvasLayerSize = {
  width: number
  height: number
  pixelRatio: number
  canvasWidth: number
  canvasHeight: number
}

const MAX_DEVICE_PIXEL_RATIO = 2

function getPixelRatio(): number {
  if (typeof window === 'undefined') {
    return 1
  }

  return Math.max(1, Math.min(MAX_DEVICE_PIXEL_RATIO, window.devicePixelRatio || 1))
}

function getRootSize(root: HTMLElement): { width: number; height: number } {
  const rect = root.getBoundingClientRect()

  return {
    width: Math.max(0, rect.width || root.clientWidth),
    height: Math.max(0, rect.height || root.clientHeight),
  }
}

export function createCanvasLayer(root: HTMLElement): CanvasLayer {
  const backgroundCanvas = root.ownerDocument.createElement('canvas')
  const foregroundCanvas = root.ownerDocument.createElement('canvas')
  const previousPosition = root.style.position
  const computedPosition =
    typeof window === 'undefined' ? '' : window.getComputedStyle(root).position
  const shouldSetPosition =
    previousPosition === 'static' ||
    (!previousPosition && (!computedPosition || computedPosition === 'static'))

  const setupCanvas = (canvas: HTMLCanvasElement, layer: string, zIndex: string) => {
    canvas.dataset.atomsLayer = layer
    canvas.setAttribute('aria-hidden', 'true')
    canvas.style.position = 'absolute'
    canvas.style.inset = '0'
    canvas.style.width = '100%'
    canvas.style.height = '100%'
    canvas.style.pointerEvents = 'none'
    canvas.style.zIndex = zIndex
  }

  setupCanvas(backgroundCanvas, 'weather-background', '0')
  setupCanvas(foregroundCanvas, 'weather-foreground', '2')

  if (shouldSetPosition) {
    root.style.position = 'relative'
  }

  root.prepend(backgroundCanvas)
  root.append(foregroundCanvas)

  let size: CanvasLayerSize = {
    width: 0,
    height: 0,
    pixelRatio: getPixelRatio(),
    canvasWidth: 0,
    canvasHeight: 0,
  }

  const resize = () => {
    const { width, height } = getRootSize(root)
    const pixelRatio = getPixelRatio()
    const nextWidth = Math.round(width * pixelRatio)
    const nextHeight = Math.round(height * pixelRatio)

    if (backgroundCanvas.width !== nextWidth) {
      backgroundCanvas.width = nextWidth
    }

    if (foregroundCanvas.width !== nextWidth) {
      foregroundCanvas.width = nextWidth
    }

    if (backgroundCanvas.height !== nextHeight) {
      backgroundCanvas.height = nextHeight
    }

    if (foregroundCanvas.height !== nextHeight) {
      foregroundCanvas.height = nextHeight
    }

    size = {
      width,
      height,
      pixelRatio,
      canvasWidth: nextWidth,
      canvasHeight: nextHeight,
    }

    return size
  }

  resize()

  return {
    canvas: backgroundCanvas,
    backgroundCanvas,
    foregroundCanvas,
    getSize() {
      return size
    },
    resize,
    destroy() {
      backgroundCanvas.remove()
      foregroundCanvas.remove()
      root.style.position = previousPosition
    },
  }
}
