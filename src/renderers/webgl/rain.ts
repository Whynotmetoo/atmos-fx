import type { NormalizedAtmosphereOptions } from '../../core/types'
import type { CanvasLayerSize } from '../../dom/canvasLayer'
import type { CollisionTargetRect } from '../../dom/collisionTargets'
import { findTargetCollision } from '../canvas2d/collision'
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
  ext: any // ANGLE_instanced_arrays
  program: WebGLProgram
  buffer: WebGLBuffer
  quadBuffer: WebGLBuffer
  quadPosLocation: number
  positionLocation: number
  dirLocation: number
  lenLocation: number
  alphaLocation: number
  radiiLocation: number
  colorLocation: WebGLUniformLocation | null
  resolutionLocation: WebGLUniformLocation | null
  pixelRatioLocation: WebGLUniformLocation | null
  instances: Float32Array
}

const MAX_DELTA_SECONDS = 0.05
const VALUES_PER_INSTANCE = 8
const QUAD_VERTICES = new Float32Array([
  0.0, -1.0,
  0.0, 1.0,
  1.0, -1.0,
  1.0, -1.0,
  0.0, 1.0,
  1.0, 1.0,
])
// MAX_SPLASH_PARTICLES imported from '../canvas2d/splash'

const VERTEX_SHADER_SOURCE = `
attribute vec2 a_quad_pos;
attribute vec2 a_position;
attribute vec2 a_dir;
attribute float a_len;
attribute float a_alpha;
attribute vec2 a_radii; // (r_tail, r_head)

uniform vec2 u_resolution;

varying float v_alpha;
varying vec2 v_local_coord;
varying vec3 v_dims;

void main() {
  float r = mix(a_radii.x, a_radii.y, a_quad_pos.x);
  float lu = mix(-a_radii.x, a_len + a_radii.y, a_quad_pos.x);
  float lv = a_quad_pos.y * r;
  v_local_coord = vec2(lu, lv);
  
  v_alpha = a_alpha;
  v_dims = vec3(a_len, a_radii.x, a_radii.y);

  float offset_u = mix(-a_len - a_radii.x, a_radii.y, a_quad_pos.x);
  float offset_v = a_quad_pos.y * r;

  vec2 u = a_dir;
  vec2 p = vec2(-u.y, u.x);

  vec2 world_pos = a_position + u * offset_u + p * offset_v;
  
  vec2 zeroToOne = world_pos / u_resolution;
  vec2 clipSpace = zeroToOne * 2.0 - 1.0;
  gl_Position = vec4(clipSpace * vec2(1.0, -1.0), 0.0, 1.0);
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

  const ext = gl.getExtension('ANGLE_instanced_arrays')
  if (!ext) {
    return undefined
  }

  const program = createProgram(gl)
  const buffer = gl.createBuffer()
  const quadBuffer = gl.createBuffer()

  if (!program || !buffer || !quadBuffer) {
    return undefined
  }

  // Upload static template quad vertices
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer)
  gl.bufferData(gl.ARRAY_BUFFER, QUAD_VERTICES, gl.STATIC_DRAW)

  return {
    canvas,
    gl,
    ext,
    program,
    buffer,
    quadBuffer,
    quadPosLocation: gl.getAttribLocation(program, 'a_quad_pos'),
    positionLocation: gl.getAttribLocation(program, 'a_position'),
    dirLocation: gl.getAttribLocation(program, 'a_dir'),
    lenLocation: gl.getAttribLocation(program, 'a_len'),
    alphaLocation: gl.getAttribLocation(program, 'a_alpha'),
    radiiLocation: gl.getAttribLocation(program, 'a_radii'),
    colorLocation: gl.getUniformLocation(program, 'u_color'),
    resolutionLocation: gl.getUniformLocation(program, 'u_resolution'),
    pixelRatioLocation: gl.getUniformLocation(program, 'u_pixelRatio'),
    instances: new Float32Array(capacity * VALUES_PER_INSTANCE),
  }
}

function cleanupLayerResources(layer: WebGLLayer | undefined) {
  if (!layer) {
    return
  }

  const { gl, program, buffer, quadBuffer } = layer
  gl.deleteProgram(program)
  gl.deleteBuffer(buffer)
  gl.deleteBuffer(quadBuffer)
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
  private splashQuadBuffer: WebGLBuffer | undefined
  private splashInstances: Float32Array | undefined
  private splashQuadPosLoc = -1
  private splashPositionLoc = -1
  private splashDirLoc = -1
  private splashLenLoc = -1
  private splashAlphaLoc = -1
  private splashRadiiLoc = -1
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
    const shouldSeedAcrossViewport = options.quality !== this.options.quality
    this.options = options
    this.parsedColor = parseColor(options.color)
    this.syncParticleBudget(shouldSeedAcrossViewport)

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
    let backgroundInstanceCount = 0
    let foregroundInstanceCount = 0

    for (let index = 0; index < this.particles.length; index += 1) {
      const particle = this.particles[index]
      const previousX = particle.x
      const previousY = particle.y
      const nextX = particle.x + particle.vx * deltaSeconds
      const nextY = particle.y + particle.vy * deltaSeconds

      const collision =
        index >= backgroundCount
          ? findTargetCollision(previousX, previousY, nextX, nextY, this.collisionTargets)
          : undefined

      if (collision) {
        let splashVx = particle.vx
        if (collision.type === 'left') {
          splashVx = -Math.abs(particle.vx) * 0.4
        } else if (collision.type === 'right') {
          splashVx = Math.abs(particle.vx) * 0.4
        }
        this.splashes.spawn(collision.x, collision.y, splashVx, particle.depth)
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

      let drawBehind = false
      if (index >= backgroundCount) {
        for (let i = 0; i < this.collisionTargets.length; i++) {
          const target = this.collisionTargets[i]!
          if (target.y >= particle.y) {
            break
          }
          if (
            particle.x >= target.x &&
            particle.x <= target.right &&
            particle.y < target.bottom
          ) {
            drawBehind = true
            break
          }
        }
      }

      if (index < backgroundCount || drawBehind) {
        backgroundInstanceCount += this.writeParticle(this.backgroundLayer, backgroundInstanceCount, particle)
      } else {
        foregroundInstanceCount += this.writeParticle(this.foregroundLayer, foregroundInstanceCount, particle)
      }
    }

    let splashInstanceCount = 0
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

      // Physics-based clipping: if splash particle enters target card bounds, destroy it
      let hitCard = false
      for (let i = 0; i < this.collisionTargets.length; i++) {
        const target = this.collisionTargets[i]!
        if (
          splash.x >= target.x &&
          splash.x <= target.right &&
          splash.y >= target.y &&
          splash.y <= target.bottom
        ) {
          hitCard = true
          break
        }
      }

      if (hitCard) {
        splash.active = false
        continue
      }

      const lifeProgress = splash.age / splash.lifetime
      const alpha = splash.alpha * (1 - lifeProgress)

      splashInstanceCount += this.writeSplash(splashInstanceCount, splash, alpha)
    }

    this.drawLayer(this.backgroundLayer, backgroundInstanceCount)
    // drawLayer clears the foreground canvas. drawSplashes intentionally skips
    // clearing so splash quads composite on top of the already-drawn foreground rain.
    this.drawLayer(this.foregroundLayer, foregroundInstanceCount)
    this.drawSplashes(splashInstanceCount)
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
    cleanupLayerResources(this.backgroundLayer)
    cleanupLayerResources(this.foregroundLayer)
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
      if (this.splashQuadBuffer) {
        gl.deleteBuffer(this.splashQuadBuffer)
      }
    }

    this.splashProgram = undefined
    this.splashBuffer = undefined
    this.splashQuadBuffer = undefined
    this.splashInstances = undefined
  }

  private initializeLayers() {
    this.cleanupSplashResources()
    cleanupLayerResources(this.backgroundLayer)
    cleanupLayerResources(this.foregroundLayer)
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
      cleanupLayerResources(this.backgroundLayer)
      cleanupLayerResources(this.foregroundLayer)
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

  private writeParticle(layer: WebGLLayer, instanceOffset: number, particle: RainParticle) {
    const dx = particle.vx * 0.018
    const dy = particle.length
    const len = Math.sqrt(dx * dx + dy * dy)
    
    const ux = len > 0 ? dx / len : 0
    const uy = len > 0 ? dy / len : 1

    const depthScale = particle.layer === 'background' ? (0.48 + particle.depth * 0.52) : particle.depth
    const rHead = (particle.layer === 'background' ? 1.3 : 1.45) * depthScale * (1.0 + this.options.speed * 0.15) * 0.8
    const rTail = rHead * 0.22

    const idx = instanceOffset * VALUES_PER_INSTANCE
    layer.instances[idx] = particle.x
    layer.instances[idx + 1] = particle.y
    layer.instances[idx + 2] = ux
    layer.instances[idx + 3] = uy
    layer.instances[idx + 4] = len
    layer.instances[idx + 5] = particle.alpha
    layer.instances[idx + 6] = rTail
    layer.instances[idx + 7] = rHead

    return 1
  }

  private writeSplash(instanceOffset: number, splash: any, alpha: number) {
    if (!this.splashInstances) {
      return 0
    }

    const dx = splash.vx * 0.012
    const dy = splash.vy * 0.012 + splash.length
    const len = Math.sqrt(dx * dx + dy * dy)
    
    const ux = len > 0 ? dx / len : 0
    const uy = len > 0 ? dy / len : 1

    const rHead = 0.7 * splash.width
    const rTail = rHead

    const idx = instanceOffset * VALUES_PER_INSTANCE
    this.splashInstances[idx] = splash.x
    this.splashInstances[idx + 1] = splash.y
    this.splashInstances[idx + 2] = ux
    this.splashInstances[idx + 3] = uy
    this.splashInstances[idx + 4] = len
    this.splashInstances[idx + 5] = alpha
    this.splashInstances[idx + 6] = rTail
    this.splashInstances[idx + 7] = rHead

    return 1
  }

  private drawLayer(layer: WebGLLayer, instanceCount: number) {
    const { gl, ext } = layer
    const [red, green, blue, alpha] = this.parsedColor

    gl.viewport(0, 0, this.size.canvasWidth, this.size.canvasHeight)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)

    if (instanceCount <= 0) {
      return
    }

    gl.useProgram(layer.program)

    // Bind static quad template
    gl.bindBuffer(gl.ARRAY_BUFFER, layer.quadBuffer)
    gl.enableVertexAttribArray(layer.quadPosLocation)
    gl.vertexAttribPointer(layer.quadPosLocation, 2, gl.FLOAT, false, 0, 0)
    ext.vertexAttribDivisorANGLE(layer.quadPosLocation, 0)

    // Bind dynamic instance attributes buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, layer.buffer)
    gl.bufferData(
      gl.ARRAY_BUFFER,
      layer.instances.subarray(0, instanceCount * VALUES_PER_INSTANCE),
      gl.DYNAMIC_DRAW,
    )

    // a_position: offset 0
    gl.enableVertexAttribArray(layer.positionLocation)
    gl.vertexAttribPointer(
      layer.positionLocation,
      2,
      gl.FLOAT,
      false,
      VALUES_PER_INSTANCE * Float32Array.BYTES_PER_ELEMENT,
      0,
    )
    ext.vertexAttribDivisorANGLE(layer.positionLocation, 1)

    // a_dir: offset 2 * 4 = 8 bytes
    gl.enableVertexAttribArray(layer.dirLocation)
    gl.vertexAttribPointer(
      layer.dirLocation,
      2,
      gl.FLOAT,
      false,
      VALUES_PER_INSTANCE * Float32Array.BYTES_PER_ELEMENT,
      2 * Float32Array.BYTES_PER_ELEMENT,
    )
    ext.vertexAttribDivisorANGLE(layer.dirLocation, 1)

    // a_len: offset 4 * 4 = 16 bytes
    gl.enableVertexAttribArray(layer.lenLocation)
    gl.vertexAttribPointer(
      layer.lenLocation,
      1,
      gl.FLOAT,
      false,
      VALUES_PER_INSTANCE * Float32Array.BYTES_PER_ELEMENT,
      4 * Float32Array.BYTES_PER_ELEMENT,
    )
    ext.vertexAttribDivisorANGLE(layer.lenLocation, 1)

    // a_alpha: offset 5 * 4 = 20 bytes
    gl.enableVertexAttribArray(layer.alphaLocation)
    gl.vertexAttribPointer(
      layer.alphaLocation,
      1,
      gl.FLOAT,
      false,
      VALUES_PER_INSTANCE * Float32Array.BYTES_PER_ELEMENT,
      5 * Float32Array.BYTES_PER_ELEMENT,
    )
    ext.vertexAttribDivisorANGLE(layer.alphaLocation, 1)

    // a_radii: offset 6 * 4 = 24 bytes
    gl.enableVertexAttribArray(layer.radiiLocation)
    gl.vertexAttribPointer(
      layer.radiiLocation,
      2,
      gl.FLOAT,
      false,
      VALUES_PER_INSTANCE * Float32Array.BYTES_PER_ELEMENT,
      6 * Float32Array.BYTES_PER_ELEMENT,
    )
    ext.vertexAttribDivisorANGLE(layer.radiiLocation, 1)

    if (layer.resolutionLocation) {
      gl.uniform2f(layer.resolutionLocation, this.size.width, this.size.height)
    }

    if (layer.pixelRatioLocation) {
      gl.uniform1f(layer.pixelRatioLocation, this.size.pixelRatio)
    }

    if (layer.colorLocation) {
      gl.uniform4f(layer.colorLocation, red, green, blue, alpha)
    }

    ext.drawArraysInstancedANGLE(gl.TRIANGLES, 0, 6, instanceCount)

    // Reset divisors to prevent side-effects on other drawing operations
    ext.vertexAttribDivisorANGLE(layer.quadPosLocation, 0)
    ext.vertexAttribDivisorANGLE(layer.positionLocation, 0)
    ext.vertexAttribDivisorANGLE(layer.dirLocation, 0)
    ext.vertexAttribDivisorANGLE(layer.lenLocation, 0)
    ext.vertexAttribDivisorANGLE(layer.alphaLocation, 0)
    ext.vertexAttribDivisorANGLE(layer.radiiLocation, 0)
  }

  private drawSplashes(instanceCount: number) {
    if (!this.foregroundLayer || !this.splashProgram || !this.splashBuffer || !this.splashInstances || instanceCount <= 0) {
      return
    }

    const { gl, ext } = this.foregroundLayer

    gl.viewport(0, 0, this.size.canvasWidth, this.size.canvasHeight)
    const [red, green, blue, alpha] = this.parsedColor

    gl.useProgram(this.splashProgram)

    // Bind static quad template
    gl.bindBuffer(gl.ARRAY_BUFFER, this.splashQuadBuffer!)
    gl.enableVertexAttribArray(this.splashQuadPosLoc)
    gl.vertexAttribPointer(this.splashQuadPosLoc, 2, gl.FLOAT, false, 0, 0)
    ext.vertexAttribDivisorANGLE(this.splashQuadPosLoc, 0)

    // Bind dynamic instance attributes buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, this.splashBuffer)
    gl.bufferData(
      gl.ARRAY_BUFFER,
      this.splashInstances.subarray(0, instanceCount * VALUES_PER_INSTANCE),
      gl.DYNAMIC_DRAW,
    )

    // a_position: offset 0
    gl.enableVertexAttribArray(this.splashPositionLoc)
    gl.vertexAttribPointer(
      this.splashPositionLoc,
      2,
      gl.FLOAT,
      false,
      VALUES_PER_INSTANCE * Float32Array.BYTES_PER_ELEMENT,
      0,
    )
    ext.vertexAttribDivisorANGLE(this.splashPositionLoc, 1)

    // a_dir: offset 2 * 4 = 8 bytes
    gl.enableVertexAttribArray(this.splashDirLoc)
    gl.vertexAttribPointer(
      this.splashDirLoc,
      2,
      gl.FLOAT,
      false,
      VALUES_PER_INSTANCE * Float32Array.BYTES_PER_ELEMENT,
      2 * Float32Array.BYTES_PER_ELEMENT,
    )
    ext.vertexAttribDivisorANGLE(this.splashDirLoc, 1)

    // a_len: offset 4 * 4 = 16 bytes
    gl.enableVertexAttribArray(this.splashLenLoc)
    gl.vertexAttribPointer(
      this.splashLenLoc,
      1,
      gl.FLOAT,
      false,
      VALUES_PER_INSTANCE * Float32Array.BYTES_PER_ELEMENT,
      4 * Float32Array.BYTES_PER_ELEMENT,
    )
    ext.vertexAttribDivisorANGLE(this.splashLenLoc, 1)

    // a_alpha: offset 5 * 4 = 20 bytes
    gl.enableVertexAttribArray(this.splashAlphaLoc)
    gl.vertexAttribPointer(
      this.splashAlphaLoc,
      1,
      gl.FLOAT,
      false,
      VALUES_PER_INSTANCE * Float32Array.BYTES_PER_ELEMENT,
      5 * Float32Array.BYTES_PER_ELEMENT,
    )
    ext.vertexAttribDivisorANGLE(this.splashAlphaLoc, 1)

    // a_radii: offset 6 * 4 = 24 bytes
    gl.enableVertexAttribArray(this.splashRadiiLoc)
    gl.vertexAttribPointer(
      this.splashRadiiLoc,
      2,
      gl.FLOAT,
      false,
      VALUES_PER_INSTANCE * Float32Array.BYTES_PER_ELEMENT,
      6 * Float32Array.BYTES_PER_ELEMENT,
    )
    ext.vertexAttribDivisorANGLE(this.splashRadiiLoc, 1)

    if (this.splashResolutionLoc) {
      gl.uniform2f(this.splashResolutionLoc, this.size.width, this.size.height)
    }

    if (this.splashPixelRatioLoc) {
      gl.uniform1f(this.splashPixelRatioLoc, this.size.pixelRatio)
    }

    if (this.splashColorLoc) {
      gl.uniform4f(this.splashColorLoc, red, green, blue, alpha)
    }

    ext.drawArraysInstancedANGLE(gl.TRIANGLES, 0, 6, instanceCount)

    // Reset divisors
    ext.vertexAttribDivisorANGLE(this.splashQuadPosLoc, 0)
    ext.vertexAttribDivisorANGLE(this.splashPositionLoc, 0)
    ext.vertexAttribDivisorANGLE(this.splashDirLoc, 0)
    ext.vertexAttribDivisorANGLE(this.splashLenLoc, 0)
    ext.vertexAttribDivisorANGLE(this.splashAlphaLoc, 0)
    ext.vertexAttribDivisorANGLE(this.splashRadiiLoc, 0)
  }

  private initializeSplashProgram() {
    if (!this.foregroundLayer) {
      return
    }

    const { gl } = this.foregroundLayer
    const program = createProgramFromSource(gl, VERTEX_SHADER_SOURCE, SPLASH_FRAGMENT_SHADER_SOURCE)
    const buffer = gl.createBuffer()
    const quadBuffer = gl.createBuffer()

    if (!program || !buffer || !quadBuffer) {
      return
    }

    // Upload static template quad vertices
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, QUAD_VERTICES, gl.STATIC_DRAW)

    this.splashProgram = program
    this.splashBuffer = buffer
    this.splashQuadBuffer = quadBuffer
    this.splashQuadPosLoc = gl.getAttribLocation(program, 'a_quad_pos')
    this.splashPositionLoc = gl.getAttribLocation(program, 'a_position')
    this.splashDirLoc = gl.getAttribLocation(program, 'a_dir')
    this.splashLenLoc = gl.getAttribLocation(program, 'a_len')
    this.splashAlphaLoc = gl.getAttribLocation(program, 'a_alpha')
    this.splashRadiiLoc = gl.getAttribLocation(program, 'a_radii')
    this.splashColorLoc = gl.getUniformLocation(program, 'u_color')
    this.splashResolutionLoc = gl.getUniformLocation(program, 'u_resolution')
    this.splashPixelRatioLoc = gl.getUniformLocation(program, 'u_pixelRatio')
    this.splashInstances = new Float32Array(MAX_SPLASH_PARTICLES * VALUES_PER_INSTANCE)
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
