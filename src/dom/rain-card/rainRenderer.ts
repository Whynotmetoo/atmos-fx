import { GlContext } from './glContext'
import type { ImageLike } from './utils'

export interface RendererOptions {
  brightness:       number
  alphaMultiply:    number
  alphaSubtract:    number
  minRefraction:    number
  maxRefraction:    number
  renderShadow:     boolean
  bodyOpacity:      number
  highlightOpacity: number
  highlightAreaMin: number
  highlightAreaMax: number
  shadowOpacity:    number
  shadowOffset:     number
  bodyColor:        [number, number, number]
  highlightColor:   [number, number, number]
  lightDirection:   [number, number, number]
}

export const DEFAULT_RENDERER_OPTIONS: RendererOptions = {
  brightness:       1.05,
  alphaMultiply:    8,
  alphaSubtract:    4.5,
  minRefraction:    84,
  maxRefraction:    336,
  renderShadow:     true,
  bodyOpacity:      0.16,
  highlightOpacity: 0.25,
  highlightAreaMin: 0.8,
  highlightAreaMax: 1,
  shadowOpacity:    0.22,
  shadowOffset:     4,
  bodyColor:        [0.03, 0.05, 0.1],
  highlightColor:   [0.98, 0.98, 1],
  lightDirection:   [0, 1, 0.5],
}

function imgW(src: ImageLike): number {
  return (src as HTMLImageElement).naturalWidth  || src.width  || 1
}
function imgH(src: ImageLike): number {
  return (src as HTMLImageElement).naturalHeight || src.height || 1
}

export class RainRenderer {
  private readonly gl: GlContext
  private readonly waterTex: WebGLTexture
  readonly opts: RendererOptions

  constructor(
    readonly canvas: HTMLCanvasElement,
    shine:      ImageLike | null,
    refraction: ImageLike | null,
    opts: Partial<RendererOptions> = {},
  ) {
    this.opts = { ...DEFAULT_RENDERER_OPTIONS, ...opts }
    const glCtx = new GlContext(canvas)
    this.gl = glCtx

    this.waterTex  = glCtx.createEmptyTex(0)
    glCtx.createTex(shine,       1)
    glCtx.createTex(refraction,  2)

    this.setStaticUniforms(shine, refraction)
    this.resize(canvas.width, canvas.height)
  }

  private setStaticUniforms(shine: ImageLike | null, refraction: ImageLike | null): void {
    const { gl, opts } = this
    const ratio = refraction ? imgW(refraction) / imgH(refraction) : 1

    gl.set1i('waterMap',             0)
    gl.set1i('shineTexture',         1)
    gl.set1i('refractionTexture',    2)
    gl.set1i('renderShine',          shine ? 1 : 0)
    gl.set1i('renderShadow',         opts.renderShadow ? 1 : 0)
    gl.set1f('minRefraction',        opts.minRefraction)
    gl.set1f('refractionDelta',      opts.maxRefraction - opts.minRefraction)
    gl.set1f('brightness',           opts.brightness)
    gl.set1f('alphaMultiply',        opts.alphaMultiply)
    gl.set1f('alphaSubtract',        opts.alphaSubtract)
    gl.set1f('bodyOpacity',          opts.bodyOpacity)
    gl.set1f('highlightOpacity',     opts.highlightOpacity)
    gl.set1f('highlightAreaMin',     opts.highlightAreaMin)
    gl.set1f('highlightAreaMax',     opts.highlightAreaMax)
    gl.set1f('shadowOpacity',        opts.shadowOpacity)
    gl.set1f('shadowOffset',         opts.shadowOffset)
    gl.set1f('refractionTextureRatio', ratio)
    gl.set3f('bodyColor',            ...opts.bodyColor)
    gl.set3f('highlightColor',       ...opts.highlightColor)
    gl.set3f('lightDirection',       ...opts.lightDirection)
  }

  draw(waterMap: HTMLCanvasElement, width: number, height: number): void {
    const originY = this.canvas.height - height
    this.gl.setViewport(0, originY, width, height)
    this.gl.clearViewport(0, originY, width, height)
    this.gl.set2f('resolution', width, height)
    this.gl.set2f('origin', 0, originY)
    this.gl.bindTex(this.waterTex, 0)
    this.gl.uploadTex(waterMap)
    this.gl.draw()
  }

  resize(w: number, h: number): void {
    this.canvas.width  = w
    this.canvas.height = h
    this.gl.resize(w, h)
  }

  destroy(): void {
    this.gl.destroy(true)
  }
}
