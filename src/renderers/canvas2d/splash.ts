import type { CanvasLayerSize } from '../../dom/canvasLayer'

type SplashParticle = {
  active: boolean
  x: number
  y: number
  vx: number
  vy: number
  age: number
  lifetime: number
  length: number
  width: number
  alpha: number
}

const MAX_SPLASH_PARTICLES = 320
const SPLASH_PARTICLES_PER_HIT = 5

function randomRange(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

export class SplashPool {
  private readonly particles: SplashParticle[]
  private cursor = 0

  constructor(maxParticles = MAX_SPLASH_PARTICLES) {
    this.particles = Array.from({ length: maxParticles }, () => ({
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      age: 0,
      lifetime: 0,
      length: 0,
      width: 0,
      alpha: 0,
    }))
  }

  spawn(x: number, y: number, sourceVx: number, depth: number) {
    const count = Math.max(2, Math.round(SPLASH_PARTICLES_PER_HIT * depth))

    for (let index = 0; index < count; index += 1) {
      const particle = this.particles[this.cursor]
      const direction = index % 2 === 0 ? -1 : 1
      const spread = randomRange(42, 145) * direction * randomRange(0.55, 1)

      particle.active = true
      particle.x = x
      particle.y = y
      particle.vx = sourceVx * 0.16 + spread
      particle.vy = -randomRange(78, 190) * depth
      particle.age = 0
      particle.lifetime = randomRange(0.18, 0.34)
      particle.length = randomRange(4, 9) * depth
      particle.width = randomRange(0.7, 1.3) * depth
      particle.alpha = randomRange(0.32, 0.72) * depth
      this.cursor = (this.cursor + 1) % this.particles.length
    }
  }

  render(
    context: CanvasRenderingContext2D,
    deltaSeconds: number,
    size: CanvasLayerSize,
    color: string,
  ) {
    context.strokeStyle = color

    for (const particle of this.particles) {
      if (!particle.active) {
        continue
      }

      particle.age += deltaSeconds

      if (particle.age >= particle.lifetime) {
        particle.active = false
        continue
      }

      particle.vy += 520 * deltaSeconds
      particle.x += particle.vx * deltaSeconds
      particle.y += particle.vy * deltaSeconds

      if (
        particle.x < -20 ||
        particle.x > size.width + 20 ||
        particle.y < -20 ||
        particle.y > size.height + 20
      ) {
        particle.active = false
        continue
      }

      const lifeProgress = particle.age / particle.lifetime
      const alpha = particle.alpha * (1 - lifeProgress)
      const tailX = particle.x - particle.vx * 0.012
      const tailY = particle.y - particle.vy * 0.012 - particle.length

      context.globalAlpha = alpha
      context.lineWidth = particle.width
      context.beginPath()
      context.moveTo(tailX, tailY)
      context.lineTo(particle.x, particle.y)
      context.stroke()
    }
  }

  clear() {
    for (const particle of this.particles) {
      particle.active = false
    }
  }

  getActiveCount() {
    let count = 0

    for (const particle of this.particles) {
      if (particle.active) {
        count += 1
      }
    }

    return count
  }
}
