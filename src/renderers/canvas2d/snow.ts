import type { NormalizedAtmosphereOptions } from '../../core/types'
import type { CanvasLayerSize } from '../../dom/canvasLayer'
import type { CollisionTargetRect } from '../../dom/collisionTargets'
import { AccumulationPool } from './accumulation'
import { findTopEdgeCollision } from './collision'
import { calculateAccumulationBudget, calculateSnowParticleBudget } from './quality'
import type { Canvas2DRenderer, RendererCanvases } from './types'

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
  readonly backend = 'canvas2d' as const
  private readonly backgroundContext: CanvasRenderingContext2D | null
  private readonly foregroundContext: CanvasRenderingContext2D | null
  private readonly accumulation = new AccumulationPool()
  private particles: SnowParticle[] = []
  private collisionTargets: readonly CollisionTargetRect[] = []
  private collisionTargetSignature = ''
  private lastTime: number | undefined
  private size: CanvasLayerSize
  private options: NormalizedAtmosphereOptions

  constructor(
    canvases: RendererCanvases,
    size: CanvasLayerSize,
    options: NormalizedAtmosphereOptions,
  ) {
    this.backgroundContext = canvases.background.getContext('2d')
    this.foregroundContext = canvases.foreground.getContext('2d')
    this.size = size
    this.options = options
    this.syncBudgets(true)
  }

  resize(size: CanvasLayerSize) {
    if (size.width !== this.size.width || size.height !== this.size.height) {
      this.accumulation.clear()
    }

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
    const nextSignature = targets
      .map((target) => `${target.x},${target.y},${target.width},${target.height}`)
      .join('|')

    if (nextSignature !== this.collisionTargetSignature) {
      this.accumulation.clear()
      this.collisionTargetSignature = nextSignature
    }

    this.collisionTargets = targets
  }

  render(time: number) {
    if (
      (!this.backgroundContext && !this.foregroundContext) ||
      this.size.width <= 0 ||
      this.size.height <= 0
    ) {
      return
    }

    const deltaSeconds =
      this.lastTime === undefined
        ? 1 / 60
        : Math.min(MAX_DELTA_SECONDS, Math.max(0, (time - this.lastTime) / 1000))

    this.lastTime = time

    const context = this.backgroundContext
    const pixelRatio = this.size.pixelRatio

    if (context) {
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
      context.clearRect(0, 0, this.size.width, this.size.height)
      context.fillStyle = this.options.color
    }

    if (this.foregroundContext) {
      this.foregroundContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
      this.foregroundContext.clearRect(0, 0, this.size.width, this.size.height)
    }

    for (let index = 0; index < this.particles.length; index += 1) {
      const particle = this.particles[index]
      const previousDrawX = particle.x + Math.sin(particle.phase) * particle.drift
      const previousY = particle.y
      particle.phase += particle.phaseSpeed * deltaSeconds
      particle.x += particle.vx * deltaSeconds
      particle.y += particle.vy * deltaSeconds

      const drawX = particle.x + Math.sin(particle.phase) * particle.drift
      const collision =
        this.options.snowAccumulation > 0 && particle.vy > 0
          ? this.findSnowLanding(previousDrawX, previousY, drawX, particle.y)
          : undefined

      if (collision) {
        this.accumulation.spawn(
          collision.x,
          collision.y,
          particle.radius * randomRange(0.65, 1.2),
          Math.min(0.82, particle.alpha * (0.58 + this.options.snowAccumulation * 0.42)),
          particle.depth,
          collision.target ?? null,
        )
        recycleParticle(particle, this.size, this.options)
        continue
      }

      if (
        particle.y - particle.radius > this.size.height ||
        drawX > this.size.width * 1.15 ||
        drawX < -this.size.width * 0.15
      ) {
        recycleParticle(particle, this.size, this.options)
      }

      const flakeX = particle.x + Math.sin(particle.phase) * particle.drift

      if (context) {
        context.globalAlpha = particle.alpha
        context.beginPath()
        context.arc(flakeX, particle.y, particle.radius, 0, FULL_TURN)
        context.fill()
      }
    }

    if (this.options.snowAccumulation > 0) {
      this.accumulation.update(deltaSeconds, this.options, this.collisionTargets, this.size)
    }

    if (this.foregroundContext) {
      this.accumulation.render(this.foregroundContext, this.size, this.options.color)
      this.foregroundContext.globalAlpha = 1
    }

    if (context) {
      context.globalAlpha = 1
    }
  }

  clear() {
    this.accumulation.clear()

    for (const context of [this.backgroundContext, this.foregroundContext]) {
      if (context) {
        context.setTransform(this.size.pixelRatio, 0, 0, this.size.pixelRatio, 0, 0)
        context.clearRect(0, 0, this.size.width, this.size.height)
      }
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

  private findSnowLanding(
    previousX: number,
    previousY: number,
    nextX: number,
    nextY: number,
  ): { x: number; y: number; target?: CollisionTargetRect } | undefined {
    const collision = findTopEdgeCollision(
      previousX,
      previousY,
      nextX,
      nextY,
      this.collisionTargets,
    )

    if (collision) {
      return collision
    }

    if (previousY <= this.size.height && nextY >= this.size.height) {
      const progress = (this.size.height - previousY) / (nextY - previousY)
      return {
        x: previousX + (nextX - previousX) * progress,
        y: this.size.height,
      }
    }

    return undefined
  }

  private syncBudgets(initial: boolean) {
    const particleBudget = calculateSnowParticleBudget({
      width: this.size.width,
      height: this.size.height,
      density: this.options.density,
      quality: this.options.quality,
    })
    const accumulationBudget =
      this.options.snowAccumulation <= 0
        ? 0
        : calculateAccumulationBudget({
            width: this.size.width,
            height: this.size.height,
            density: this.options.density * this.options.snowAccumulation,
            quality: this.options.quality,
          })

    this.accumulation.syncBudget(accumulationBudget)

    if (particleBudget < this.particles.length) {
      this.particles.length = particleBudget
      return
    }

    while (this.particles.length < particleBudget) {
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
  canvases: RendererCanvases,
  size: CanvasLayerSize,
  options: NormalizedAtmosphereOptions,
): SnowRenderer {
  return new SnowRenderer(canvases, size, options)
}
