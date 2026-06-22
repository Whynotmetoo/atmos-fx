import type { CanvasLayerSize } from '../../dom/canvasLayer'
import type { CollisionTargetRect } from '../../dom/collisionTargets'

export type AccumulationParticle = {
  active: boolean
  x: number
  y: number
  radius: number
  alpha: number
  depth: number
  vx?: number
  vy?: number
  onSurface?: boolean
  target?: CollisionTargetRect | null
  age?: number
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
        vx: 0,
        vy: 0,
        onSurface: false,
        target: null,
        age: 0,
      })
    }

    if (this.cursor >= this.maxSize) {
      this.cursor = 0
    }
  }

  spawn(
    x: number,
    y: number,
    radius: number,
    alpha: number,
    depth: number,
    target: CollisionTargetRect | null = null,
  ) {
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
    particle.vx = 0
    particle.vy = 0
    particle.onSurface = true
    particle.target = target
    particle.age = 0

    this.cursor = (this.cursor + 1) % this.maxSize
  }

  update(
    deltaSeconds: number,
    options: { snowAccumulation?: number; wind?: number; speed?: number; bottomCollision?: boolean },
    collisionTargets: readonly CollisionTargetRect[],
    size: CanvasLayerSize,
  ) {
    const isSnow = options.snowAccumulation !== undefined && options.snowAccumulation > 0

    // 1. Physics update for collapse, sliding off, and gravity fall
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i]
      if (!p.active) {
        continue
      }

      p.age = (p.age ?? 0) + deltaSeconds

      if (p.onSurface) {
        // Slow packing down / melting - reduced from 0.008 to 0.004 for longer lifespan
        p.alpha = Math.max(0.08, p.alpha - 0.004 * deltaSeconds)

        // Slowly shrink particle radius as it melts
        p.radius = Math.max(1.0, p.radius - p.radius * 0.012 * deltaSeconds)

        if (p.target) {
          // Sync coordinate with target in case it moved
          const currentTarget = collisionTargets.find(
            (t) =>
              Math.abs(t.x - p.target!.x) < 4 &&
              Math.abs(t.y - p.target!.y) < 4 &&
              Math.abs(t.width - p.target!.width) < 4,
          )
          if (currentTarget) {
            p.target = currentTarget
            p.y = currentTarget.y
          } else {
            p.onSurface = false
            p.target = null
          }
        }
      } else {
        // Falling
        const gravity = (isSnow ? 50 : 280) * p.depth
        p.vy = (p.vy ?? 0) + gravity * deltaSeconds
        p.x += (p.vx ?? 0) * deltaSeconds
        p.y += p.vy * deltaSeconds

        let landed = false
        // Check if it lands on a target
        for (const target of collisionTargets) {
          if (p.y >= target.y && p.y - p.vy * deltaSeconds <= target.y) {
            if (p.x >= target.x && p.x <= target.right) {
              p.y = target.y
              p.vy = 0
              p.vx = 0
              p.onSurface = true
              p.target = target
              landed = true
              break
            }
          }
        }

        if (!landed) {
          if (p.y >= size.height) {
            if (options.bottomCollision) {
              p.y = size.height
              p.vy = 0
              p.vx = 0
              p.onSurface = true
              p.target = null
            } else {
              p.active = false
            }
          }
        }

        if (p.y > size.height + 20) {
          p.active = false
        }
      }
    }

    // 2. Overlap settling and spreading (pure horizontal flattening)
    for (let i = 0; i < this.particles.length; i++) {
      const p1 = this.particles[i]
      if (!p1.active || !p1.onSurface) {
        continue
      }

      for (let j = i + 1; j < this.particles.length; j++) {
        const p2 = this.particles[j]
        if (!p2.active || !p2.onSurface || p1.target !== p2.target) {
          continue
        }

        const dx = p2.x - p1.x
        const dy = p2.y - p1.y
        const minHorizontalDist = (p1.radius + p2.radius) * 0.95

        if (Math.abs(dx) < minHorizontalDist && Math.abs(dy) < 5) {
          const overlap = minHorizontalDist - Math.abs(dx)
          const dir = dx === 0 ? (Math.random() > 0.5 ? 1 : -1) : Math.sign(dx)
          const shift = dir * overlap * 0.3

          p2.x += shift
          p1.x -= shift

          if (p1.target) {
            p1.x = Math.max(p1.target.x - 2, Math.min(p1.target.right + 2, p1.x))
            p2.x = Math.max(p1.target.x - 2, Math.min(p1.target.right + 2, p2.x))
          } else {
            p1.x = Math.max(0, Math.min(size.width, p1.x))
            p2.x = Math.max(0, Math.min(size.width, p2.x))
          }
        }
      }
    }
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
