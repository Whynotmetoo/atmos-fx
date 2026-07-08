import { clamp, loadImage } from './utils'
import {
  createDropSimulationResources,
  DEFAULT_SIM_OPTIONS,
  RaindropSimulation,
  type DropSimulationResources,
  type SimulationOptions,
} from './raindrops'
import { RainRenderer } from './rainRenderer'
import { ALPHA_TEX, COLOR_TEX, REFRACTION_TEX } from './textures'

export interface RainEffectOptions {
  maxPixelRatio?: number
  simulation?: Partial<SimulationOptions>
}

export interface SharedRainAssets {
  alpha: HTMLImageElement
  color: HTMLImageElement
  refraction: HTMLImageElement
  resources: DropSimulationResources
}

let cachedAssets: Promise<SharedRainAssets> | null = null

export function loadSharedRainAssets(): Promise<SharedRainAssets> {
  if (!cachedAssets) {
    cachedAssets = Promise.all([
      loadImage(ALPHA_TEX),
      loadImage(COLOR_TEX),
      loadImage(REFRACTION_TEX),
    ]).then(([alpha, color, refraction]) => ({
      alpha,
      color,
      refraction,
      resources: createDropSimulationResources(
        alpha,
        color,
        DEFAULT_SIM_OPTIONS.visibleAlphaThreshold,
      ),
    }))
  }
  return cachedAssets
}

/** Per-card water-drop simulation and 2D compositor.
 * WebGL rendering and requestAnimationFrame scheduling are shared by the root controller. */
export class RainEffect {
  private sim: RaindropSimulation | null = null
  private compositor: CanvasRenderingContext2D | null = null
  private resizeObs: ResizeObserver | null = null
  private running = false
  private destroyed = false
  private initialized = false
  private currentDensity = 1

  readonly ready: Promise<void>
  private readonly opts: Required<RainEffectOptions>
  private readonly onResize: () => void

  constructor(
    private readonly canvas: HTMLCanvasElement,
    opts: RainEffectOptions = {},
  ) {
    this.opts = {
      maxPixelRatio: opts.maxPixelRatio ?? 2,
      simulation: opts.simulation ?? {},
    }
    this.onResize = () => this.resize()
    this.ready = this.init()
  }

  private async init(): Promise<void> {
    const assets = await loadSharedRainAssets()
    if (this.destroyed) return

    this.lockCssSize()
    const { w, h, dpr } = this.measure()
    this.canvas.width = w
    this.canvas.height = h
    this.compositor = this.canvas.getContext('2d')
    this.sim = new RaindropSimulation(
      w,
      h,
      dpr,
      assets.alpha,
      assets.color,
      this.opts.simulation,
      assets.resources,
    )
    this.sim.setDensity(this.currentDensity)
    this.initialized = true
    this.watchSize()
  }

  private lockCssSize(): void {
    const rect = this.canvas.getBoundingClientRect()
    if (!this.canvas.style.width && rect.width > 0 && Math.abs(rect.width - this.canvas.width) < 0.5) {
      this.canvas.style.width = `${rect.width}px`
    }
    if (!this.canvas.style.height && rect.height > 0 && Math.abs(rect.height - this.canvas.height) < 0.5) {
      this.canvas.style.height = `${rect.height}px`
    }
  }

  private measure(): { w: number; h: number; dpr: number } {
    const rect = this.canvas.getBoundingClientRect()
    const parentRect = this.canvas.parentElement?.getBoundingClientRect()
    const cssWidth = rect.width || parentRect?.width || window.innerWidth
    const cssHeight = rect.height || parentRect?.height || window.innerHeight
    const dpr = clamp(window.devicePixelRatio || 1, 1, this.opts.maxPixelRatio)
    return {
      w: Math.max(1, Math.round(cssWidth * dpr)),
      h: Math.max(1, Math.round(cssHeight * dpr)),
      dpr,
    }
  }

  private watchSize(): void {
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObs = new ResizeObserver(this.onResize)
      this.resizeObs.observe(this.canvas)
    } else {
      window.addEventListener('resize', this.onResize)
    }
  }

  resize(): void {
    if (!this.initialized || this.destroyed || !this.sim) return
    const { w, h, dpr } = this.measure()
    if (w === this.canvas.width && h === this.canvas.height && dpr === this.sim.pixelRatio) return
    this.canvas.width = w
    this.canvas.height = h
    this.compositor = this.canvas.getContext('2d')
    this.sim.resize(w, h, dpr)
  }

  start(): this {
    if (this.destroyed) throw new Error('RainEffect: already destroyed')
    if (!this.running) {
      this.running = true
      this.sim?.resetClock()
    }
    return this
  }

  stop(): this {
    this.running = false
    return this
  }

  setDensity(density: number): this {
    this.currentDensity = density
    this.sim?.setDensity(density)
    return this
  }

  isReady(): boolean {
    return this.initialized && !this.destroyed && this.sim !== null && this.compositor !== null
  }

  getSize(): { width: number; height: number } {
    return {
      width: this.canvas.width,
      height: this.canvas.height,
    }
  }

  render(time: number, renderer: RainRenderer): void {
    if (!this.running || !this.isReady() || !this.sim || !this.compositor) return
    this.sim.update(time)
    renderer.draw(this.sim.canvas, this.canvas.width, this.canvas.height)
    this.compositor.clearRect(0, 0, this.canvas.width, this.canvas.height)
    this.compositor.drawImage(
      renderer.canvas,
      0,
      0,
      this.canvas.width,
      this.canvas.height,
      0,
      0,
      this.canvas.width,
      this.canvas.height,
    )
  }

  clear(): void {
    this.compositor?.clearRect(0, 0, this.canvas.width, this.canvas.height)
  }

  destroy(): void {
    if (this.destroyed) return
    this.stop()
    this.resizeObs?.disconnect()
    if (!this.resizeObs) window.removeEventListener('resize', this.onResize)
    this.clear()
    this.sim = null
    this.compositor = null
    this.destroyed = true
  }
}
