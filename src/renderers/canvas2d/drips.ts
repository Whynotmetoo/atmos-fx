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
        relativeTargetX: 0.75,
        detachProgress: 0,
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

    // Check if we already have a drip gathering very close to this x on the same target bottom
    const existing = this.particles.find(
      (p) => p.active && p.target === target && Math.abs(p.x - x) < 24 && p.state === 'gathering',
    )
    if (existing) {
      // Grow the existing drip slightly from the gathered rain hit
      existing.size = Math.min(existing.maxSize, existing.size + 0.2)
      return
    }

    const particle = this.particles[this.cursor]
    particle.active = true
    particle.x = x
    particle.y = y
    particle.vy = 0
    particle.size = 0.3
    // Larger maxSize for a big drop feel (3.6 to 5.8)
    particle.maxSize = 3.6 + Math.random() * 2.2
    particle.target = target
    particle.state = 'gathering'
    // Slide towards right-quarter of the card bottom
    particle.relativeTargetX = 0.7 + Math.random() * 0.15
    particle.detachProgress = 0

    this.cursor = (this.cursor + 1) % this.maxSize
  }

  update(
    deltaSeconds: number,
    gravity: number,
    containerHeight: number,
    collisionTargets: readonly CollisionTargetRect[],
  ) {
    // Merge gathering drips that slide close to each other on the same card bottom
    for (let i = 0; i < this.particles.length; i++) {
      const p1 = this.particles[i]
      if (!p1.active || p1.state !== 'gathering') {
        continue
      }
      for (let j = i + 1; j < this.particles.length; j++) {
        const p2 = this.particles[j]
        if (!p2.active || p2.state !== 'gathering' || p1.target !== p2.target) {
          continue
        }
        const dist = Math.abs(p1.x - p2.x)
        if (dist < 14) {
          // Merge p2 into p1
          p1.size = Math.min(p1.maxSize, p1.size + p2.size * 0.85)
          if (p2.size > p1.size) {
            p1.x = p2.x
          }
          p2.active = false
        }
      }
    }

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i]
      if (!p.active) {
        continue
      }

      if (p.state === 'gathering') {
        // Very slow idle growth, mainly driven by actual rain hits and merges
        p.size += (0.04 + Math.random() * 0.04) * deltaSeconds

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

            // Slide towards right-quarter
            if (p.relativeTargetX !== undefined) {
              const targetX = currentTarget.x + currentTarget.width * p.relativeTargetX
              const dx = targetX - p.x
              p.x += dx * 2.5 * deltaSeconds
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
          p.vy = 4 + Math.random() * 6 // low initial speed to feel sticky
          p.detachProgress = 0
        }
      } else {
        // Dripping (falling)
        if (p.detachProgress !== undefined && p.detachProgress < 1) {
          p.detachProgress += 6 * deltaSeconds // snaps in ~0.16 seconds
          p.vy += gravity * 0.2 * deltaSeconds // sticky slow drag-off acceleration
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
