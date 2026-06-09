import type { NormalizedAtmosphereOptions } from '../../core/types'
import type { CanvasLayerSize } from '../../dom/canvasLayer'
import type { CollisionTargetRect } from '../../dom/collisionTargets'
import { findTopEdgeCollision } from './collision'
import { calculateRainParticleBudget } from './quality'
import { SplashPool } from './splash'
import type { Canvas2DRenderer } from './types'

type RainParticle = {
  x: number
  y: number
  vx: number
  vy: number
  length: number
  width: number
  alpha: number
  depth: number
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
  private readonly context: CanvasRenderingContext2D | null
  private particles: RainParticle[] = []
  private collisionTargets: readonly CollisionTargetRect[] = []
  private readonly splashes = new SplashPool()
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
    this.options = options
    this.syncParticleBudget(false)
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
    context.lineCap = 'round'
    context.strokeStyle = this.options.color

    for (let index = 0; index < this.particles.length; index += 1) {
      const particle = this.particles[index]
      const previousX = particle.x
      const previousY = particle.y
      const nextX = particle.x + particle.vx * deltaSeconds
      const nextY = particle.y + particle.vy * deltaSeconds
      const collision = findTopEdgeCollision(
        previousX,
        previousY,
        nextX,
        nextY,
        this.collisionTargets,
      )

      if (collision) {
        this.splashes.spawn(collision.x, collision.y, particle.vx, particle.depth)
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

      context.globalAlpha = particle.alpha
      context.lineWidth = particle.width
      context.beginPath()
      context.moveTo(tailX, tailY)
      context.lineTo(particle.x, particle.y)
      context.stroke()
    }

    this.splashes.render(context, deltaSeconds, this.size, this.options.color)
    context.globalAlpha = 1
  }

  clear() {
    this.splashes.clear()

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

  getActiveSplashCount() {
    return this.splashes.getActiveCount()
  }

  private syncParticleBudget(initial: boolean) {
    const budget = calculateRainParticleBudget({
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
      const particle: RainParticle = {
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        length: 0,
        width: 0,
        alpha: 0,
        depth: 0,
      }

      recycleParticle(particle, this.size, this.options, initial)
      this.particles.push(particle)
    }
  }
}

export function createRainRenderer(
  canvas: HTMLCanvasElement,
  size: CanvasLayerSize,
  options: NormalizedAtmosphereOptions,
): RainRenderer {
  return new RainRenderer(canvas, size, options)
}
