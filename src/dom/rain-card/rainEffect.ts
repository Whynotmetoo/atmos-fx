import { clamp, loadImage } from './utils'
import { RaindropSimulation, type SimulationOptions } from './raindrops'
import { RainRenderer, type RendererOptions } from './rainRenderer'
import { ALPHA_TEX, COLOR_TEX, REFRACTION_TEX } from './textures'

export interface RainEffectOptions {
  autoStart?:    boolean
  maxPixelRatio?: number
  simulation?:   Partial<SimulationOptions>
  renderer?:     Partial<RendererOptions>
}

/** WebGL water-drop effect for a single canvas element.
 *  Ported from docs_local/rain-effect-simplified. */
export class RainEffect {
  private sim:          RaindropSimulation | null = null
  private renderer:     RainRenderer       | null = null
  private resizeObs:    ResizeObserver     | null = null
  private raf:          number             | null = null
  private running       = false
  private destroyed     = false
  private initialized   = false
  private startPending: boolean
  private currentDensity = 1

  readonly ready: Promise<void>
  private readonly opts: Required<RainEffectOptions>
  private readonly onLoop: (ts: number) => void
  private readonly onResize: () => void

  constructor(
    private readonly canvas: HTMLCanvasElement,
    opts: RainEffectOptions = {},
  ) {
    this.opts = {
      autoStart:    opts.autoStart    ?? true,
      maxPixelRatio: opts.maxPixelRatio ?? 2,
      simulation:   opts.simulation   ?? {},
      renderer:     opts.renderer     ?? {},
    }
    this.startPending = this.opts.autoStart
    this.onLoop   = (ts) => this.loop(ts)
    this.onResize = ()  => this.resize()
    this.ready    = this.init()
  }

  private async init(): Promise<void> {
    const [alpha, color, refraction] = await Promise.all([
      loadImage(ALPHA_TEX),
      loadImage(COLOR_TEX),
      loadImage(REFRACTION_TEX),
    ])
    if (this.destroyed) return

    this.lockCssSize()
    const { w, h, dpr } = this.measure()
    this.canvas.width  = w
    this.canvas.height = h

    this.sim = new RaindropSimulation(w, h, dpr, alpha, color, this.opts.simulation)
    this.sim.setDensity(this.currentDensity)
    this.renderer = new RainRenderer(
      this.canvas, this.sim.canvas,
      null,        // no shine texture for now
      refraction,
      this.opts.renderer,
    )
    this.initialized = true
    this.watchSize()
    if (this.startPending) this.start()
  }

  private lockCssSize(): void {
    const r = this.canvas.getBoundingClientRect()
    if (!this.canvas.style.width  && Math.abs(r.width  - this.canvas.width)  < 0.5)
      this.canvas.style.width  = `${r.width}px`
    if (!this.canvas.style.height && Math.abs(r.height - this.canvas.height) < 0.5)
      this.canvas.style.height = `${r.height}px`
  }

  private measure(): { w: number; h: number; dpr: number } {
    const r   = this.canvas.getBoundingClientRect()
    const pr  = this.canvas.parentElement?.getBoundingClientRect()
    const cw  = r.width  || pr?.width  || window.innerWidth
    const ch  = r.height || pr?.height || window.innerHeight
    const dpr = clamp(window.devicePixelRatio || 1, 1, this.opts.maxPixelRatio)
    return {
      w:   Math.max(1, Math.round(cw * dpr)),
      h:   Math.max(1, Math.round(ch * dpr)),
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
    if (!this.initialized || this.destroyed || !this.sim || !this.renderer) return
    const { w, h, dpr } = this.measure()
    if (w === this.canvas.width && h === this.canvas.height && dpr === this.sim.pixelRatio) return
    this.sim.resize(w, h, dpr)
    this.renderer.resize(w, h)
  }

  start(): this {
    if (this.destroyed) throw new Error('RainEffect: already destroyed')
    if (!this.initialized) { this.startPending = true; return this }
    if (this.running) return this
    this.running = true
    this.sim!.resetClock()
    this.raf = requestAnimationFrame(this.onLoop)
    return this
  }

  stop(): this {
    this.startPending = false
    this.running = false
    if (this.raf !== null) { cancelAnimationFrame(this.raf); this.raf = null }
    return this
  }

  setDensity(density: number): this {
    this.currentDensity = density
    if (this.sim) {
      this.sim.setDensity(density)
    }
    return this
  }

  private loop(ts: number): void {
    if (!this.running || this.destroyed || !this.sim || !this.renderer) return
    this.sim.update(ts)
    this.renderer.draw()
    this.raf = requestAnimationFrame(this.onLoop)
  }

  destroy(): void {
    if (this.destroyed) return
    this.stop()
    this.resizeObs?.disconnect()
    if (!this.resizeObs) window.removeEventListener('resize', this.onResize)
    this.renderer?.destroy()
    this.sim = null
    this.renderer = null
    this.destroyed = true
  }
}
