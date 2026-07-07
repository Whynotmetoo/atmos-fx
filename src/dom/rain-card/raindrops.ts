import { chance, clamp, createOffscreenCanvas, randomBetween, type ImageLike } from './utils'
import {
  createDropTextures,
  getDropTextureIndex,
  HIGHLIGHT_AREA_LEVELS,
  MAX_DROP_DEPTH,
} from './dropTextures'

const COLLISION_LOOKAHEAD = 70

export interface SimulationOptions {
  minRadius:                number
  maxRadius:                number
  maxDrops:                 number
  rainChance:               number
  rainLimit:                number
  spawnArea:                [number, number]
  radiusDistribution:       number
  initialSpread:            number
  spreadDecayX:             number
  spreadDecayY:             number
  fallSpeed:                number
  timeScale:                number
  collisionScale:           number
  collisionRadiusIncrease:  number
  collisionBoostMultiplier: number
  collisionBoost:           number
  mergeDuration:            number
  visibleAlphaThreshold:    number
}

export const DEFAULT_SIM_OPTIONS: SimulationOptions = {
  minRadius:                10,
  maxRadius:                14,
  maxDrops:                 900,
  rainChance:               0.35,
  rainLimit:                6,
  spawnArea:                [-0.1, 0.95],
  radiusDistribution:       3,
  initialSpread:            1,
  spreadDecayX:             0.4,
  spreadDecayY:             0.7,
  fallSpeed:                0.0625,
  timeScale:                1,
  collisionScale:           1,
  collisionRadiusIncrease:  0.0002,
  collisionBoostMultiplier: 0.05,
  collisionBoost:           1,
  mergeDuration:            180,
  visibleAlphaThreshold:    4.5 / 8,
}

interface Drop {
  x: number; y: number; radius: number
  spreadX: number; spreadY: number
  momentum: number; momentumX: number
  isNew: boolean; killed: boolean; opacity: number
  mergingInto: Drop | null; absorbingDrop: Drop | null
  mergeProgress: number
  mergeStartX: number; mergeStartY: number; mergeStartRadius: number
  mergeTargetStartRadius: number; mergeTargetRadius: number
  highlightAreaLevel: number
}

function createDrop(props: Partial<Drop>): Drop {
  return {
    x: 0, y: 0, radius: 0,
    spreadX: 0, spreadY: 0,
    momentum: 0, momentumX: 0,
    isNew: true, killed: false, opacity: 1,
    mergingInto: null, absorbingDrop: null,
    mergeProgress: 0,
    mergeStartX: 0, mergeStartY: 0, mergeStartRadius: 0,
    mergeTargetStartRadius: 0, mergeTargetRadius: 0,
    highlightAreaLevel: HIGHLIGHT_AREA_LEVELS - 1,
    ...props,
  }
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2
}

interface VisibleMask {
  width: number; height: number; offsetX: number; offsetY: number
}

function measureVisibleMask(img: ImageLike, threshold: number): VisibleMask {
  const w = (img as HTMLImageElement).naturalWidth  || img.width
  const h = (img as HTMLImageElement).naturalHeight || img.height
  const c = createOffscreenCanvas(w, h)
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(img, 0, 0, w, h)
  const px = ctx.getImageData(0, 0, w, h).data
  const minAlpha = threshold * 255
  let minX = w, minY = h, maxX = -1, maxY = -1
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (px[(y * w + x) * 4 + 3] <= minAlpha) continue
      minX = Math.min(minX, x); minY = Math.min(minY, y)
      maxX = Math.max(maxX, x); maxY = Math.max(maxY, y)
    }
  }
  if (maxX < minX) throw new Error('Drop alpha has no visible pixels')
  const vw = maxX - minX + 1
  const vh = maxY - minY + 1
  return {
    width:   vw / w,
    height:  vh / h,
    offsetX: (minX + vw * 0.5) / w - 0.5,
    offsetY: (minY + vh * 0.5) / h - 0.5,
  }
}

export class RaindropSimulation {
  readonly opts: SimulationOptions
  width:      number
  height:     number
  pixelRatio: number
  readonly canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private drops:       Drop[] = []
  private lastTs:      number | null = null
  private mask:        VisibleMask
  private textures:    HTMLCanvasElement[]

  constructor(
    width: number,
    height: number,
    pixelRatio: number,
    dropAlpha: ImageLike,
    dropColor: ImageLike,
    opts: Partial<SimulationOptions> = {},
  ) {
    this.opts       = { ...DEFAULT_SIM_OPTIONS, ...opts }
    this.width      = width
    this.height     = height
    this.pixelRatio = pixelRatio
    this.mask       = measureVisibleMask(dropAlpha, this.opts.visibleAlphaThreshold)
    this.textures   = createDropTextures(dropAlpha, dropColor)
    this.canvas     = createOffscreenCanvas(width, height)
    this.ctx        = this.canvas.getContext('2d')!
  }

  private get radiusDelta(): number { return this.opts.maxRadius - this.opts.minRadius }

  private get areaMultiplier(): number {
    const cssArea = (this.width * this.height) / (this.pixelRatio ** 2)
    return Math.sqrt(cssArea / (1024 * 768))
  }

  private spawnDrops(ts: number): Drop[] {
    const spawned: Drop[] = []
    const limit = this.opts.rainLimit * ts * this.areaMultiplier
    let count = 0
    while (
      chance(this.opts.rainChance * ts * this.areaMultiplier) &&
      count < limit &&
      this.drops.length + spawned.length < this.opts.maxDrops * this.areaMultiplier
    ) {
      count++
      const r = randomBetween(this.opts.minRadius, this.opts.maxRadius, v => v ** this.opts.radiusDistribution)
      const momentum = 1 + (r - this.opts.minRadius) * 0.1 + randomBetween(1, 2)
      spawned.push(createDrop({
        x: randomBetween(0, this.width / this.pixelRatio),
        y: randomBetween(
          (this.height / this.pixelRatio) * this.opts.spawnArea[0],
          (this.height / this.pixelRatio) * this.opts.spawnArea[1],
        ),
        radius: r, momentum,
        spreadX: this.opts.initialSpread,
        spreadY: this.opts.initialSpread,
        highlightAreaLevel: Math.floor(randomBetween(0, HIGHLIGHT_AREA_LEVELS)),
      }))
    }
    return spawned
  }

  update(timestamp: number): void {
    this.ctx.clearRect(0, 0, this.width, this.height)
    if (this.lastTs === null) this.lastTs = timestamp
    const frameScale = clamp((timestamp - this.lastTs) / (1000 / 60), 0, 1.1)
    const ts = frameScale * this.opts.timeScale
    this.lastTs = timestamp

    const spawned   = this.spawnDrops(ts)
    const active    = this.drops

    active.filter(d => !d.mergingInto).forEach(d => this.motion(d, ts))
    active.filter(d =>  d.mergingInto).forEach(d => this.merge(d, ts))

    const moving = active.filter(d => !d.killed)
    const rowW   = this.width / this.pixelRatio
    moving.sort((a, b) => (a.y * rowW + a.x) - (b.y * rowW + b.x))

    moving.forEach((d, i) => {
      if (!d.mergingInto && !d.absorbingDrop && (d.momentum > 0 || d.isNew)) {
        this.mergeCollisions(d, i, moving, ts)
      }
      d.isNew = false
    })

    const next = [...spawned]
    moving.forEach(d => {
      if (!d.mergingInto) this.decay(d, ts)
      if (!d.killed) { next.push(d); this.drawDrop(d) }
    })
    this.drops = next
  }

  private motion(d: Drop, ts: number): void {
    const nr = (d.radius - this.opts.minRadius) / this.radiusDelta
    if (chance(nr * 0.1 * ts)) {
      d.momentum += randomBetween(1, Math.max(1, (d.radius / this.opts.maxRadius) * 4))
    }
    d.spreadX *= this.opts.spreadDecayX ** ts
    d.spreadY *= this.opts.spreadDecayY ** ts
    if (d.momentum > 0) {
      d.y += d.momentum * this.opts.fallSpeed * ts
      d.x += d.momentumX * ts
      if (d.y > this.height / this.pixelRatio + d.radius) d.killed = true
    }
  }

  private merge(d: Drop, ts: number): void {
    const t = d.mergingInto!
    if (!t || t.killed) { d.killed = true; if (t?.absorbingDrop === d) t.absorbingDrop = null; return }
    const frames = this.opts.mergeDuration / (1000 / 60)
    d.mergeProgress = clamp(d.mergeProgress + ts / frames, 0, 1)
    const p = easeInOutCubic(d.mergeProgress)
    d.x = d.mergeStartX + (t.x - d.mergeStartX) * p
    d.y = d.mergeStartY + (t.y - d.mergeStartY) * p
    d.radius  = Math.max(0.01, d.mergeStartRadius * (1 - p))
    d.opacity = 1 - p
    d.spreadX = d.spreadY = 0
    t.radius  = d.mergeTargetStartRadius + (d.mergeTargetRadius - d.mergeTargetStartRadius) * p
    if (d.mergeProgress === 1) {
      t.radius = d.mergeTargetRadius; t.absorbingDrop = null; d.mergingInto = null; d.killed = true
    }
  }

  private decay(d: Drop, ts: number): void {
    d.momentum = Math.max(0, d.momentum - Math.max(1, this.opts.minRadius * 0.5 - d.momentum) * 0.1 * ts)
    d.momentumX *= this.opts.spreadDecayY ** ts
  }

  private ellipse(d: Drop) {
    const dw = d.radius * 2 * (d.spreadX + 1)
    const dh = d.radius * 3 * (d.spreadY + 1)
    const cs = this.opts.collisionScale
    return {
      x: d.x + this.mask.offsetX * dw,
      y: d.y + this.mask.offsetY * dh,
      rx: this.mask.width  * dw * 0.5 * cs,
      ry: this.mask.height * dh * 0.5 * cs,
    }
  }

  private overlaps(a: Drop, b: Drop, ts: number): boolean {
    const ea = this.ellipse(a), eb = this.ellipse(b)
    const pad = (a.radius + b.radius) * a.momentum * this.opts.collisionRadiusIncrease * ts
    const rx  = ea.rx + eb.rx + pad
    const ry  = ea.ry + eb.ry + pad
    const nx  = (eb.x - ea.x) / rx, ny = (eb.y - ea.y) / ry
    return nx ** 2 + ny ** 2 < 1
  }

  private mergeCollisions(d: Drop, idx: number, drops: Drop[], ts: number): void {
    drops.slice(idx + 1, idx + 1 + COLLISION_LOOKAHEAD).forEach(o => {
      if (d.killed || o.killed || d.mergingInto || d.absorbingDrop || o.mergingInto || o.absorbingDrop || d.radius <= o.radius) return
      if (!this.overlaps(d, o, ts)) return
      const dx = o.x - d.x
      const combined = Math.sqrt(d.radius ** 2 + o.radius ** 2 * 0.8)
      const absorbMom = o.momentum
      o.mergingInto = d; o.mergeProgress = 0
      o.mergeStartX = o.x; o.mergeStartY = o.y; o.mergeStartRadius = o.radius
      o.mergeTargetStartRadius = d.radius
      o.mergeTargetRadius = Math.min(this.opts.maxRadius, combined)
      o.momentum = o.momentumX = 0
      d.absorbingDrop = o; d.momentumX += dx * 0.1; d.spreadX = d.spreadY = 0
      d.momentum = Math.max(absorbMom, Math.min(40,
        d.momentum + d.radius * this.opts.collisionBoostMultiplier + this.opts.collisionBoost))
    })
  }

  private drawDrop(d: Drop): void {
    const depth = clamp(
      ((d.radius - this.opts.minRadius) / this.radiusDelta) * MAX_DROP_DEPTH,
      0, MAX_DROP_DEPTH,
    ) / ((d.spreadX + d.spreadY) * 0.5 + 1)
    const idx = getDropTextureIndex(depth, d.highlightAreaLevel)
    const dw  = d.radius * 2 * (d.spreadX + 1)
    const dh  = d.radius * 3 * (d.spreadY + 1)
    this.ctx.globalCompositeOperation = 'source-over'
    this.ctx.globalAlpha = d.opacity
    this.ctx.drawImage(
      this.textures[idx],
      (d.x - dw * 0.5) * this.pixelRatio,
      (d.y - dh * 0.5) * this.pixelRatio,
      dw * this.pixelRatio,
      dh * this.pixelRatio,
    )
  }

  resize(w: number, h: number, pixelRatio: number): void {
    const prevCssW = this.width  / this.pixelRatio
    const prevCssH = this.height / this.pixelRatio
    const nextCssW = w / pixelRatio
    const nextCssH = h / pixelRatio
    if (prevCssW > 0 && prevCssH > 0) {
      this.drops.forEach(d => {
        d.x          *= nextCssW / prevCssW; d.y          *= nextCssH / prevCssH
        d.mergeStartX *= nextCssW / prevCssW; d.mergeStartY *= nextCssH / prevCssH
      })
    }
    this.width = w; this.height = h; this.pixelRatio = pixelRatio
    this.canvas.width = w; this.canvas.height = h
    this.ctx = this.canvas.getContext('2d')!
  }

  resetClock(): void { this.lastTs = null }
}
