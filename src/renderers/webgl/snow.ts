import type { NormalizedAtmosphereOptions } from '../../core/types'
import type { CanvasLayerSize } from '../../dom/canvasLayer'
import type { CollisionTargetRect } from '../../dom/collisionTargets'
import { AccumulationPool } from '../canvas2d/accumulation'
import { findTargetCollision } from '../canvas2d/collision'
import { calculateAccumulationBudget, calculateSnowParticleBudget } from '../canvas2d/quality'
import type { Canvas2DRenderer, RendererCanvases } from '../canvas2d/types'

type SnowParticle = {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  alpha: number
  depth: number
  phase: number
  phaseSpeed: number
  drift: number
}

type WebGLLayer = {
  canvas: HTMLCanvasElement
  gl: WebGLRenderingContext
  program: WebGLProgram
  buffer: WebGLBuffer
  positionLocation: number
  alphaLocation: number
  radiusLocation: number
  colorLocation: WebGLUniformLocation | null
  resolutionLocation: WebGLUniformLocation | null
  pixelRatioLocation: WebGLUniformLocation | null
  vertices: Float32Array
}

const MAX_DELTA_SECONDS = 0.05
const FULL_TURN = Math.PI * 2
const VALUES_PER_VERTEX = 4
const VERTICES_PER_PARTICLE = 1

const VERTEX_SHADER_SOURCE = `
attribute vec2 a_position;
attribute float a_alpha;
attribute float a_radius;
uniform vec2 u_resolution;
uniform float u_pixelRatio;
varying float v_alpha;
varying float v_radius_px;

void main() {
  vec2 zeroToOne = a_position / u_resolution;
  vec2 clipSpace = zeroToOne * 2.0 - 1.0;
  gl_Position = vec4(clipSpace * vec2(1.0, -1.0), 0.0, 1.0);
  v_alpha = a_alpha;
  v_radius_px = a_radius * u_pixelRatio;
  gl_PointSize = v_radius_px * 2.0;
}
`

const FRAGMENT_SHADER_SOURCE = `
precision mediump float;
uniform vec4 u_color;
varying float v_alpha;
varying float v_radius_px;

void main() {
  float dist = length(gl_PointCoord - vec2(0.5));
  if (dist > 0.5) {
    discard;
  }
  float dist_px = dist * 2.0 * v_radius_px;
  float alpha_edge = smoothstep(v_radius_px, v_radius_px - 1.0, dist_px);
  gl_FragColor = vec4(u_color.rgb, u_color.a * v_alpha * alpha_edge);
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
  particle: SnowParticle,
  size: CanvasLayerSize,
  options: NormalizedAtmosphereOptions,
  isBackground: boolean,
  initial = false,
) {
  const depth = isBackground ? randomRange(0.2, 0.48) : randomRange(0.55, 1.0)
  const speed = options.speed * randomRange(34, 116) * (0.45 + depth)
  const wind = options.wind * randomRange(20, 72) * depth

  const alphaScale = isBackground ? (0.65 + depth * 0.35) : (0.55 + depth * 0.45)
  const radiusScale = isBackground ? (0.85 + depth * 0.5) : (0.7 + depth * 0.7)

  particle.depth = depth
  particle.x = randomRange(-size.width * 0.12, size.width * 1.12)
  particle.y = initial ? randomRange(-size.height, size.height) : randomRange(-size.height * 0.18, 0)
  particle.vx = wind
  particle.vy = speed
  particle.radius = randomRange(0.8, 2.9) * radiusScale
  particle.alpha = randomRange(0.24, 0.82) * alphaScale
  particle.phase = randomRange(0, FULL_TURN)
  particle.phaseSpeed = randomRange(0.55, 1.65) * (0.7 + options.speed * 0.4)
  particle.drift = randomRange(7, 28) * depth
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
    radiusLocation: gl.getAttribLocation(program, 'a_radius'),
    colorLocation: gl.getUniformLocation(program, 'u_color'),
    resolutionLocation: gl.getUniformLocation(program, 'u_resolution'),
    pixelRatioLocation: gl.getUniformLocation(program, 'u_pixelRatio'),
    vertices: new Float32Array(capacity * VERTICES_PER_PARTICLE * VALUES_PER_VERTEX),
  }
}

export class WebGLSnowRenderer implements Canvas2DRenderer {
  readonly backend = 'webgl' as const
  private backgroundLayer: WebGLLayer | undefined
  private foregroundLayer: WebGLLayer | undefined
  private particles: SnowParticle[] = []
  private collisionTargets: readonly CollisionTargetRect[] = []
  private collisionTargetSignature = ''
  private readonly accumulation = new AccumulationPool()
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
    this.syncBudgets(true)
    this.canvases.background.addEventListener('webglcontextlost', this.handleContextLost)
    this.canvases.background.addEventListener('webglcontextrestored', this.handleContextRestored)
    this.canvases.foreground.addEventListener('webglcontextlost', this.handleContextLost)
    this.canvases.foreground.addEventListener('webglcontextrestored', this.handleContextRestored)
  }

  isReady() {
    return Boolean(this.backgroundLayer && this.foregroundLayer)
  }

  resize(size: CanvasLayerSize) {
    if (size.width !== this.size.width || size.height !== this.size.height) {
      this.accumulation.clear()
    }
    this.size = size
    this.syncBudgets(true)
  }

  updateOptions(options: NormalizedAtmosphereOptions) {
    const shouldReseedMotion =
      options.speed !== this.options.speed || options.wind !== this.options.wind
    this.options = options
    this.parsedColor = parseColor(options.color)
    this.syncBudgets(false)

    if (shouldReseedMotion) {
      const backgroundCount = Math.floor(this.particles.length * 0.42)
      for (let index = 0; index < this.particles.length; index += 1) {
        const particle = this.particles[index]
        recycleParticle(particle, this.size, this.options, index < backgroundCount, true)
      }
    }
  }

  setCollisionTargets(targets: readonly CollisionTargetRect[]) {
    const nextSignature = targets
      .map((target) => `${target.x},${target.y},${target.width},${target.height}`)
      .join('|')

    if (nextSignature !== this.collisionTargetSignature) {
      this.accumulation.clear()
      this.collisionTargetSignature = nextSignature
    }

    this.collisionTargets = targets
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
    let activeBackgroundCount = 0
    let activeForegroundCount = 0

    for (let index = 0; index < this.particles.length; index += 1) {
      const particle = this.particles[index]
      const previousDrawX = particle.x + Math.sin(particle.phase) * particle.drift
      const previousY = particle.y
      particle.phase += particle.phaseSpeed * deltaSeconds
      particle.x += particle.vx * deltaSeconds
      particle.y += particle.vy * deltaSeconds

      const drawX = particle.x + Math.sin(particle.phase) * particle.drift
      const isBackground = index < backgroundCount

      if (!isBackground) {
        const collision =
          particle.vy > 0
            ? findTargetCollision(previousDrawX, previousY, drawX, particle.y, this.collisionTargets)
            : undefined

        if (collision && collision.type === 'top') {
          if (this.options.snowAccumulation > 0) {
            this.accumulation.spawn(
              collision.x,
              collision.y,
              particle.radius * randomRange(0.65, 1.2),
              Math.min(0.82, particle.alpha * (0.58 + this.options.snowAccumulation * 0.42)),
              particle.depth,
              collision.target,
            )
          }
          recycleParticle(particle, this.size, this.options, false)
          continue
        }

        if (collision && (collision.type === 'left' || collision.type === 'right')) {
          particle.vx = 0
          particle.drift = Math.max(0.05, particle.drift * 0.08)
          const target = collision.target
          const drawXNew = collision.type === 'left' ? target.x - particle.radius - 1 : target.right + particle.radius + 1
          particle.x = drawXNew - Math.sin(particle.phase) * particle.drift
        }

        if (!collision && this.options.bottomCollision && previousY <= this.size.height && particle.y >= this.size.height && particle.vy > 0) {
          const progress = (this.size.height - previousY) / (particle.y - previousY)
          const landingX = previousDrawX + (drawX - previousDrawX) * progress
          if (this.options.snowAccumulation > 0) {
            this.accumulation.spawn(
              landingX,
              this.size.height,
              particle.radius * randomRange(0.65, 1.2),
              Math.min(0.82, particle.alpha * (0.58 + this.options.snowAccumulation * 0.42)),
              particle.depth,
              null,
            )
          }
          recycleParticle(particle, this.size, this.options, false)
          continue
        }
      }

      if (
        particle.y - particle.radius > this.size.height ||
        drawX > this.size.width * 1.15 ||
        drawX < -this.size.width * 0.15
      ) {
        recycleParticle(particle, this.size, this.options, isBackground)
      }

      const flakeX = particle.x + Math.sin(particle.phase) * particle.drift
      if (isBackground) {
        this.writeParticle(this.backgroundLayer, activeBackgroundCount, flakeX, particle.y, particle.alpha, particle.radius)
        activeBackgroundCount += 1
      } else {
        this.writeParticle(this.foregroundLayer, activeForegroundCount, flakeX, particle.y, particle.alpha, particle.radius)
        activeForegroundCount += 1
      }
    }

    if (this.options.snowAccumulation > 0) {
      this.accumulation.update(deltaSeconds, this.options, this.collisionTargets, this.size)
    }

    let activeAccumulationCount = 0
    for (let index = 0; index < this.accumulation.particles.length; index += 1) {
      const pile = this.accumulation.particles[index]
      if (
        !pile.active ||
        pile.x < -pile.radius ||
        pile.x > this.size.width + pile.radius ||
        pile.y < -pile.radius ||
        pile.y > this.size.height + pile.radius
      ) {
        continue
      }

      const drawY = pile.y - pile.radius * 0.45
      const drawRadius = pile.radius * (0.85 + pile.depth * 0.2)
      this.writeParticle(this.foregroundLayer, activeForegroundCount + activeAccumulationCount, pile.x, drawY, pile.alpha, drawRadius)
      activeAccumulationCount += 1
    }

    this.drawLayer(this.backgroundLayer, activeBackgroundCount)
    this.drawLayer(this.foregroundLayer, activeForegroundCount + activeAccumulationCount)
  }

  clear() {
    this.accumulation.clear()
    this.clearLayer(this.backgroundLayer)
    this.clearLayer(this.foregroundLayer)
  }

  destroy() {
    this.clear()
    this.accumulation.destroy()
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

  getActiveAccumulationCount() {
    return this.accumulation.getActiveCount()
  }

  getAccumulationCapacity() {
    return this.accumulation.getCapacity()
  }

  getStats() {
    return {
      backend: this.backend,
      particleCount: this.particles.length,
    }
  }



  private initializeLayers() {
    const particleCapacity = Math.max(1, this.particles.length)
    const accumulationCapacity = Math.max(1, this.accumulation.getCapacity())
    this.backgroundLayer = createLayer(this.canvases.background, particleCapacity)
    this.foregroundLayer = createLayer(this.canvases.foreground, particleCapacity + accumulationCapacity)
  }

  private syncBudgets(initial: boolean) {
    const particleBudget = calculateSnowParticleBudget({
      width: this.size.width,
      height: this.size.height,
      density: this.options.density,
      quality: this.options.quality,
    })
    const accumulationBudget =
      this.options.snowAccumulation <= 0
        ? 0
        : calculateAccumulationBudget({
            width: this.size.width,
            height: this.size.height,
            density: this.options.density * this.options.snowAccumulation,
            quality: this.options.quality,
          })

    const accumulationCapacityBefore = this.accumulation.getCapacity()
    this.accumulation.syncBudget(accumulationBudget)
    const accumulationCapacityAfter = this.accumulation.getCapacity()

    if (
      particleBudget !== this.particles.length ||
      accumulationCapacityBefore !== accumulationCapacityAfter
    ) {
      this.particles = []
      this.backgroundLayer = createLayer(this.canvases.background, Math.max(1, particleBudget))
      this.foregroundLayer = createLayer(this.canvases.foreground, Math.max(1, particleBudget + accumulationCapacityAfter))
    }

    while (this.particles.length < particleBudget) {
      const isBackground = this.particles.length < Math.floor(particleBudget * 0.42)
      const particle: SnowParticle = {
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        radius: 0,
        alpha: 0,
        depth: 0,
        phase: 0,
        phaseSpeed: 0,
        drift: 0,
      }

      recycleParticle(particle, this.size, this.options, isBackground, initial)
      this.particles.push(particle)
    }
  }

  private writeParticle(
    layer: WebGLLayer,
    vertexOffset: number,
    x: number,
    y: number,
    alpha: number,
    radius: number,
  ) {
    const start = vertexOffset * VALUES_PER_VERTEX
    layer.vertices[start] = x
    layer.vertices[start + 1] = y
    layer.vertices[start + 2] = alpha
    layer.vertices[start + 3] = radius
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
    gl.bufferData(
      gl.ARRAY_BUFFER,
      layer.vertices.subarray(0, vertexCount * VALUES_PER_VERTEX),
      gl.DYNAMIC_DRAW,
    )

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
    gl.enableVertexAttribArray(layer.radiusLocation)
    gl.vertexAttribPointer(
      layer.radiusLocation,
      1,
      gl.FLOAT,
      false,
      VALUES_PER_VERTEX * Float32Array.BYTES_PER_ELEMENT,
      3 * Float32Array.BYTES_PER_ELEMENT,
    )

    if (layer.resolutionLocation) {
      gl.uniform2f(layer.resolutionLocation, this.size.width, this.size.height)
    }
    if (layer.pixelRatioLocation) {
      gl.uniform1f(layer.pixelRatioLocation, this.size.pixelRatio)
    }
    if (layer.colorLocation) {
      gl.uniform4f(layer.colorLocation, red, green, blue, alpha)
    }

    gl.drawArrays(gl.POINTS, 0, vertexCount)
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

export function createWebGLSnowRenderer(
  canvases: RendererCanvases,
  size: CanvasLayerSize,
  options: NormalizedAtmosphereOptions,
): WebGLSnowRenderer | undefined {
  const renderer = new WebGLSnowRenderer(canvases, size, options)

  if (!renderer.isReady()) {
    renderer.destroy()
    return undefined
  }

  return renderer
}
