import type { CollisionTargetRect } from '../../dom/collisionTargets'

// ─── Public particle shape ───────────────────────────────────────────────────
export type DripParticle = {
  active: boolean
  x: number
  y: number
  vy: number
  /** Radius of the circular drop in CSS pixels */
  r: number
  /** How much the drop has flattened horizontally (decays to 0) */
  spreadX: number
  /** How much the drop has flattened vertically (decays to 0) */
  spreadY: number
  /** Downward momentum (velocity multiplier, not px/s directly) */
  momentum: number
  /** Horizontal drift accumulated from collisions */
  momentumX: number
  /** Rate at which this drop shrinks per frame (0 while alive) */
  shrink: number
  /** If set, this drop was spawned as a trail child of a larger drop */
  parent: DripParticle | null
  target: CollisionTargetRect | null
  killed: boolean
  /** true on the very first frame so collision is still checked when momentum=0 */
  isNew: boolean
  /** Anchored card-bottom y while gathering (before momentum > 0) */
  anchorY: number
}

// ─── Pool ────────────────────────────────────────────────────────────────────
export class DripPool {
  particles: DripParticle[] = []
  private cursor = 0

  // Tunable constants mirroring the reference implementation
  static readonly MIN_R = 3    // px – minimum radius before auto-shrink
  static readonly MAX_R = 22   // px – radius cap for merged drops
  static readonly TRAIL_SCALE_MIN = 0.18
  static readonly TRAIL_SCALE_MAX = 0.42
  static readonly COLLISION_RADIUS = 0.72
  static readonly COLLISION_RADIUS_INCREASE = 0.012
  static readonly COLLISION_BOOST_MULT = 0.06
  static readonly COLLISION_BOOST = 1

  constructor(private maxCount = 120) {
    this._syncBudget(maxCount)
  }

  syncBudget(maxCount: number) {
    this.maxCount = Math.max(0, Math.floor(maxCount))
    if (this.particles.length > this.maxCount) {
      this.particles.length = this.maxCount
    }
    this._syncBudget(this.maxCount)
    if (this.cursor >= this.maxCount) this.cursor = 0
  }

  private _syncBudget(n: number) {
    while (this.particles.length < n) {
      this.particles.push(this._make())
    }
  }

  private _make(): DripParticle {
    return {
      active: false,
      x: 0,
      y: 0,
      vy: 0,
      r: 0,
      spreadX: 0,
      spreadY: 0,
      momentum: 0,
      momentumX: 0,
      shrink: 0,
      parent: null,
      target: null,
      killed: false,
      isNew: true,
      anchorY: 0,
    }
  }

  /**
   * Called when a foreground rain particle hits the top of a card.
   * Finds the nearest gathering drop and feeds it water (area-conserving),
   * or spawns a new tiny drop if none is near.
   */
  spawn(x: number, _y: number, target: CollisionTargetRect) {
    if (this.maxCount <= 0) return

    const MIN_R = DripPool.MIN_R
    // Look for a nearby gathering drop on the same surface
    let best: DripParticle | null = null
    let bestDist = Infinity
    for (const p of this.particles) {
      if (!p.active || p.killed || p.target !== target || p.momentum > 0) continue
      const d = Math.abs(p.x - x)
      if (d < 40 && d < bestDist) {
        bestDist = d
        best = p
      }
    }

    if (best) {
      // Area-conserving growth: treat the rain hit as a tiny r=MIN_R drop
      const hitR = MIN_R
      const newR = Math.sqrt(best.r * best.r + hitR * hitR * 0.7)
      best.r = Math.min(DripPool.MAX_R, newR)
      return
    }

    // Spawn new drop at a random position along the card bottom
    const slot = this.particles[this.cursor]
    const r = MIN_R + Math.random() * (MIN_R * 0.6) // spawn small
    Object.assign(slot, {
      active: true,
      killed: false,
      isNew: true,
      x,
      y: target.bottom,
      anchorY: target.bottom,
      vy: 0,
      r,
      spreadX: 0.3,
      spreadY: 0.3,
      momentum: 0,
      momentumX: 0,
      shrink: 0,
      parent: null,
      target,
    })
    this.cursor = (this.cursor + 1) % Math.max(1, this.maxCount)
  }

  update(
    deltaSeconds: number,
    gravity: number,   // px/s² equivalent
    containerHeight: number,
    collisionTargets: readonly CollisionTargetRect[],
  ) {
    const MIN_R = DripPool.MIN_R
    const MAX_R = DripPool.MAX_R
    const dt = Math.min(deltaSeconds, 0.05)
    // timeScale: 1.0 at 60 fps, matches the reference's 1/60 normalisation
    const timeScale = dt * 60

    const newSpawns: DripParticle[] = []

    // ── Sort by y so collision pairs are spatially coherent ──────────────────
    this.particles.sort((a, b) => {
      if (!a.active || a.killed) return 1
      if (!b.active || b.killed) return -1
      return a.y - b.y
    })

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i]
      if (!p.active || p.killed) continue

      // ── Keep gathering drop pinned to its card bottom ─────────────────────
      if (p.momentum <= 0 && p.target) {
        const cur = collisionTargets.find(
          (t) =>
            Math.abs(t.x - p.target!.x) < 4 &&
            Math.abs(t.y - p.target!.y) < 4 &&
            Math.abs(t.width - p.target!.width) < 4,
        )
        if (cur) {
          p.target = cur
          p.y = cur.bottom
          p.anchorY = cur.bottom
        } else {
          // Card disappeared – start falling immediately
          p.momentum = 1
        }
      }

      // ── Stochastic gravity kick (larger drops fall more readily) ──────────
      // chance per frame = (r - MIN_R) / (MAX_R - MIN_R) * 0.15
      const deltaR = MAX_R - MIN_R
      const fallChance = ((p.r - MIN_R) / deltaR) * 0.15 * timeScale
      if (Math.random() < fallChance) {
        p.momentum += Math.random() * (p.r / MAX_R) * 4
      }

      // ── Auto-shrink tiny stationary drops (surface tension evaporation) ───
      if (p.r <= MIN_R && p.momentum <= 0) {
        if (Math.random() < 0.04 * timeScale) p.shrink += 0.008
      }
      p.r -= p.shrink * timeScale
      if (p.r <= 0) { p.killed = true; continue }

      // ── Trail: while falling, leave behind smaller daughter drops ─────────
      if (p.momentum > 0) {
        const trailRate = 1.2
        const lastSpawnField = (p as any)._lastSpawn ?? 0
        ;(p as any)._lastSpawn = lastSpawnField + p.momentum * timeScale * trailRate
        const nextSpawn = MIN_R + Math.random() * (MAX_R - MIN_R) -
          p.momentum * 2 * trailRate + (MAX_R - p.r)

        if ((p as any)._lastSpawn > nextSpawn && newSpawns.length < 20) {
          const tr = p.r * (DripPool.TRAIL_SCALE_MIN +
            Math.random() * (DripPool.TRAIL_SCALE_MAX - DripPool.TRAIL_SCALE_MIN))
          const trail = this._make()
          Object.assign(trail, {
            active: true,
            killed: false,
            isNew: true,
            x: p.x + (Math.random() * 2 - 1) * p.r * 0.1,
            y: p.y - p.r * 0.01,
            anchorY: p.y,
            vy: 0,
            r: tr,
            spreadX: 0,
            spreadY: p.momentum * 0.1,
            momentum: 0,
            momentumX: 0,
            shrink: 0,
            parent: p,
            target: null,
          })
          newSpawns.push(trail)
          // Shed mass to trail
          p.r *= Math.pow(0.97, timeScale)
          ;(p as any)._lastSpawn = 0
        }
      }

      // ── Spread decay (splat → sphere) ─────────────────────────────────────
      p.spreadX *= Math.pow(0.4, timeScale)
      p.spreadY *= Math.pow(0.7, timeScale)

      // ── Position update ───────────────────────────────────────────────────
      if (p.momentum > 0 && !p.killed) {
        p.y += p.momentum * (gravity / 160) * timeScale
        p.x += p.momentumX * timeScale
        if (p.y > containerHeight + p.r) { p.killed = true; continue }
      }

      // ── 2-D collision / merge ─────────────────────────────────────────────
      const checkCollision = (p.momentum > 0 || p.isNew) && !p.killed
      p.isNew = false

      if (checkCollision) {
        for (let j = i + 1; j < Math.min(i + 80, this.particles.length); j++) {
          const p2 = this.particles[j]
          if (!p2.active || p2.killed || p === p2) continue
          if (p.r <= p2.r) continue          // only larger absorbs smaller
          if (p.parent === p2 || p2.parent === p) continue

          const dx = p2.x - p.x
          const dy = p2.y - p.y
          const d = Math.sqrt(dx * dx + dy * dy)
          const threshold = (p.r + p2.r) *
            (DripPool.COLLISION_RADIUS + p.momentum * DripPool.COLLISION_RADIUS_INCREASE * timeScale)

          if (d < threshold) {
            // Area-conserving merge
            const newR = Math.sqrt(p.r * p.r + p2.r * p2.r * 0.8)
            p.r = Math.min(MAX_R, newR)
            p.momentumX += dx * 0.1
            p.spreadX = 0
            p.spreadY = 0
            p2.killed = true
            p.momentum = Math.max(
              p2.momentum,
              Math.min(40, p.momentum + p.r * DripPool.COLLISION_BOOST_MULT + DripPool.COLLISION_BOOST),
            )
          }
        }
      }

      // ── Momentum drag ─────────────────────────────────────────────────────
      const drag = Math.max(1, MIN_R * 0.5 - p.momentum) * 0.1 * timeScale
      p.momentum = Math.max(0, p.momentum - drag)
      p.momentumX *= Math.pow(0.7, timeScale)

      // ── Target edge check (stop on another card below) ────────────────────
      if (p.momentum > 0) {
        for (const t of collisionTargets) {
          if (p.target === t) continue
          if (p.y >= t.y && p.y - p.momentum * (gravity / 160) * timeScale < t.y) {
            if (p.x >= t.x && p.x <= t.right) {
              p.killed = true
              break
            }
          }
        }
      }
    }

    // Merge new trail drops into pool slots
    for (const trail of newSpawns) {
      const slot = this.particles[this.cursor]
      Object.assign(slot, trail)
      this.cursor = (this.cursor + 1) % Math.max(1, this.maxCount)
    }

    // Remove killed particles
    for (const p of this.particles) {
      if (p.killed) p.active = false
    }
  }

  clear() {
    for (const p of this.particles) p.active = false
  }

  getActiveCount() {
    let n = 0
    for (const p of this.particles) if (p.active) n++
    return n
  }
}
