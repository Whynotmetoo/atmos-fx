import type { NormalizedAtmosphereOptions } from '../../core/types'
import type { CanvasLayerSize } from '../../dom/canvasLayer'
import type { CollisionTargetRect } from '../../dom/collisionTargets'
import { calculateSnowParticleBudget } from './quality'
import type { Canvas2DRenderer } from './types'

type SnowParticle = {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  alpha: number
  depth: number
  phase: number
  phaseSpeed: number
  drift: number
}

const MAX_DELTA_SECONDS = 0.05
const FULL_TURN = Math.PI * 2

function randomRange(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

function recycleParticle(
  particle: SnowParticle,
  size: CanvasLayerSize,
  options: NormalizedAtmosphereOptions,
  initial = false,
) {
  const depth = randomRange(0.28, 1)
  const speed = options.speed * randomRange(34, 116) * (0.45 + depth)
  const wind = options.wind * randomRange(20, 72) * depth

  particle.depth = depth
  particle.x = randomRange(-size.width * 0.12, size.width * 1.12)
  particle.y = initial ? randomRange(-size.height, size.height) : randomRange(-size.height * 0.18, 0)
  particle.vx = wind
  particle.vy = speed
  particle.radius = randomRange(0.8, 2.9) * (0.7 + depth * 0.7)
  particle.alpha = randomRange(0.24, 0.82) * (0.55 + depth * 0.45)
  particle.phase = randomRange(0, FULL_TURN)
  particle.phaseSpeed = randomRange(0.55, 1.65) * (0.7 + options.speed * 0.4)
  particle.drift = randomRange(7, 28) * depth
}

export class SnowRenderer implements Canvas2DRenderer {
  private readonly context: CanvasRenderingContext2D | null
  private particles: SnowParticle[] = []
  private lastTime: number | undefined
  private size: CanvasLayerSize
  private options: NormalizedAtmosphereOptions

  constructor(
    canvas: HTMLCanvasElement,
    size: CanvasLayerSize,
    options: NormalizedAtmosphereOptions,
  ) {
    this.context = canvas.getContext('2d')
    this.size = size
    this.options = options
    this.syncParticleBudget(true)
  }

  resize(size: CanvasLayerSize) {
    this.size = size
    this.syncParticleBudget(true)
  }

  updateOptions(options: NormalizedAtmosphereOptions) {
    const shouldReseedMotion =
      options.speed !== this.options.speed || options.wind !== this.options.wind
    this.options = options
    this.syncParticleBudget(false)

    if (shouldReseedMotion) {
      for (const particle of this.particles) {
        recycleParticle(particle, this.size, this.options, true)
      }
    }
  }

  setCollisionTargets(_targets: readonly CollisionTargetRect[]) {
    // Snow does not use collision targets in the first snow preset.
  }

  render(time: number) {
    if (!this.context || this.size.width <= 0 || this.size.height <= 0) {
      return
    }

    const deltaSeconds =
      this.lastTime === undefined
        ? 1 / 60
        : Math.min(MAX_DELTA_SECONDS, Math.max(0, (time - this.lastTime) / 1000))

    this.lastTime = time

    const context = this.context
    const pixelRatio = this.size.pixelRatio

    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
    context.clearRect(0, 0, this.size.width, this.size.height)
    context.fillStyle = this.options.color

    for (let index = 0; index < this.particles.length; index += 1) {
      const particle = this.particles[index]
      particle.phase += particle.phaseSpeed * deltaSeconds
      particle.x += particle.vx * deltaSeconds
      particle.y += particle.vy * deltaSeconds

      const drawX = particle.x + Math.sin(particle.phase) * particle.drift

      if (
        particle.y - particle.radius > this.size.height ||
        drawX > this.size.width * 1.15 ||
        drawX < -this.size.width * 0.15
      ) {
        recycleParticle(particle, this.size, this.options)
      }

      const flakeX = particle.x + Math.sin(particle.phase) * particle.drift

      context.globalAlpha = particle.alpha
      context.beginPath()
      context.arc(flakeX, particle.y, particle.radius, 0, FULL_TURN)
      context.fill()
    }

    context.globalAlpha = 1
  }

  clear() {
    if (this.context) {
      this.context.setTransform(this.size.pixelRatio, 0, 0, this.size.pixelRatio, 0, 0)
      this.context.clearRect(0, 0, this.size.width, this.size.height)
    }
  }

  destroy() {
    this.clear()
    this.particles = []
    this.lastTime = undefined
  }

  getParticleCount() {
    return this.particles.length
  }

  private syncParticleBudget(initial: boolean) {
    const budget = calculateSnowParticleBudget({
      width: this.size.width,
      height: this.size.height,
      density: this.options.density,
      quality: this.options.quality,
    })

    if (budget < this.particles.length) {
      this.particles.length = budget
      return
    }

    while (this.particles.length < budget) {
      const particle: SnowParticle = {
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        radius: 0,
        alpha: 0,
        depth: 0,
        phase: 0,
        phaseSpeed: 0,
        drift: 0,
      }

      recycleParticle(particle, this.size, this.options, initial)
      this.particles.push(particle)
    }
  }
}

export function createSnowRenderer(
  canvas: HTMLCanvasElement,
  size: CanvasLayerSize,
  options: NormalizedAtmosphereOptions,
): SnowRenderer {
  return new SnowRenderer(canvas, size, options)
}
