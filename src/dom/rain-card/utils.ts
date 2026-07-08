export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function randomBetween(
  min: number,
  max: number,
  transform: (v: number) => number = (v) => v,
): number {
  return min + transform(Math.random()) * (max - min)
}

export function chance(probability: number): boolean {
  return Math.random() <= probability
}

export function createOffscreenCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

export type ImageLike = HTMLImageElement | HTMLCanvasElement

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = async () => {
      try {
        await img.decode()
        resolve(img)
      } catch (err) {
        reject(err)
      }
    }
    img.onerror = () => reject(new Error(`Failed to load image: ${src.slice(0, 40)}…`))
    img.src = src
  })
}
