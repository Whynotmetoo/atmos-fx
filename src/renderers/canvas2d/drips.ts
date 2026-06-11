import type { CollisionTargetRect } from '../../dom/collisionTargets'

export type DripParticle = {
  active: boolean
  x: number
  y: number
  vy: number
  size: number
  maxSize: number
  target: CollisionTargetRect | null
  state: 'gathering' | 'dripping'
  relativeTargetX?: number
  detachProgress?: number
  filmPhase: number
}

export class DripPool {
  particles: DripParticle[] = []
  private cursor = 0

  constructor(private maxSize = 160) {
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
        vy: 0,
        size: 0,
        maxSize: 0,
        target: null,
        state: 'gathering',
        relativeTargetX: 0.65,
        detachProgress: 0,
        filmPhase: Math.random() * Math.PI * 2,
      })
    }
    if (this.cursor >= this.maxSize) {
      this.cursor = 0
    }
  }

  spawn(x: number, y: number, target: CollisionTargetRect) {
    if (this.maxSize <= 0) {
      return
    }

    // One drop per target: find any existing gathering drip on this target
    const existing = this.particles.find(
      (p) => p.active && p.target === target && p.state === 'gathering',
    )
    if (existing) {
      // Feed the existing drop — slow, restrained growth
      existing.size = Math.min(existing.maxSize, existing.size + 0.15)
      return
    }

    const particle = this.particles[this.cursor]
    particle.active = true
    particle.x = x
    particle.y = y
    particle.vy = 0
    particle.size = 0.2
    // Larger max size for one big dramatic drop
    particle.maxSize = 5.0 + Math.random() * 2.5
    particle.target = target
    particle.state = 'gathering'
    // Gathering point varies along card bottom (center to right)
    particle.relativeTargetX = 0.5 + Math.random() * 0.3
    particle.detachProgress = 0
    particle.filmPhase = Math.random() * Math.PI * 2

    this.cursor = (this.cursor + 1) % this.maxSize
  }

  update(
    deltaSeconds: number,
    gravity: number,
    containerHeight: number,
    collisionTargets: readonly CollisionTargetRect[],
  ) {
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i]
      if (!p.active) {
        continue
      }

      if (p.state === 'gathering') {
        // Very slow base accumulation (water flowing along edge)
        p.size = Math.min(p.maxSize, p.size + 0.1 * deltaSeconds)

        // Animate film waviness
        p.filmPhase += 1.2 * deltaSeconds

        if (p.target) {
          // Find target in current collision targets to keep coordinate sync
          const currentTarget = collisionTargets.find(
            (t) =>
              Math.abs(t.x - p.target!.x) < 3 &&
              Math.abs(t.y - p.target!.y) < 3 &&
              Math.abs(t.width - p.target!.width) < 3,
          )
          if (currentTarget) {
            p.target = currentTarget
            p.y = currentTarget.bottom

            // Slide toward gathering point slowly
            if (p.relativeTargetX !== undefined) {
              const targetX = currentTarget.x + currentTarget.width * p.relativeTargetX
              const dx = targetX - p.x
              p.x += dx * 0.8 * deltaSeconds
              p.x = Math.max(currentTarget.x + 2, Math.min(currentTarget.right - 2, p.x))
            }
          } else {
            // Target disappeared, start dripping immediately
            p.state = 'dripping'
            p.detachProgress = 1
          }
        }

        if (p.size >= p.maxSize) {
          p.state = 'dripping'
          p.vy = 2 + Math.random() * 3 // low initial speed — sticky feel
          p.detachProgress = 0
        }
      } else {
        // Dripping (falling)
        if (p.detachProgress !== undefined && p.detachProgress < 1) {
          p.detachProgress += 4 * deltaSeconds // stretches over ~0.25s
          p.vy += gravity * 0.15 * deltaSeconds // sticky slow drag-off
          p.y += p.vy * deltaSeconds
        } else {
          p.vy += gravity * deltaSeconds
          p.y += p.vy * deltaSeconds
        }

        // Check top edge collision with other targets below it
        for (const target of collisionTargets) {
          if (p.y >= target.y && p.y - p.vy * deltaSeconds <= target.y) {
            if (p.x >= target.x && p.x <= target.right) {
              p.active = false
              break
            }
          }
        }

        if (p.y > containerHeight + 10) {
          p.active = false
        }
      }
    }
  }

  clear() {
    for (let i = 0; i < this.particles.length; i++) {
      this.particles[i].active = false
    }
  }

  getActiveCount() {
    let count = 0
    for (let i = 0; i < this.particles.length; i++) {
      if (this.particles[i].active) {
        count++
      }
    }
    return count
  }
}
