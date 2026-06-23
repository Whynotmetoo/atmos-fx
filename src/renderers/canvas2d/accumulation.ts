import type { CanvasLayerSize } from '../../dom/canvasLayer'
import type { CollisionTargetRect } from '../../dom/collisionTargets'
import { findTargetCollision } from './collision'

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
  offsetY?: number
  initialRadius?: number
  initialAlpha?: number
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
        offsetY: 0,
        initialRadius: 0,
        initialAlpha: 0,
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

    // Find the best slot to overwrite:
    // 1. First preference: an inactive particle
    // 2. Second preference: the active particle with the lowest alpha
    let bestIndex = -1
    let lowestAlpha = Infinity

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i]
      if (!p.active) {
        bestIndex = i
        break
      }
      if (p.alpha < lowestAlpha) {
        lowestAlpha = p.alpha
        bestIndex = i
      }
    }

    if (bestIndex === -1) {
      bestIndex = this.cursor
      this.cursor = (this.cursor + 1) % this.maxSize
    }

    const particle = this.particles[bestIndex]

    // Compute vertical stacking offset relative to the surface.
    // If a new particle lands near an existing one horizontally, it stacks on top of it.
    let startOffsetY = 0
    if (target) {
      for (let i = 0; i < this.particles.length; i++) {
        const p = this.particles[i]
        if (p.active && p.onSurface && p.target === target && i !== bestIndex) {
          const dx = Math.abs(p.x - x)
          const minDist = (p.radius + radius) * 1.0
          if (dx < minDist) {
            startOffsetY = Math.max(startOffsetY, (p.offsetY ?? 0) + p.radius * 1.3)
          }
        }
      }
    } else {
      for (let i = 0; i < this.particles.length; i++) {
        const p = this.particles[i]
        if (p.active && p.onSurface && p.target === null && i !== bestIndex) {
          const dx = Math.abs(p.x - x)
          const minDist = (p.radius + radius) * 1.0
          if (dx < minDist) {
            startOffsetY = Math.max(startOffsetY, (p.offsetY ?? 0) + p.radius * 1.3)
          }
        }
      }
    }

    particle.active = true
    particle.x = x
    particle.offsetY = startOffsetY
    particle.y = y - startOffsetY
    particle.radius = radius
    particle.initialRadius = radius
    particle.alpha = alpha
    particle.initialAlpha = alpha
    particle.depth = depth
    particle.vx = 0
    particle.vy = 0
    particle.onSurface = true
    particle.target = target
    particle.age = 0
  }

  update(
    deltaSeconds: number,
    options: { snowAccumulation?: number; wind?: number; speed?: number; bottomCollision?: boolean; hailBounce?: number },
    collisionTargets: readonly CollisionTargetRect[],
    size: CanvasLayerSize,
  ) {
    const isSnow = options.snowAccumulation !== undefined && options.snowAccumulation > 0
    const accumulationVal = options.snowAccumulation ?? 0.55

    // 1. Physics update for collapse, sliding off, and gravity fall
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i]
      if (!p.active) {
        continue
      }

      p.age = (p.age ?? 0) + deltaSeconds

      if (p.onSurface) {
        // Slow packing down / melting
        const baseMeltRate = isSnow ? 0.015 : 0.045
        const meltRate = baseMeltRate * Math.max(0.15, 1.2 - accumulationVal)

        p.alpha -= meltRate * deltaSeconds
        if (p.alpha <= 0.0) {
          p.active = false
          continue
        }

        // Shrink particle as it melts
        const ratio = p.initialAlpha && p.initialAlpha > 0 ? p.alpha / p.initialAlpha : 1.0
        p.radius = (p.initialRadius ?? p.radius) * Math.max(0.4, ratio)

        if (p.target) {
          // Sync coordinate with target in case it moved/scrolled
          let currentTarget: CollisionTargetRect | undefined
          for (let k = 0; k < collisionTargets.length; k++) {
            const t = collisionTargets[k]
            if (
              Math.abs(t.x - p.target.x) < 4 &&
              Math.abs(t.y - p.target.y) < 4 &&
              Math.abs(t.width - p.target.width) < 4
            ) {
              currentTarget = t
              break
            }
          }
          if (currentTarget) {
            p.target = currentTarget
            p.y = currentTarget.y - (p.offsetY ?? 0)
          } else {
            p.onSurface = false
            p.target = null
          }
        } else {
          // Sync bottom boundary coordinate if no target
          p.y = size.height - (p.offsetY ?? 0)
        }

        // Slide / falloff collapse if close to the edge of the card
        if (p.onSurface && p.target) {
          const distToLeft = p.x - p.target.x
          const distToRight = p.target.right - p.x
          const edgeThreshold = p.radius * 1.5

          if (distToLeft < edgeThreshold) {
            p.vx = -75 * (1.6 - distToLeft / edgeThreshold)
            p.x += p.vx * deltaSeconds
            if (p.x < p.target.x) {
              p.onSurface = false
              p.vy = 10 + Math.random() * 20
            }
          } else if (distToRight < edgeThreshold) {
            p.vx = 75 * (1.6 - distToRight / edgeThreshold)
            p.x += p.vx * deltaSeconds
            if (p.x > p.target.right) {
              p.onSurface = false
              p.vy = 10 + Math.random() * 20
            }
          }
        }
      } else {
        // Falling state: Apply horizontal damping (air resistance)
        const damping = Math.max(0, 1.0 - 4.5 * deltaSeconds)
        p.vx = (p.vx ?? 0) * damping

        // Slowly melt/fade during free fall
        p.alpha -= (isSnow ? 0.16 : 0.28) * deltaSeconds
        if (p.alpha <= 0.0) {
          p.active = false
          continue
        }

        const gravity = (isSnow ? 50 : 280) * p.depth
        p.vy = (p.vy ?? 0) + gravity * deltaSeconds

        const previousX = p.x
        const previousY = p.y
        const nextX = p.x + (p.vx ?? 0) * deltaSeconds
        const nextY = p.y + p.vy * deltaSeconds

        // Target collision detection (top, left, and right sides)
        const collision = findTargetCollision(previousX, previousY, nextX, nextY, collisionTargets)

        if (collision) {
          if (collision.type === 'top') {
            // Land on card top
            p.x = collision.x
            p.vy = 0
            p.vx = 0
            p.onSurface = true
            p.target = collision.target
            p.initialAlpha = p.alpha
            p.initialRadius = p.radius

            // Find starting offsetY stack height on the landed surface
            let startOffsetY = 0
            for (let j = 0; j < this.particles.length; j++) {
              const other = this.particles[j]
              if (other.active && other.onSurface && other.target === p.target && other !== p) {
                const dx = Math.abs(other.x - p.x)
                const minDist = (other.radius + p.radius) * 1.0
                if (dx < minDist) {
                  startOffsetY = Math.max(startOffsetY, (other.offsetY ?? 0) + other.radius * 1.3)
                }
              }
            }
            p.offsetY = startOffsetY
            p.y = collision.y - startOffsetY
          } else {
            // Card side wall collision
            if (isSnow) {
              // Snow bounces off card wall with a very small random horizontal speed
              const bounceSpeed = Math.random() * 20
              p.vx = collision.type === 'left' ? -bounceSpeed : bounceSpeed
              p.vy = p.vy * (0.7 + Math.random() * 0.2)
              p.x = collision.type === 'left' ? collision.target.x - p.radius - 1 : collision.target.right + p.radius + 1
              p.y = collision.y
            } else {
              // Hail bounces off card wall horizontally
              const bounceFactor = 0.48
              p.vx = - (p.vx ?? 0) * bounceFactor
              p.vy = p.vy * 0.75
              p.x = collision.type === 'left' ? collision.target.x - p.radius : collision.target.right + p.radius
              p.y = collision.y
            }
          }
        } else {
          // Check bottom collision
          let landedBottom = false
          if (nextY >= size.height) {
            if (options.bottomCollision) {
              const progress = (size.height - previousY) / (nextY - previousY || 1)
              p.x = previousX + (nextX - previousX) * progress
              p.vy = 0
              p.vx = 0
              p.onSurface = true
              p.target = null
              p.initialAlpha = p.alpha
              p.initialRadius = p.radius
              landedBottom = true

              // Find starting offsetY stack height on container bottom
              let startOffsetY = 0
              for (let j = 0; j < this.particles.length; j++) {
                const other = this.particles[j]
                if (other.active && other.onSurface && other.target === null && other !== p) {
                  const dx = Math.abs(other.x - p.x)
                  const minDist = (other.radius + p.radius) * 1.0
                  if (dx < minDist) {
                    startOffsetY = Math.max(startOffsetY, (other.offsetY ?? 0) + other.radius * 1.3)
                  }
                }
              }
              p.offsetY = startOffsetY
              p.y = size.height - startOffsetY
            } else {
              p.active = false
            }
          }

          if (!landedBottom && p.active) {
            p.x = nextX
            p.y = nextY
          }
        }

        if (p.y > size.height + 20) {
          p.active = false
        }
      }
    }

    // 2. Gravity settling of offsetY (particles settle down towards the card)
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i]
      if (p.active && p.onSurface) {
        const settleSpeed = isSnow ? 15 : 45
        p.offsetY = Math.max(0, (p.offsetY ?? 0) - settleSpeed * deltaSeconds)
      }
    }

    // 3. 2D Overlap settling, stacking and spreading
    const iterations = 3
    for (let iter = 0; iter < iterations; iter++) {
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
          const dy = (p2.offsetY ?? 0) - (p1.offsetY ?? 0)
          
          const minDist = (p1.radius + p2.radius) * 0.88 // 12% overlap for dense stack
          const distSqr = dx * dx + dy * dy

          if (distSqr < minDist * minDist) {
            const dist = Math.sqrt(distSqr) || 0.001
            const overlap = minDist - dist

            const nx = dx / dist
            const ny = dy / dist

            const shiftX = nx * overlap * 0.5
            const shiftY = ny * overlap * 0.5

            p2.x += shiftX
            p1.x -= shiftX

            p2.offsetY = (p2.offsetY ?? 0) + shiftY
            p1.offsetY = (p1.offsetY ?? 0) - shiftY

            // Clamp X coordinates to target width
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

      // Clamp offsetY to >= 0 and sync position
      for (let i = 0; i < this.particles.length; i++) {
        const p = this.particles[i]
        if (p.active && p.onSurface) {
          p.offsetY = Math.max(0, p.offsetY ?? 0)
          if (p.target) {
            p.y = p.target.y - p.offsetY
          } else {
            p.y = size.height - p.offsetY
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
