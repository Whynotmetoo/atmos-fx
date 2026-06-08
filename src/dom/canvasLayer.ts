export type CanvasLayer = {
  canvas: HTMLCanvasElement
  resize(): void
  destroy(): void
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
  const canvas = root.ownerDocument.createElement('canvas')
  const previousPosition = root.style.position
  const computedPosition =
    typeof window === 'undefined' ? '' : window.getComputedStyle(root).position

  canvas.dataset.atomsLayer = 'weather'
  canvas.setAttribute('aria-hidden', 'true')
  canvas.style.position = 'absolute'
  canvas.style.inset = '0'
  canvas.style.width = '100%'
  canvas.style.height = '100%'
  canvas.style.pointerEvents = 'none'
  canvas.style.zIndex = '0'

  if (!previousPosition && (!computedPosition || computedPosition === 'static')) {
    root.style.position = 'relative'
  }

  root.prepend(canvas)

  const resize = () => {
    const { width, height } = getRootSize(root)
    const pixelRatio = getPixelRatio()
    const nextWidth = Math.round(width * pixelRatio)
    const nextHeight = Math.round(height * pixelRatio)

    if (canvas.width !== nextWidth) {
      canvas.width = nextWidth
    }

    if (canvas.height !== nextHeight) {
      canvas.height = nextHeight
    }
  }

  resize()

  return {
    canvas,
    resize,
    destroy() {
      canvas.remove()
      root.style.position = previousPosition
    },
  }
}
