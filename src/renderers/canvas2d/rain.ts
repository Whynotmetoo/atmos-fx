import type { NormalizedAtmosphereOptions } from '../../core/types'
import type { CanvasLayerSize } from '../../dom/canvasLayer'
import type { CollisionTargetRect } from '../../dom/collisionTargets'
import { findTopEdgeCollision } from './collision'
import { DripPool } from './drips'
import { calculateRainParticleBudget } from './quality'
import { SplashPool } from './splash'
import type { Canvas2DRenderer, RendererCanvases } from './types'

type RainParticleLayer = 'background' | 'foreground'

type RainParticle = {
  x: number
  y: number
  vx: number
  vy: number
  length: number
  width: number
  alpha: number
  depth: number
  layer: RainParticleLayer
}

const MAX_DELTA_SECONDS = 0.05

function randomRange(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

function recycleParticle(
  particle: RainParticle,
  size: CanvasLayerSize,
  options: NormalizedAtmosphereOptions,
  initial = false,
) {
  const depth = randomRange(0.35, 1)
  const speed = options.speed * randomRange(520, 980) * depth
  const wind = options.wind * randomRange(120, 260) * depth

  particle.depth = depth
  particle.x = randomRange(-size.width * 0.15, size.width * 1.15)
  particle.y = initial ? randomRange(-size.height, size.height) : randomRange(-size.height * 0.35, 0)
  particle.vx = wind
  particle.vy = speed
  particle.length = randomRange(10, 26) * depth * (0.8 + options.speed * 0.35)
  particle.width = randomRange(0.7, 1.6) * depth
  particle.alpha = randomRange(0.22, 0.78) * depth
}

export class RainRenderer implements Canvas2DRenderer {
  readonly backend = 'canvas2d' as const
  private readonly backgroundContext: CanvasRenderingContext2D | null
  private readonly foregroundContext: CanvasRenderingContext2D | null
  private particles: RainParticle[] = []
  private collisionTargets: readonly CollisionTargetRect[] = []
  private readonly splashes = new SplashPool()
  private readonly drips = new DripPool()
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
    this.syncParticleBudget(true)
  }

  resize(size: CanvasLayerSize) {
    this.size = size
    this.syncParticleBudget(true)
  }

  updateOptions(options: NormalizedAtmosphereOptions) {
    this.options = options
    this.syncParticleBudget(false)
  }

  setCollisionTargets(targets: readonly CollisionTargetRect[]) {
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

    const pixelRatio = this.size.pixelRatio

    this.prepareContext(this.backgroundContext, pixelRatio)
    this.prepareContext(this.foregroundContext, pixelRatio)

    for (let index = 0; index < this.particles.length; index += 1) {
      const particle = this.particles[index]
      const previousX = particle.x
      const previousY = particle.y
      const nextX = particle.x + particle.vx * deltaSeconds
      const nextY = particle.y + particle.vy * deltaSeconds
      const collision =
        particle.layer === 'foreground'
          ? findTopEdgeCollision(previousX, previousY, nextX, nextY, this.collisionTargets)
          : undefined

      if (collision) {
        this.splashes.spawn(collision.x, collision.y, particle.vx, particle.depth)
        if (this.options.rainDripping > 0 && Math.random() < this.options.rainDripping) {
          const target = collision.target
          const dripX = Math.max(target.x, Math.min(target.right, collision.x))
          this.drips.spawn(dripX, target.bottom, target)
        }
        recycleParticle(particle, this.size, this.options)
        continue
      }

      particle.x = nextX
      particle.y = nextY

      if (
        particle.y - particle.length > this.size.height ||
        particle.x > this.size.width * 1.2 ||
        particle.x < -this.size.width * 0.2
      ) {
        recycleParticle(particle, this.size, this.options)
      }

      const tailX = particle.x - particle.vx * 0.018
      const tailY = particle.y - particle.length
      const context =
        particle.layer === 'foreground' ? this.foregroundContext : this.backgroundContext

      if (context) {
        context.globalAlpha = particle.alpha
        context.lineWidth = particle.width
        context.beginPath()
        context.moveTo(tailX, tailY)
        context.lineTo(particle.x, particle.y)
        context.stroke()
      }
    }

    if (this.options.rainDripping > 0) {
      const gravity = 250 * this.options.speed
      this.drips.update(deltaSeconds, gravity, this.size.height, this.collisionTargets)
    }

    if (this.foregroundContext) {
      this.splashes.render(this.foregroundContext, deltaSeconds, this.size, this.options.color)

      if (this.options.rainDripping > 0) {
        this.foregroundContext.fillStyle = this.options.color
        for (const drip of this.drips.particles) {
          if (!drip.active) {
            continue
          }
          this.foregroundContext.globalAlpha = 0.85

          if (drip.state === 'gathering') {
            this.foregroundContext.beginPath()
            this.foregroundContext.arc(drip.x, drip.y - drip.size * 0.2, drip.size, 0, Math.PI * 2)
            this.foregroundContext.fill()
          } else {
            const tailY = drip.y - Math.min(8, drip.vy * 0.04)
            this.foregroundContext.strokeStyle = this.options.color
            this.foregroundContext.lineWidth = drip.size * 0.8
            this.foregroundContext.beginPath()
            this.foregroundContext.moveTo(drip.x, tailY)
            this.foregroundContext.lineTo(drip.x, drip.y)
            this.foregroundContext.stroke()
          }
        }
      }

      this.foregroundContext.globalAlpha = 1
    }

    if (this.backgroundContext) {
      this.backgroundContext.globalAlpha = 1
    }
  }

  clear() {
    this.splashes.clear()
    this.drips.clear()

    this.clearContext(this.backgroundContext)
    this.clearContext(this.foregroundContext)
  }

  destroy() {
    this.clear()
    this.particles = []
    this.lastTime = undefined
  }

  getParticleCount() {
    return this.particles.length
  }

  getActiveSplashCount() {
    return this.splashes.getActiveCount()
  }

  getActiveDripCount() {
    return this.drips.getActiveCount()
  }

  getBackgroundParticleCount() {
    return this.particles.reduce(
      (count, particle) => (particle.layer === 'background' ? count + 1 : count),
      0,
    )
  }

  getForegroundParticleCount() {
    return this.particles.length - this.getBackgroundParticleCount()
  }

  getStats() {
    return {
      backend: this.backend,
      particleCount: this.particles.length,
    }
  }

  private prepareContext(context: CanvasRenderingContext2D | null, pixelRatio: number) {
    if (!context) {
      return
    }

    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
    context.clearRect(0, 0, this.size.width, this.size.height)
    context.lineCap = 'round'
    context.strokeStyle = this.options.color
  }

  private clearContext(context: CanvasRenderingContext2D | null) {
    if (!context) {
      return
    }

    context.setTransform(this.size.pixelRatio, 0, 0, this.size.pixelRatio, 0, 0)
    context.clearRect(0, 0, this.size.width, this.size.height)
  }

  private syncParticleBudget(initial: boolean) {
    const budget = calculateRainParticleBudget({
      width: this.size.width,
      height: this.size.height,
      density: this.options.density,
      quality: this.options.quality,
    })
    const backgroundBudget = Math.floor(budget * 0.42)

    if (
      this.particles.length !== budget ||
      this.getBackgroundParticleCount() !== backgroundBudget
    ) {
      this.particles = []
    }

    while (this.particles.length < budget) {
      const layer: RainParticleLayer =
        this.particles.length < backgroundBudget ? 'background' : 'foreground'
      const particle: RainParticle = {
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        length: 0,
        width: 0,
        alpha: 0,
        depth: 0,
        layer,
      }

      recycleParticle(particle, this.size, this.options, initial)
      this.particles.push(particle)
    }
  }
}

export function createRainRenderer(
  canvases: RendererCanvases,
  size: CanvasLayerSize,
  options: NormalizedAtmosphereOptions,
): RainRenderer {
  return new RainRenderer(canvases, size, options)
}
