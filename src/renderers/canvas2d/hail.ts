import type { NormalizedAtmosphereOptions } from '../../core/types'
import type { CanvasLayerSize } from '../../dom/canvasLayer'
import type { CollisionTargetRect } from '../../dom/collisionTargets'
import { AccumulationPool } from './accumulation'
import { findTopEdgeCollision } from './collision'
import { calculateAccumulationBudget, calculateHailParticleBudget } from './quality'
import type { Canvas2DRenderer, RendererCanvases } from './types'

type HailParticle = {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  alpha: number
  depth: number
  bounces: number
}

const MAX_DELTA_SECONDS = 0.05
const FULL_TURN = Math.PI * 2

function randomRange(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

function recycleParticle(
  particle: HailParticle,
  size: CanvasLayerSize,
  options: NormalizedAtmosphereOptions,
  initial = false,
) {
  const depth = randomRange(0.42, 1)
  const speed = options.speed * randomRange(430, 780) * (0.75 + depth * 0.4)
  const wind = options.wind * randomRange(42, 126) * depth

  particle.depth = depth
  particle.x = randomRange(-size.width * 0.12, size.width * 1.12)
  particle.y = initial ? randomRange(-size.height, size.height) : randomRange(-size.height * 0.22, 0)
  particle.vx = wind
  particle.vy = speed
  particle.radius = randomRange(1.6, 4.2) * (0.76 + depth * 0.45)
  particle.alpha = randomRange(0.36, 0.86) * (0.6 + depth * 0.4)
  particle.bounces = 0
}

export class HailRenderer implements Canvas2DRenderer {
  readonly backend = 'canvas2d' as const
  private readonly context: CanvasRenderingContext2D | null
  private particles: HailParticle[] = []
  private collisionTargets: readonly CollisionTargetRect[] = []
  private readonly accumulation = new AccumulationPool()
  private lastTime: number | undefined
  private size: CanvasLayerSize
  private options: NormalizedAtmosphereOptions

  constructor(
    canvases: RendererCanvases,
    size: CanvasLayerSize,
    options: NormalizedAtmosphereOptions,
  ) {
    this.context = canvases.foreground.getContext('2d')
    this.size = size
    this.options = options
    this.syncBudgets(true)
  }

  resize(size: CanvasLayerSize) {
    this.size = size
    this.syncBudgets(true)
  }

  updateOptions(options: NormalizedAtmosphereOptions) {
    const shouldReseedMotion =
      options.speed !== this.options.speed || options.wind !== this.options.wind
    this.options = options
    this.syncBudgets(false)

    if (shouldReseedMotion) {
      for (const particle of this.particles) {
        recycleParticle(particle, this.size, this.options, true)
      }
    }
  }

  setCollisionTargets(targets: readonly CollisionTargetRect[]) {
    this.collisionTargets = targets
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
    context.lineWidth = 0.75
    context.strokeStyle = 'rgba(255, 255, 255, 0.52)'

    for (let index = 0; index < this.particles.length; index += 1) {
      const particle = this.particles[index]
      const previousX = particle.x
      const previousY = particle.y
      const gravity = 520 * (0.7 + particle.depth * 0.5) * this.options.speed

      particle.vy = Math.min(1120, particle.vy + gravity * deltaSeconds)

      const nextX = particle.x + particle.vx * deltaSeconds
      const nextY = particle.y + particle.vy * deltaSeconds
      const collision =
        particle.vy > 0
          ? findTopEdgeCollision(previousX, previousY, nextX, nextY, this.collisionTargets)
          : undefined

      if (collision) {
        const pileRadius = particle.radius * randomRange(0.42, 0.72)
        this.accumulation.spawn(
          collision.x,
          collision.y,
          pileRadius,
          Math.min(0.74, particle.alpha * 0.78),
          particle.depth,
        )

        if (particle.bounces < 2 && particle.vy > 150) {
          particle.x = collision.x
          particle.y = collision.y - particle.radius
          particle.vy = -particle.vy * randomRange(0.18, 0.3)
          particle.vx = particle.vx * 0.5 + randomRange(-44, 44) * particle.depth
          particle.bounces += 1
          continue
        }

        recycleParticle(particle, this.size, this.options)
        continue
      }

      particle.x = nextX
      particle.y = nextY

      if (
        particle.y - particle.radius > this.size.height ||
        particle.x > this.size.width * 1.15 ||
        particle.x < -this.size.width * 0.15
      ) {
        recycleParticle(particle, this.size, this.options)
        continue
      }

      context.fillStyle = this.options.color
      context.globalAlpha = particle.alpha
      context.beginPath()
      context.arc(particle.x, particle.y, particle.radius, 0, FULL_TURN)
      context.fill()
      context.stroke()

      context.fillStyle = 'rgba(255, 255, 255, 0.78)'
      context.globalAlpha = particle.alpha * 0.55
      context.beginPath()
      context.arc(
        particle.x - particle.radius * 0.28,
        particle.y - particle.radius * 0.32,
        particle.radius * 0.32,
        0,
        FULL_TURN,
      )
      context.fill()
    }

    this.accumulation.render(context, this.size, this.options.color)
    context.globalAlpha = 1
  }

  clear() {
    this.accumulation.clear()

    if (this.context) {
      this.context.setTransform(this.size.pixelRatio, 0, 0, this.size.pixelRatio, 0, 0)
      this.context.clearRect(0, 0, this.size.width, this.size.height)
    }
  }

  destroy() {
    this.clear()
    this.accumulation.destroy()
    this.particles = []
    this.lastTime = undefined
  }

  getParticleCount() {
    return this.particles.length
  }

  getActiveAccumulationCount() {
    return this.accumulation.getActiveCount()
  }

  getAccumulationCapacity() {
    return this.accumulation.getCapacity()
  }

  getStats() {
    return {
      backend: this.backend,
      particleCount: this.particles.length,
    }
  }

  private syncBudgets(initial: boolean) {
    const particleBudget = calculateHailParticleBudget({
      width: this.size.width,
      height: this.size.height,
      density: this.options.density,
      quality: this.options.quality,
    })
    const accumulationBudget = calculateAccumulationBudget({
      width: this.size.width,
      height: this.size.height,
      density: this.options.density,
      quality: this.options.quality,
    })

    this.accumulation.syncBudget(accumulationBudget)

    if (particleBudget < this.particles.length) {
      this.particles.length = particleBudget
      return
    }

    while (this.particles.length < particleBudget) {
      const particle: HailParticle = {
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        radius: 0,
        alpha: 0,
        depth: 0,
        bounces: 0,
      }

      recycleParticle(particle, this.size, this.options, initial)
      this.particles.push(particle)
    }
  }
}

export function createHailRenderer(
  canvases: RendererCanvases,
  size: CanvasLayerSize,
  options: NormalizedAtmosphereOptions,
): HailRenderer {
  return new HailRenderer(canvases, size, options)
}
