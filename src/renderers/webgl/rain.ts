import type { NormalizedAtmosphereOptions } from '../../core/types'
import type { CanvasLayerSize } from '../../dom/canvasLayer'
import type { CollisionTargetRect } from '../../dom/collisionTargets'
import { findTopEdgeCollision } from '../canvas2d/collision'
import { calculateRainParticleBudget } from '../canvas2d/quality'
import { SplashPool } from '../canvas2d/splash'
import type { Canvas2DRenderer, RendererCanvases } from '../canvas2d/types'

type RainParticleLayer = 'background' | 'foreground'

type RainParticle = {
  x: number
  y: number
  vx: number
  vy: number
  length: number
  alpha: number
  depth: number
  layer: RainParticleLayer
}

type WebGLLayer = {
  canvas: HTMLCanvasElement
  gl: WebGLRenderingContext
  program: WebGLProgram
  buffer: WebGLBuffer
  positionLocation: number
  alphaLocation: number
  colorLocation: WebGLUniformLocation | null
  resolutionLocation: WebGLUniformLocation | null
  vertices: Float32Array
}

const MAX_DELTA_SECONDS = 0.05
const VALUES_PER_VERTEX = 3
const VERTICES_PER_PARTICLE = 2

const VERTEX_SHADER_SOURCE = `
attribute vec2 a_position;
attribute float a_alpha;
uniform vec2 u_resolution;
varying float v_alpha;

void main() {
  vec2 zeroToOne = a_position / u_resolution;
  vec2 clipSpace = zeroToOne * 2.0 - 1.0;
  gl_Position = vec4(clipSpace * vec2(1.0, -1.0), 0.0, 1.0);
  v_alpha = a_alpha;
}
`

const FRAGMENT_SHADER_SOURCE = `
precision mediump float;

uniform vec4 u_color;
varying float v_alpha;

void main() {
  gl_FragColor = vec4(u_color.rgb, u_color.a * v_alpha);
}
`

function randomRange(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

let scratchCanvas: HTMLCanvasElement | null = null
let scratchCtx: CanvasRenderingContext2D | null = null

function parseColor(color: string): [number, number, number, number] {
  if (typeof document !== 'undefined') {
    try {
      if (!scratchCanvas) {
        scratchCanvas = document.createElement('canvas')
        scratchCanvas.width = 1
        scratchCanvas.height = 1
        scratchCtx = scratchCanvas.getContext('2d', { willReadFrequently: true })
      }

      if (scratchCtx) {
        scratchCtx.clearRect(0, 0, 1, 1)
        scratchCtx.fillStyle = 'rgba(255, 255, 255, 0.72)' // default fallback
        scratchCtx.fillStyle = color
        scratchCtx.fillRect(0, 0, 1, 1)
        const data = scratchCtx.getImageData(0, 0, 1, 1).data
        return [
          data[0] / 255,
          data[1] / 255,
          data[2] / 255,
          data[3] / 255,
        ]
      }
    } catch (_e) {
      // Fall through to regex parser
    }
  }

  // Fallback for SSR/Node/testing environments without 2D canvas support
  const match = color.match(
    /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)/,
  )

  if (!match) {
    if (color.startsWith('#')) {
      const hex = color.slice(1)
      if (hex.length === 3) {
        return [
          parseInt(hex[0] + hex[0], 16) / 255,
          parseInt(hex[1] + hex[1], 16) / 255,
          parseInt(hex[2] + hex[2], 16) / 255,
          1.0,
        ]
      } else if (hex.length === 6) {
        return [
          parseInt(hex.slice(0, 2), 16) / 255,
          parseInt(hex.slice(2, 4), 16) / 255,
          parseInt(hex.slice(4, 6), 16) / 255,
          1.0,
        ]
      }
    }
    return [1, 1, 1, 0.72]
  }

  return [
    Math.min(1, Number(match[1]) / 255),
    Math.min(1, Number(match[2]) / 255),
    Math.min(1, Number(match[3]) / 255),
    match[4] === undefined ? 1 : Math.min(1, Number(match[4])),
  ]
}

function recycleParticle(
  particle: RainParticle,
  size: CanvasLayerSize,
  options: NormalizedAtmosphereOptions,
  isBackground: boolean,
  initial = false,
) {
  const depth = isBackground ? randomRange(0.2, 0.48) : randomRange(0.55, 1.0)
  const speed = options.speed * randomRange(520, 980) * depth
  const wind = options.wind * randomRange(120, 260) * depth

  const alphaScale = isBackground ? (0.35 + depth * 0.65) : depth
  const lengthScale = isBackground ? (0.4 + depth * 0.6) : depth

  particle.depth = depth
  particle.x = randomRange(-size.width * 0.15, size.width * 1.15)
  particle.y = initial ? randomRange(-size.height, size.height) : randomRange(-size.height * 0.35, 0)
  particle.vx = wind
  particle.vy = speed
  particle.length = randomRange(10, 26) * lengthScale * (0.8 + options.speed * 0.35)
  particle.alpha = randomRange(0.22, 0.78) * alphaScale
}

function getWebGLContext(canvas: HTMLCanvasElement): WebGLRenderingContext | null {
  const options: WebGLContextAttributes = {
    alpha: true,
    antialias: false,
    depth: false,
    premultipliedAlpha: false,
    preserveDrawingBuffer: false,
    stencil: false,
  }

  return (
    canvas.getContext('webgl', options) ||
    (canvas.getContext('experimental-webgl' as 'webgl', options) as WebGLRenderingContext | null)
  )
}

function createShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string,
): WebGLShader | undefined {
  const shader = gl.createShader(type)

  if (!shader) {
    return undefined
  }

  gl.shaderSource(shader, source)
  gl.compileShader(shader)

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader)
    return undefined
  }

  return shader
}

function createProgram(gl: WebGLRenderingContext): WebGLProgram | undefined {
  const vertexShader = createShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER_SOURCE)
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SOURCE)

  if (!vertexShader || !fragmentShader) {
    return undefined
  }

  const program = gl.createProgram()

  if (!program) {
    return undefined
  }

  gl.attachShader(program, vertexShader)
  gl.attachShader(program, fragmentShader)
  gl.linkProgram(program)
  gl.deleteShader(vertexShader)
  gl.deleteShader(fragmentShader)

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program)
    return undefined
  }

  return program
}

function createLayer(canvas: HTMLCanvasElement, capacity: number): WebGLLayer | undefined {
  const gl = getWebGLContext(canvas)

  if (!gl) {
    return undefined
  }

  const program = createProgram(gl)
  const buffer = gl.createBuffer()

  if (!program || !buffer) {
    return undefined
  }

  return {
    canvas,
    gl,
    program,
    buffer,
    positionLocation: gl.getAttribLocation(program, 'a_position'),
    alphaLocation: gl.getAttribLocation(program, 'a_alpha'),
    colorLocation: gl.getUniformLocation(program, 'u_color'),
    resolutionLocation: gl.getUniformLocation(program, 'u_resolution'),
    vertices: new Float32Array(capacity * VERTICES_PER_PARTICLE * VALUES_PER_VERTEX),
  }
}

export class WebGLRainRenderer implements Canvas2DRenderer {
  readonly backend = 'webgl' as const
  private backgroundLayer: WebGLLayer | undefined
  private foregroundLayer: WebGLLayer | undefined
  private particles: RainParticle[] = []
  private collisionTargets: readonly CollisionTargetRect[] = []
  private readonly splashes = new SplashPool()
  private lastTime: number | undefined
  private contextLost = false
  private size: CanvasLayerSize
  private options: NormalizedAtmosphereOptions
  private parsedColor: [number, number, number, number] = [1, 1, 1, 0.72]

  private readonly handleContextLost = (event: Event) => {
    event.preventDefault()
    this.contextLost = true
  }

  private readonly handleContextRestored = () => {
    this.contextLost = false
    this.initializeLayers()
  }

  constructor(
    private readonly canvases: RendererCanvases,
    size: CanvasLayerSize,
    options: NormalizedAtmosphereOptions,
  ) {
    this.size = size
    this.options = options
    this.parsedColor = parseColor(options.color)
    this.initializeLayers()
    this.syncParticleBudget(true)
    this.canvases.background.addEventListener('webglcontextlost', this.handleContextLost)
    this.canvases.background.addEventListener('webglcontextrestored', this.handleContextRestored)
    this.canvases.foreground.addEventListener('webglcontextlost', this.handleContextLost)
    this.canvases.foreground.addEventListener('webglcontextrestored', this.handleContextRestored)
  }

  isReady() {
    return Boolean(this.backgroundLayer && this.foregroundLayer)
  }

  resize(size: CanvasLayerSize) {
    this.size = size
    this.syncParticleBudget(true)
  }

  updateOptions(options: NormalizedAtmosphereOptions) {
    const shouldReseedMotion =
      options.speed !== this.options.speed || options.wind !== this.options.wind
    this.options = options
    this.parsedColor = parseColor(options.color)
    this.syncParticleBudget(false)

    if (shouldReseedMotion) {
      const backgroundCount = Math.floor(this.particles.length * 0.42)
      for (let index = 0; index < this.particles.length; index += 1) {
        const particle = this.particles[index]
        const isBackground = index < backgroundCount
        const depth = particle.depth
        particle.vy = options.speed * randomRange(520, 980) * depth
        particle.vx = options.wind * randomRange(120, 260) * depth
        const lengthScale = isBackground ? (0.4 + depth * 0.6) : depth
        particle.length = randomRange(10, 26) * lengthScale * (0.8 + options.speed * 0.35)
      }
    }
  }

  setCollisionTargets(targets: readonly CollisionTargetRect[]) {
    this.collisionTargets = targets
  }

  spawnSplash(x: number, y: number, vx: number, depth = 1.0) {
    this.splashes.spawn(x, y, vx, depth)
  }

  getActiveSplashCount() {
    return this.splashes.getActiveCount()
  }

  getBackgroundParticleCount() {
    return this.particles.reduce(
      (count, particle) => (particle.layer === 'background' ? count + 1 : count),
      0,
    )
  }

  getForegroundParticleCount() {
    return this.particles.length - this.getBackgroundParticleCount()
  }

  render(time: number) {
    if (
      this.contextLost ||
      !this.backgroundLayer ||
      !this.foregroundLayer ||
      this.size.width <= 0 ||
      this.size.height <= 0
    ) {
      return
    }

    const deltaSeconds =
      this.lastTime === undefined
        ? 1 / 60
        : Math.min(MAX_DELTA_SECONDS, Math.max(0, (time - this.lastTime) / 1000))

    this.lastTime = time

    const backgroundCount = Math.floor(this.particles.length * 0.42)
    let backgroundVertexCount = 0
    let foregroundVertexCount = 0

    for (let index = 0; index < this.particles.length; index += 1) {
      const particle = this.particles[index]
      const previousX = particle.x
      const previousY = particle.y
      const nextX = particle.x + particle.vx * deltaSeconds
      const nextY = particle.y + particle.vy * deltaSeconds



      const collision =
        index >= backgroundCount
          ? findTopEdgeCollision(previousX, previousY, nextX, nextY, this.collisionTargets)
          : undefined

      if (collision) {
        this.splashes.spawn(collision.x, collision.y, particle.vx, particle.depth)
        recycleParticle(particle, this.size, this.options, false)
        continue
      }

      // Container bottom collision (foreground only) if bottomCollision is enabled
      if (this.options.bottomCollision && index >= backgroundCount && nextY >= this.size.height) {
        const t = (this.size.height - previousY) / (nextY - previousY || 1)
        const collideX = previousX + (nextX - previousX) * t
        this.splashes.spawn(collideX, this.size.height, particle.vx, particle.depth)
        recycleParticle(particle, this.size, this.options, false)
        continue
      }

      particle.x = nextX
      particle.y = nextY

      if (
        particle.y - particle.length > this.size.height ||
        particle.x > this.size.width * 1.2 ||
        particle.x < -this.size.width * 0.2
      ) {
        recycleParticle(particle, this.size, this.options, index < backgroundCount)
      }

      if (index < backgroundCount) {
        backgroundVertexCount += this.writeParticle(this.backgroundLayer, backgroundVertexCount, particle)
      } else {
        foregroundVertexCount += this.writeParticle(this.foregroundLayer, foregroundVertexCount, particle)
      }
    }

    for (const splash of this.splashes.particles) {
      if (!splash.active) {
        continue
      }

      splash.age += deltaSeconds

      if (splash.age >= splash.lifetime) {
        splash.active = false
        continue
      }

      splash.vy += 520 * deltaSeconds
      splash.x += splash.vx * deltaSeconds
      splash.y += splash.vy * deltaSeconds

      if (
        splash.x < -20 ||
        splash.x > this.size.width + 20 ||
        splash.y < -20 ||
        splash.y > this.size.height + 20
      ) {
        splash.active = false
        continue
      }

      const lifeProgress = splash.age / splash.lifetime
      const alpha = splash.alpha * (1 - lifeProgress)

      foregroundVertexCount += this.writeSplash(this.foregroundLayer, foregroundVertexCount, splash, alpha)
    }



    this.drawLayer(this.backgroundLayer, backgroundVertexCount)
    this.drawLayer(this.foregroundLayer, foregroundVertexCount)
  }

  clear() {
    this.splashes.clear()
    this.clearLayer(this.backgroundLayer)
    this.clearLayer(this.foregroundLayer)
  }

  destroy() {
    this.clear()
    this.canvases.background.removeEventListener('webglcontextlost', this.handleContextLost)
    this.canvases.background.removeEventListener('webglcontextrestored', this.handleContextRestored)
    this.canvases.foreground.removeEventListener('webglcontextlost', this.handleContextLost)
    this.canvases.foreground.removeEventListener('webglcontextrestored', this.handleContextRestored)
    this.particles = []
    this.lastTime = undefined
    this.backgroundLayer = undefined
    this.foregroundLayer = undefined
  }

  getParticleCount() {
    return this.particles.length
  }

  getStats() {
    return {
      backend: this.backend,
      particleCount: this.particles.length,
    }
  }

  private initializeLayers() {
    const capacity = Math.max(1, this.particles.length)
    this.backgroundLayer = createLayer(this.canvases.background, capacity)
    this.foregroundLayer = createLayer(this.canvases.foreground, capacity + 6000)
  }

  private syncParticleBudget(initial: boolean) {
    const budget = calculateRainParticleBudget({
      width: this.size.width,
      height: this.size.height,
      density: this.options.density,
      quality: this.options.quality,
    })

    if (budget !== this.particles.length) {
      this.particles = []
      this.backgroundLayer = createLayer(this.canvases.background, Math.max(1, budget))
      this.foregroundLayer = createLayer(this.canvases.foreground, Math.max(1, budget + 6000))
    }

    while (this.particles.length < budget) {
      const isBackground = this.particles.length < Math.floor(budget * 0.42)
      const particle: RainParticle = {
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        length: 0,
        alpha: 0,
        depth: 0,
        layer: isBackground ? 'background' : 'foreground',
      }

      recycleParticle(particle, this.size, this.options, isBackground, initial)
      this.particles.push(particle)
    }
  }

  private writeParticle(layer: WebGLLayer, vertexOffset: number, particle: RainParticle) {
    const tailX = particle.x - particle.vx * 0.018
    const tailY = particle.y - particle.length
    const start = vertexOffset * VALUES_PER_VERTEX

    layer.vertices[start] = tailX
    layer.vertices[start + 1] = tailY
    layer.vertices[start + 2] = particle.alpha
    layer.vertices[start + 3] = particle.x
    layer.vertices[start + 4] = particle.y
    layer.vertices[start + 5] = particle.alpha

    return VERTICES_PER_PARTICLE
  }

  private writeSplash(layer: WebGLLayer, vertexOffset: number, splash: any, alpha: number) {
    const tailX = splash.x - splash.vx * 0.012
    const tailY = splash.y - splash.vy * 0.012 - splash.length
    const start = vertexOffset * VALUES_PER_VERTEX

    layer.vertices[start] = tailX
    layer.vertices[start + 1] = tailY
    layer.vertices[start + 2] = alpha
    layer.vertices[start + 3] = splash.x
    layer.vertices[start + 4] = splash.y
    layer.vertices[start + 5] = alpha

    return VERTICES_PER_PARTICLE
  }



  private drawLayer(layer: WebGLLayer, vertexCount: number) {
    const { gl } = layer
    const [red, green, blue, alpha] = this.parsedColor

    gl.viewport(0, 0, this.size.canvasWidth, this.size.canvasHeight)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)

    if (vertexCount <= 0) {
      return
    }

    gl.useProgram(layer.program)
    gl.bindBuffer(gl.ARRAY_BUFFER, layer.buffer)
    gl.bufferData(gl.ARRAY_BUFFER, layer.vertices, gl.DYNAMIC_DRAW)
    gl.enableVertexAttribArray(layer.positionLocation)
    gl.vertexAttribPointer(
      layer.positionLocation,
      2,
      gl.FLOAT,
      false,
      VALUES_PER_VERTEX * Float32Array.BYTES_PER_ELEMENT,
      0,
    )
    gl.enableVertexAttribArray(layer.alphaLocation)
    gl.vertexAttribPointer(
      layer.alphaLocation,
      1,
      gl.FLOAT,
      false,
      VALUES_PER_VERTEX * Float32Array.BYTES_PER_ELEMENT,
      2 * Float32Array.BYTES_PER_ELEMENT,
    )

    if (layer.resolutionLocation) {
      gl.uniform2f(layer.resolutionLocation, this.size.width, this.size.height)
    }

    if (layer.colorLocation) {
      gl.uniform4f(layer.colorLocation, red, green, blue, alpha)
    }

    gl.drawArrays(gl.LINES, 0, vertexCount)
  }

  private clearLayer(layer: WebGLLayer | undefined) {
    if (!layer) {
      return
    }

    layer.gl.viewport(0, 0, this.size.canvasWidth, this.size.canvasHeight)
    layer.gl.clearColor(0, 0, 0, 0)
    layer.gl.clear(layer.gl.COLOR_BUFFER_BIT)
  }
}

export function createWebGLRainRenderer(
  canvases: RendererCanvases,
  size: CanvasLayerSize,
  options: NormalizedAtmosphereOptions,
): WebGLRainRenderer | undefined {
  const renderer = new WebGLRainRenderer(canvases, size, options)

  if (!renderer.isReady()) {
    renderer.destroy()
    return undefined
  }

  return renderer
}
