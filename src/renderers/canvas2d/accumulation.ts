import type { CanvasLayerSize } from '../../dom/canvasLayer'

type AccumulationParticle = {
  active: boolean
  x: number
  y: number
  radius: number
  alpha: number
  depth: number
}

export class AccumulationPool {
  particles: AccumulationParticle[] = []
  private cursor = 0

  constructor(private maxSize = 0) {
    this.syncBudget(maxSize)
  }

  syncBudget(maxSize: number) {
    this.maxSize = Math.max(0, Math.floor(maxSize))

    if (this.particles.length > this.maxSize) {
      this.particles.length = this.maxSize
    }

    while (this.particles.length < this.maxSize) {
      this.particles.push({
        active: false,
        x: 0,
        y: 0,
        radius: 0,
        alpha: 0,
        depth: 0,
      })
    }

    if (this.cursor >= this.maxSize) {
      this.cursor = 0
    }
  }

  spawn(x: number, y: number, radius: number, alpha: number, depth: number) {
    if (this.maxSize <= 0) {
      return
    }

    const particle = this.particles[this.cursor]
    particle.active = true
    particle.x = x
    particle.y = y
    particle.radius = radius
    particle.alpha = alpha
    particle.depth = depth
    this.cursor = (this.cursor + 1) % this.maxSize
  }

  render(context: CanvasRenderingContext2D, size: CanvasLayerSize, color: string) {
    context.fillStyle = color

    for (let index = 0; index < this.particles.length; index += 1) {
      const particle = this.particles[index]

      if (
        !particle.active ||
        particle.x < -particle.radius ||
        particle.x > size.width + particle.radius ||
        particle.y < -particle.radius ||
        particle.y > size.height + particle.radius
      ) {
        continue
      }

      context.globalAlpha = particle.alpha
      context.beginPath()
      context.arc(
        particle.x,
        particle.y - particle.radius * 0.45,
        particle.radius * (0.85 + particle.depth * 0.2),
        0,
        Math.PI * 2,
      )
      context.fill()
    }
  }

  clear() {
    for (let index = 0; index < this.particles.length; index += 1) {
      this.particles[index].active = false
    }
  }

  destroy() {
    this.particles = []
    this.cursor = 0
  }

  getActiveCount() {
    let count = 0

    for (let index = 0; index < this.particles.length; index += 1) {
      if (this.particles[index].active) {
        count += 1
      }
    }

    return count
  }

  getCapacity() {
    return this.maxSize
  }
}
