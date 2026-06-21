import type { NormalizedAtmosphereOptions } from '../../core/types'
import type { CanvasLayerSize } from '../../dom/canvasLayer'
import type { CollisionTargetRect } from '../../dom/collisionTargets'
import { findTopEdgeCollision } from '../canvas2d/collision'
import { calculateRainParticleBudget } from '../canvas2d/quality'
import { MAX_SPLASH_PARTICLES, SplashPool } from '../canvas2d/splash'
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
  localCoordLocation: number
  dimsLocation: number
  colorLocation: WebGLUniformLocation | null
  resolutionLocation: WebGLUniformLocation | null
  pixelRatioLocation: WebGLUniformLocation | null
  vertices: Float32Array
}

const MAX_DELTA_SECONDS = 0.05
const VALUES_PER_VERTEX = 8
const VERTICES_PER_PARTICLE = 6
// MAX_SPLASH_PARTICLES imported from '../canvas2d/splash'

const VERTEX_SHADER_SOURCE = `
attribute vec2 a_position;
attribute float a_alpha;
attribute vec2 a_local_coord;
attribute vec3 a_dims; // (L, r_tail, r_head)

uniform vec2 u_resolution;

varying float v_alpha;
varying vec2 v_local_coord;
varying vec3 v_dims;

void main() {
  vec2 zeroToOne = a_position / u_resolution;
  vec2 clipSpace = zeroToOne * 2.0 - 1.0;
  gl_Position = vec4(clipSpace * vec2(1.0, -1.0), 0.0, 1.0);
  v_alpha = a_alpha;
  v_local_coord = a_local_coord;
  v_dims = a_dims;
}
`

const FRAGMENT_SHADER_SOURCE = `
precision mediump float;

uniform vec4 u_color;
uniform float u_pixelRatio;

varying float v_alpha;
varying vec2 v_local_coord;
varying vec3 v_dims; // (L, r_tail, r_head)

void main() {
  float x = v_local_coord.x;
  float y = v_local_coord.y;
  float L = v_dims.x;
  float r_tail = v_dims.y;
  float r_head = v_dims.z;

  float dist_css = 0.0;
  if (x < 0.0) {
    dist_css = length(vec2(x, y)) - r_tail;
  } else if (x > L) {
    dist_css = length(vec2(x - L, y)) - r_head;
  } else {
    float r = mix(r_tail, r_head, x / L);
    dist_css = abs(y) - r;
  }

  float half_pixel_css = 0.5 / u_pixelRatio;
  float alpha_edge = smoothstep(half_pixel_css, -half_pixel_css, dist_css);

  float alpha_fade = 1.0;
  if (r_tail < r_head) {
    if (L > 0.0) {
      alpha_fade = clamp(x / L, 0.0, 1.0);
    }
  }

  float final_alpha = u_color.a * v_alpha * alpha_edge * alpha_fade;
  if (final_alpha <= 0.0) {
    discard;
  }

  gl_FragColor = vec4(u_color.rgb, final_alpha);
}
`

// Splash reuses the same vertex shader as rain — only the fragment shader differs.
// If the vertex transform changes, both programs stay in sync automatically.

const SPLASH_FRAGMENT_SHADER_SOURCE = `
precision mediump float;

uniform vec4 u_color;
uniform float u_pixelRatio;

varying float v_alpha;
varying vec2 v_local_coord;
varying vec3 v_dims; // (L, r, r)

void main() {
  float x = v_local_coord.x;
  float y = v_local_coord.y;
  float L = v_dims.x;
  float r = v_dims.y;

  float dist_css = 0.0;
  if (x < 0.0) {
    dist_css = length(vec2(x, y)) - r;
  } else if (x > L) {
    dist_css = length(vec2(x - L, y)) - r;
  } else {
    dist_css = abs(y) - r;
  }

  float half_pixel_css = 0.5 / u_pixelRatio;
  float alpha_edge = smoothstep(half_pixel_css, -half_pixel_css, dist_css);

  // Splash particles are uniform and solid
  float final_alpha = u_color.a * v_alpha * alpha_edge;
  if (final_alpha <= 0.0) {
    discard;
  }

  gl_FragColor = vec4(u_color.rgb, final_alpha);
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

  const alphaScale = isBackground ? (0.55 + depth * 0.45) : depth
  const lengthScale = isBackground ? (0.4 + depth * 0.6) : depth

  particle.depth = depth
  particle.x = randomRange(-size.width * 0.15, size.width * 1.15)
  particle.y = initial ? randomRange(-size.height, size.height) : randomRange(-size.height * 0.35, 0)
  particle.vx = wind
  particle.vy = speed
  particle.length = randomRange(10, 26) * lengthScale * (0.8 + options.speed * 0.35) * 1.3
  particle.alpha = (isBackground ? randomRange(0.35, 0.85) : randomRange(0.22, 0.78)) * alphaScale
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

function createProgramFromSource(
  gl: WebGLRenderingContext,
  vertexSource: string,
  fragmentSource: string,
): WebGLProgram | undefined {
  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexSource)
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource)

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

function createProgram(gl: WebGLRenderingContext): WebGLProgram | undefined {
  return createProgramFromSource(gl, VERTEX_SHADER_SOURCE, FRAGMENT_SHADER_SOURCE)
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
    localCoordLocation: gl.getAttribLocation(program, 'a_local_coord'),
    dimsLocation: gl.getAttribLocation(program, 'a_dims'),
    colorLocation: gl.getUniformLocation(program, 'u_color'),
    resolutionLocation: gl.getUniformLocation(program, 'u_resolution'),
    pixelRatioLocation: gl.getUniformLocation(program, 'u_pixelRatio'),
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

  private splashProgram: WebGLProgram | undefined
  private splashBuffer: WebGLBuffer | undefined
  private splashVertices: Float32Array | undefined
  private splashPositionLoc = -1
  private splashAlphaLoc = -1
  private splashLocalCoordLoc = -1
  private splashDimsLoc = -1
  private splashColorLoc: WebGLUniformLocation | null = null
  private splashResolutionLoc: WebGLUniformLocation | null = null
  private splashPixelRatioLoc: WebGLUniformLocation | null = null

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
      const backgroundCount = Math.floor(this.particles.length * 0.6)
      for (let index = 0; index < this.particles.length; index += 1) {
        const particle = this.particles[index]
        const isBackground = index < backgroundCount
        const depth = particle.depth
        particle.vy = options.speed * randomRange(520, 980) * depth
        particle.vx = options.wind * randomRange(120, 260) * depth
        const lengthScale = isBackground ? (0.4 + depth * 0.6) : depth
        particle.length = randomRange(10, 26) * lengthScale * (0.8 + options.speed * 0.35) * 1.3
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

    const backgroundCount = Math.floor(this.particles.length * 0.6)
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

    let splashVertexCount = 0
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

      splashVertexCount += this.writeSplash(splashVertexCount, splash, alpha)
    }

    this.drawLayer(this.backgroundLayer, backgroundVertexCount)
    // drawLayer clears the foreground canvas. drawSplashes intentionally skips
    // clearing so splash quads composite on top of the already-drawn foreground rain.
    this.drawLayer(this.foregroundLayer, foregroundVertexCount)
    this.drawSplashes(splashVertexCount)
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

    this.cleanupSplashResources()
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

  private cleanupSplashResources() {
    if (this.foregroundLayer) {
      const { gl } = this.foregroundLayer
      if (this.splashProgram) {
        gl.deleteProgram(this.splashProgram)
      }
      if (this.splashBuffer) {
        gl.deleteBuffer(this.splashBuffer)
      }
    }

    this.splashProgram = undefined
    this.splashBuffer = undefined
    this.splashVertices = undefined
  }

  private initializeLayers() {
    this.cleanupSplashResources()
    const capacity = Math.max(1, this.particles.length)
    this.backgroundLayer = createLayer(this.canvases.background, capacity)
    this.foregroundLayer = createLayer(this.canvases.foreground, capacity)
    this.initializeSplashProgram()
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
      this.cleanupSplashResources()
      this.backgroundLayer = createLayer(this.canvases.background, Math.max(1, budget))
      this.foregroundLayer = createLayer(this.canvases.foreground, Math.max(1, budget))
      this.initializeSplashProgram()
    }

    while (this.particles.length < budget) {
      const isBackground = this.particles.length < Math.floor(budget * 0.6)
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
    const dx = particle.vx * 0.018
    const dy = particle.length
    const len = Math.sqrt(dx * dx + dy * dy)
    
    const ux = len > 0 ? dx / len : 0
    const uy = len > 0 ? dy / len : 1
    const px = -uy
    const py = ux

    const depthScale = particle.layer === 'background' ? (0.48 + particle.depth * 0.52) : particle.depth
    const rHead = (particle.layer === 'background' ? 1.3 : 1.45) * depthScale * (1.0 + this.options.speed * 0.15) * 0.8
    const rTail = rHead * 0.22

    const tailExtX = (particle.x - dx) - ux * rTail
    const tailExtY = (particle.y - dy) - uy * rTail

    const headExtX = particle.x + ux * rHead
    const headExtY = particle.y + uy * rHead

    const c1x = tailExtX - px * rTail
    const c1y = tailExtY - py * rTail
    const c2x = tailExtX + px * rTail
    const c2y = tailExtY + py * rTail
    const c3x = headExtX - px * rHead
    const c3y = headExtY - py * rHead
    const c4x = headExtX + px * rHead
    const c4y = headExtY + py * rHead

    const start = vertexOffset * VALUES_PER_VERTEX

    const writeVertex = (vertexIndex: number, vx: number, vy: number, lu: number, lv: number) => {
      const idx = start + vertexIndex * 8
      layer.vertices[idx] = vx
      layer.vertices[idx + 1] = vy
      layer.vertices[idx + 2] = particle.alpha
      layer.vertices[idx + 3] = lu
      layer.vertices[idx + 4] = lv
      layer.vertices[idx + 5] = len
      layer.vertices[idx + 6] = rTail
      layer.vertices[idx + 7] = rHead
    }

    // Triangle 1: Corner 1 (tail left), Corner 2 (tail right), Corner 3 (head left)
    writeVertex(0, c1x, c1y, -rTail, -rTail)
    writeVertex(1, c2x, c2y, -rTail, rTail)
    writeVertex(2, c3x, c3y, len + rHead, -rHead)

    // Triangle 2: Corner 3 (head left), Corner 2 (tail right), Corner 4 (head right)
    writeVertex(3, c3x, c3y, len + rHead, -rHead)
    writeVertex(4, c2x, c2y, -rTail, rTail)
    writeVertex(5, c4x, c4y, len + rHead, rHead)

    return VERTICES_PER_PARTICLE
  }

  private writeSplash(vertexOffset: number, splash: any, alpha: number) {
    if (!this.splashVertices) {
      return 0
    }

    const dx = splash.vx * 0.012
    const dy = splash.vy * 0.012 + splash.length
    const len = Math.sqrt(dx * dx + dy * dy)
    
    const ux = len > 0 ? dx / len : 0
    const uy = len > 0 ? dy / len : 1
    const px = -uy
    const py = ux

    const rHead = 0.7 * splash.width
    const rTail = rHead

    const tailExtX = (splash.x - dx) - ux * rTail
    const tailExtY = (splash.y - dy) - uy * rTail

    const headExtX = splash.x + ux * rHead
    const headExtY = splash.y + uy * rHead

    const c1x = tailExtX - px * rTail
    const c1y = tailExtY - py * rTail
    const c2x = tailExtX + px * rTail
    const c2y = tailExtY + py * rTail
    const c3x = headExtX - px * rHead
    const c3y = headExtY - py * rHead
    const c4x = headExtX + px * rHead
    const c4y = headExtY + py * rHead

    const start = vertexOffset * VALUES_PER_VERTEX

    const writeVertex = (vertexIndex: number, vx: number, vy: number, lu: number, lv: number) => {
      const idx = start + vertexIndex * 8
      this.splashVertices![idx] = vx
      this.splashVertices![idx + 1] = vy
      this.splashVertices![idx + 2] = alpha
      this.splashVertices![idx + 3] = lu
      this.splashVertices![idx + 4] = lv
      this.splashVertices![idx + 5] = len
      this.splashVertices![idx + 6] = rTail
      this.splashVertices![idx + 7] = rHead
    }

    // Triangle 1: Corner 1 (tail left), Corner 2 (tail right), Corner 3 (head left)
    writeVertex(0, c1x, c1y, -rTail, -rTail)
    writeVertex(1, c2x, c2y, -rTail, rTail)
    writeVertex(2, c3x, c3y, len + rHead, -rHead)

    // Triangle 2: Corner 3 (head left), Corner 2 (tail right), Corner 4 (head right)
    writeVertex(3, c3x, c3y, len + rHead, -rHead)
    writeVertex(4, c2x, c2y, -rTail, rTail)
    writeVertex(5, c4x, c4y, len + rHead, rHead)

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

    gl.enableVertexAttribArray(layer.localCoordLocation)
    gl.vertexAttribPointer(
      layer.localCoordLocation,
      2,
      gl.FLOAT,
      false,
      VALUES_PER_VERTEX * Float32Array.BYTES_PER_ELEMENT,
      3 * Float32Array.BYTES_PER_ELEMENT,
    )

    gl.enableVertexAttribArray(layer.dimsLocation)
    gl.vertexAttribPointer(
      layer.dimsLocation,
      3,
      gl.FLOAT,
      false,
      VALUES_PER_VERTEX * Float32Array.BYTES_PER_ELEMENT,
      5 * Float32Array.BYTES_PER_ELEMENT,
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

    gl.drawArrays(gl.TRIANGLES, 0, vertexCount)
  }

  private drawSplashes(vertexCount: number) {
    if (!this.foregroundLayer || !this.splashProgram || !this.splashBuffer || !this.splashVertices || vertexCount <= 0) {
      return
    }

    const { gl } = this.foregroundLayer

    gl.viewport(0, 0, this.size.canvasWidth, this.size.canvasHeight)
    const [red, green, blue, alpha] = this.parsedColor

    gl.useProgram(this.splashProgram)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.splashBuffer)
    gl.bufferData(
      gl.ARRAY_BUFFER,
      this.splashVertices.subarray(0, vertexCount * VALUES_PER_VERTEX),
      gl.DYNAMIC_DRAW,
    )

    gl.enableVertexAttribArray(this.splashPositionLoc)
    gl.vertexAttribPointer(
      this.splashPositionLoc,
      2,
      gl.FLOAT,
      false,
      VALUES_PER_VERTEX * Float32Array.BYTES_PER_ELEMENT,
      0,
    )

    gl.enableVertexAttribArray(this.splashAlphaLoc)
    gl.vertexAttribPointer(
      this.splashAlphaLoc,
      1,
      gl.FLOAT,
      false,
      VALUES_PER_VERTEX * Float32Array.BYTES_PER_ELEMENT,
      2 * Float32Array.BYTES_PER_ELEMENT,
    )

    gl.enableVertexAttribArray(this.splashLocalCoordLoc)
    gl.vertexAttribPointer(
      this.splashLocalCoordLoc,
      2,
      gl.FLOAT,
      false,
      VALUES_PER_VERTEX * Float32Array.BYTES_PER_ELEMENT,
      3 * Float32Array.BYTES_PER_ELEMENT,
    )

    gl.enableVertexAttribArray(this.splashDimsLoc)
    gl.vertexAttribPointer(
      this.splashDimsLoc,
      3,
      gl.FLOAT,
      false,
      VALUES_PER_VERTEX * Float32Array.BYTES_PER_ELEMENT,
      5 * Float32Array.BYTES_PER_ELEMENT,
    )

    if (this.splashResolutionLoc) {
      gl.uniform2f(this.splashResolutionLoc, this.size.width, this.size.height)
    }

    if (this.splashPixelRatioLoc) {
      gl.uniform1f(this.splashPixelRatioLoc, this.size.pixelRatio)
    }

    if (this.splashColorLoc) {
      gl.uniform4f(this.splashColorLoc, red, green, blue, alpha)
    }

    gl.drawArrays(gl.TRIANGLES, 0, vertexCount)
  }

  private initializeSplashProgram() {
    if (!this.foregroundLayer) {
      return
    }

    const { gl } = this.foregroundLayer
    const program = createProgramFromSource(gl, VERTEX_SHADER_SOURCE, SPLASH_FRAGMENT_SHADER_SOURCE)
    const buffer = gl.createBuffer()

    if (!program || !buffer) {
      return
    }

    this.splashProgram = program
    this.splashBuffer = buffer
    this.splashPositionLoc = gl.getAttribLocation(program, 'a_position')
    this.splashAlphaLoc = gl.getAttribLocation(program, 'a_alpha')
    this.splashLocalCoordLoc = gl.getAttribLocation(program, 'a_local_coord')
    this.splashDimsLoc = gl.getAttribLocation(program, 'a_dims')
    this.splashColorLoc = gl.getUniformLocation(program, 'u_color')
    this.splashResolutionLoc = gl.getUniformLocation(program, 'u_resolution')
    this.splashPixelRatioLoc = gl.getUniformLocation(program, 'u_pixelRatio')
    this.splashVertices = new Float32Array(MAX_SPLASH_PARTICLES * VERTICES_PER_PARTICLE * VALUES_PER_VERTEX)
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
