import type { NormalizedAtmosphereOptions } from '../../core/types'
import type { CanvasLayerSize } from '../../dom/canvasLayer'
import type { CollisionTargetRect } from '../../dom/collisionTargets'
import { AccumulationPool } from '../canvas2d/accumulation'
import { findTargetCollision } from '../canvas2d/collision'
import { calculateAccumulationBudget, calculateHailParticleBudget } from '../canvas2d/quality'
import type { Canvas2DRenderer, RendererCanvases } from '../canvas2d/types'

type HailParticle = {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  alpha: number
  depth: number
  bounces: number
  rolling?: boolean
  rollTime?: number
  lastTarget?: CollisionTargetRect
}

type WebGLHailLayer = {
  canvas: HTMLCanvasElement
  gl: WebGLRenderingContext
  hailProgram: WebGLProgram
  solidProgram: WebGLProgram
  buffer: WebGLBuffer
  
  hailPositionLocation: number
  hailAlphaLocation: number
  hailRadiusLocation: number
  hailColorLocation: WebGLUniformLocation | null
  hailResolutionLocation: WebGLUniformLocation | null
  hailPixelRatioLocation: WebGLUniformLocation | null
  
  solidPositionLocation: number
  solidAlphaLocation: number
  solidRadiusLocation: number
  solidColorLocation: WebGLUniformLocation | null
  solidResolutionLocation: WebGLUniformLocation | null
  solidPixelRatioLocation: WebGLUniformLocation | null

  vertices: Float32Array
}

const MAX_DELTA_SECONDS = 0.05
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

const SOLID_FRAGMENT_SHADER_SOURCE = `
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

const HAIL_FRAGMENT_SHADER_SOURCE = `
precision mediump float;
uniform vec4 u_color;
varying float v_alpha;
varying float v_radius_px;

void main() {
  vec2 coord = gl_PointCoord - vec2(0.5);
  float dist = length(coord);
  if (dist > 0.5) {
    discard;
  }
  float dist_px = dist * 2.0 * v_radius_px;
  float alpha_edge = smoothstep(v_radius_px, v_radius_px - 1.0, dist_px);
  
  // Highlight reflection circle
  vec2 highlight_center = vec2(-0.14, -0.16);
  float highlight_dist = length(coord - highlight_center);
  float highlight_radius = 0.32 * 0.5;
  float highlight_dist_px = highlight_dist * 2.0 * v_radius_px;
  float highlight_radius_px = highlight_radius * 2.0 * v_radius_px;
  float highlight_alpha = smoothstep(highlight_radius_px, highlight_radius_px - 1.0, highlight_dist_px) * 0.55 * v_alpha;
  
  // Stroke border color
  vec4 stroke_color = vec4(1.0, 1.0, 1.0, 0.52);
  
  // Outer border blend
  float border_blend = smoothstep(max(0.0, v_radius_px - 1.5), v_radius_px - 0.5, dist_px);
  vec4 base_color = mix(vec4(u_color.rgb, u_color.a * v_alpha), vec4(stroke_color.rgb, stroke_color.a * v_alpha), border_blend);
  
  // Shine highlight compositing
  vec4 highlight_color = vec4(1.0, 1.0, 1.0, highlight_alpha);
  vec4 final_color = vec4(
    mix(base_color.rgb, highlight_color.rgb, highlight_color.a),
    base_color.a + highlight_color.a * (1.0 - base_color.a)
  );
  
  gl_FragColor = vec4(final_color.rgb, final_color.a * alpha_edge);
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
  particle: HailParticle,
  size: CanvasLayerSize,
  options: NormalizedAtmosphereOptions,
  isBackground: boolean,
  initial = false,
) {
  const depth = isBackground ? randomRange(0.2, 0.48) : randomRange(0.55, 1.0)
  const speed = options.speed * randomRange(430, 780) * (0.75 + depth * 0.4)
  const wind = options.wind * randomRange(42, 126) * depth

  const alphaScale = isBackground ? (0.7 + depth * 0.3) : (0.6 + depth * 0.4)
  const radiusScale = isBackground ? (0.86 + depth * 0.35) : (0.76 + depth * 0.45)

  particle.depth = depth
  particle.x = randomRange(-size.width * 0.12, size.width * 1.12)
  particle.y = initial ? randomRange(-size.height, size.height) : randomRange(-size.height * 0.22, 0)
  particle.vx = wind
  particle.vy = speed
  particle.radius = randomRange(1.6, 4.2) * radiusScale
  particle.alpha = randomRange(0.36, 0.86) * alphaScale
  particle.bounces = 0
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

function createProgram(
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

function createHailLayer(canvas: HTMLCanvasElement, capacity: number): WebGLHailLayer | undefined {
  const gl = getWebGLContext(canvas)

  if (!gl) {
    return undefined
  }

  const hailProgram = createProgram(gl, VERTEX_SHADER_SOURCE, HAIL_FRAGMENT_SHADER_SOURCE)
  const solidProgram = createProgram(gl, VERTEX_SHADER_SOURCE, SOLID_FRAGMENT_SHADER_SOURCE)
  const buffer = gl.createBuffer()

  if (!hailProgram || !solidProgram || !buffer) {
    return undefined
  }

  return {
    canvas,
    gl,
    hailProgram,
    solidProgram,
    buffer,
    
    hailPositionLocation: gl.getAttribLocation(hailProgram, 'a_position'),
    hailAlphaLocation: gl.getAttribLocation(hailProgram, 'a_alpha'),
    hailRadiusLocation: gl.getAttribLocation(hailProgram, 'a_radius'),
    hailColorLocation: gl.getUniformLocation(hailProgram, 'u_color'),
    hailResolutionLocation: gl.getUniformLocation(hailProgram, 'u_resolution'),
    hailPixelRatioLocation: gl.getUniformLocation(hailProgram, 'u_pixelRatio'),
    
    solidPositionLocation: gl.getAttribLocation(solidProgram, 'a_position'),
    solidAlphaLocation: gl.getAttribLocation(solidProgram, 'a_alpha'),
    solidRadiusLocation: gl.getAttribLocation(solidProgram, 'a_radius'),
    solidColorLocation: gl.getUniformLocation(solidProgram, 'u_color'),
    solidResolutionLocation: gl.getUniformLocation(solidProgram, 'u_resolution'),
    solidPixelRatioLocation: gl.getUniformLocation(solidProgram, 'u_pixelRatio'),

    vertices: new Float32Array(capacity * VERTICES_PER_PARTICLE * VALUES_PER_VERTEX),
  }
}

export class WebGLHailRenderer implements Canvas2DRenderer {
  readonly backend = 'webgl' as const
  private backgroundLayer: WebGLHailLayer | undefined
  private foregroundLayer: WebGLHailLayer | undefined
  private particles: HailParticle[] = []
  private collisionTargets: readonly CollisionTargetRect[] = []
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
    this.collisionTargets = targets
  }

  render(time: number) {
    if (
      this.contextLost ||
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
    let activeBackgroundHailCount = 0
    let activeForegroundHailCount = 0

    for (let index = 0; index < this.particles.length; index += 1) {
      const particle = this.particles[index]
      const previousX = particle.x
      const previousY = particle.y
      const gravity = 520 * (0.7 + particle.depth * 0.5) * this.options.speed
      const isBackground = index < backgroundCount

      // Handle rolling state
      if (!isBackground && particle.rolling) {
        particle.rollTime = (particle.rollTime ?? 0) + deltaSeconds
        particle.vx *= Math.max(0, 1 - 2.5 * deltaSeconds) // surface friction
        particle.x += particle.vx * deltaSeconds

        if (particle.lastTarget) {
          particle.y = particle.lastTarget.y - particle.radius
          if (particle.x < particle.lastTarget.x || particle.x > particle.lastTarget.right) {
            particle.rolling = false
            particle.vy = 10 + Math.random() * 20
          }
        } else if (particle.y >= this.size.height - particle.radius - 2) {
          // Rolling on container bottom
          particle.y = this.size.height - particle.radius
        } else {
          particle.rolling = false
        }

        if ((particle.rollTime ?? 0) > 0.45 || Math.abs(particle.vx) < 6) {
          particle.rolling = false
          recycleParticle(particle, this.size, this.options, false)
          continue
        }
      } else {
        particle.vy = Math.min(1120, particle.vy + gravity * deltaSeconds)
      }

      const nextX = (!isBackground && particle.rolling) ? particle.x : particle.x + particle.vx * deltaSeconds
      const nextY = (!isBackground && particle.rolling) ? particle.y : particle.y + particle.vy * deltaSeconds
      
      let collision =
        !isBackground && !particle.rolling
          ? findTargetCollision(previousX, previousY, nextX, nextY, this.collisionTargets)
          : undefined

      if (!isBackground && !collision && this.options.bottomCollision && !particle.rolling && nextY >= this.size.height && particle.vy > 0) {
        const t = (this.size.height - previousY) / (nextY - previousY || 1)
        collision = {
          x: previousX + (nextX - previousX) * t,
          y: this.size.height,
          target: null as any,
          type: 'top',
        }
      }

      if (!isBackground && collision) {
        const pileRadius = particle.radius * randomRange(0.42, 0.72)
        this.accumulation.spawn(
          collision.x,
          collision.y,
          pileRadius,
          Math.min(0.74, particle.alpha * 0.78),
          particle.depth,
          collision.target,
        )

        const bounceFactor = randomRange(0.18, 0.3) * (this.options.hailBounce ?? 0.5)
        
        if (collision.type === 'top') {
          if (particle.bounces < 2 && particle.vy > 150 && bounceFactor > 0.05) {
            particle.x = collision.x
            particle.y = collision.y - particle.radius
            particle.vy = -particle.vy * bounceFactor
            particle.vx = particle.vx * 0.4 + randomRange(-40, 40) * particle.depth
            particle.bounces += 1
          } else {
            // Roll instead of disappearing immediately
            if (Math.abs(particle.vx) > 12 && Math.random() > 0.28) {
              particle.rolling = true
              particle.rollTime = 0
              particle.lastTarget = collision.target
              particle.x = collision.x
              particle.y = collision.y - particle.radius
              particle.vy = 0
            } else {
              recycleParticle(particle, this.size, this.options, false)
            }
          }
        } else {
          // Side collision (left or right)
          const sideBounceFactor = bounceFactor * 2.2
          if (particle.bounces < 2 && sideBounceFactor > 0.05) {
            particle.x = collision.type === 'left' ? collision.x - particle.radius : collision.x + particle.radius
            particle.y = collision.y
            particle.vx = -particle.vx * sideBounceFactor
            particle.vy = particle.vy * 0.75
            particle.bounces += 1
          } else {
            recycleParticle(particle, this.size, this.options, false)
          }
        }
        continue
      } else {
        particle.x = nextX
        particle.y = nextY
      }

      if (
        particle.y - particle.radius > this.size.height ||
        particle.x > this.size.width * 1.15 ||
        particle.x < -this.size.width * 0.15
      ) {
        recycleParticle(particle, this.size, this.options, isBackground)
      }

      if (isBackground) {
        if (this.backgroundLayer) {
          this.writeParticle(this.backgroundLayer, activeBackgroundHailCount, particle.x, particle.y, particle.alpha, particle.radius)
          activeBackgroundHailCount += 1
        }
      } else {
        this.writeParticle(this.foregroundLayer, activeForegroundHailCount, particle.x, particle.y, particle.alpha, particle.radius)
        activeForegroundHailCount += 1
      }
    }

    this.accumulation.update(deltaSeconds, this.options, this.collisionTargets, this.size)

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
      const vertexIndex = activeForegroundHailCount + activeAccumulationCount
      
      this.writeParticle(this.foregroundLayer, vertexIndex, pile.x, drawY, pile.alpha, drawRadius)
      activeAccumulationCount += 1
    }

    if (activeBackgroundHailCount > 0 && this.backgroundLayer) {
      const gl = this.backgroundLayer.gl
      gl.viewport(0, 0, this.size.canvasWidth, this.size.canvasHeight)
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)

      gl.bindBuffer(gl.ARRAY_BUFFER, this.backgroundLayer.buffer)
      gl.bufferData(
        gl.ARRAY_BUFFER,
        this.backgroundLayer.vertices.subarray(0, activeBackgroundHailCount * VALUES_PER_VERTEX),
        gl.DYNAMIC_DRAW,
      )

      const [red, green, blue, alpha] = this.parsedColor
      this.setupAttribsAndUniforms(this.backgroundLayer, 'hail', red, green, blue, alpha)
      gl.drawArrays(gl.POINTS, 0, activeBackgroundHailCount)
    } else if (this.backgroundLayer) {
      this.clearLayer(this.backgroundLayer)
    }

    const totalForegroundActiveCount = activeForegroundHailCount + activeAccumulationCount
    if (totalForegroundActiveCount > 0 && this.foregroundLayer) {
      const gl = this.foregroundLayer.gl
      gl.viewport(0, 0, this.size.canvasWidth, this.size.canvasHeight)
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)

      gl.bindBuffer(gl.ARRAY_BUFFER, this.foregroundLayer.buffer)
      gl.bufferData(
        gl.ARRAY_BUFFER,
        this.foregroundLayer.vertices.subarray(0, totalForegroundActiveCount * VALUES_PER_VERTEX),
        gl.DYNAMIC_DRAW,
      )

      const [red, green, blue, alpha] = this.parsedColor

      if (activeForegroundHailCount > 0) {
        this.setupAttribsAndUniforms(this.foregroundLayer, 'hail', red, green, blue, alpha)
        gl.drawArrays(gl.POINTS, 0, activeForegroundHailCount)
      }

      if (activeAccumulationCount > 0) {
        this.setupAttribsAndUniforms(this.foregroundLayer, 'solid', red, green, blue, alpha)
        gl.drawArrays(gl.POINTS, activeForegroundHailCount, activeAccumulationCount)
      }
    } else if (this.foregroundLayer) {
      this.clearLayer(this.foregroundLayer)
    }
  }

  clear() {
    this.accumulation.clear()
    if (this.foregroundLayer) {
      this.clearLayer(this.foregroundLayer)
    }
    if (this.backgroundLayer) {
      this.clearLayer(this.backgroundLayer)
    }
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

  private setupAttribsAndUniforms(
    layer: WebGLHailLayer,
    type: 'hail' | 'solid',
    red: number,
    green: number,
    blue: number,
    alpha: number,
  ) {
    const gl = layer.gl
    const isHail = type === 'hail'

    const program = isHail ? layer.hailProgram : layer.solidProgram
    const positionLocation = isHail ? layer.hailPositionLocation : layer.solidPositionLocation
    const alphaLocation = isHail ? layer.hailAlphaLocation : layer.solidAlphaLocation
    const radiusLocation = isHail ? layer.hailRadiusLocation : layer.solidRadiusLocation
    const colorLocation = isHail ? layer.hailColorLocation : layer.solidColorLocation
    const resolutionLocation = isHail ? layer.hailResolutionLocation : layer.solidResolutionLocation
    const pixelRatioLocation = isHail ? layer.hailPixelRatioLocation : layer.solidPixelRatioLocation

    gl.useProgram(program)

    gl.enableVertexAttribArray(positionLocation)
    gl.vertexAttribPointer(
      positionLocation,
      2,
      gl.FLOAT,
      false,
      VALUES_PER_VERTEX * Float32Array.BYTES_PER_ELEMENT,
      0,
    )
    gl.enableVertexAttribArray(alphaLocation)
    gl.vertexAttribPointer(
      alphaLocation,
      1,
      gl.FLOAT,
      false,
      VALUES_PER_VERTEX * Float32Array.BYTES_PER_ELEMENT,
      2 * Float32Array.BYTES_PER_ELEMENT,
    )
    gl.enableVertexAttribArray(radiusLocation)
    gl.vertexAttribPointer(
      radiusLocation,
      1,
      gl.FLOAT,
      false,
      VALUES_PER_VERTEX * Float32Array.BYTES_PER_ELEMENT,
      3 * Float32Array.BYTES_PER_ELEMENT,
    )

    if (resolutionLocation) {
      gl.uniform2f(resolutionLocation, this.size.width, this.size.height)
    }
    if (pixelRatioLocation) {
      gl.uniform1f(pixelRatioLocation, this.size.pixelRatio)
    }
    if (colorLocation) {
      gl.uniform4f(colorLocation, red, green, blue, alpha)
    }
  }

  private initializeLayers() {
    this.backgroundLayer = createHailLayer(this.canvases.background, Math.max(1, this.particles.length))
    const capacity = Math.max(1, this.particles.length + this.accumulation.getCapacity())
    this.foregroundLayer = createHailLayer(this.canvases.foreground, capacity)
  }

  private syncBudgets(initial: boolean) {
    const particleBudget = calculateHailParticleBudget({
      width: this.size.width,
      height: this.size.height,
      density: this.options.density,
      quality: this.options.quality,
    })
    const accumulationBudget = calculateAccumulationBudget({
      width: this.size.width,
      height: this.size.height,
      density: this.options.density,
      quality: this.options.quality,
    })

    const accumulationCapacityBefore = this.accumulation.getCapacity()
    this.accumulation.syncBudget(accumulationBudget)
    const accumulationCapacityAfter = this.accumulation.getCapacity()

    const capacityNeeded = particleBudget + accumulationCapacityAfter

    if (
      particleBudget !== this.particles.length ||
      accumulationCapacityBefore !== accumulationCapacityAfter
    ) {
      this.particles = []
      this.backgroundLayer = createHailLayer(this.canvases.background, Math.max(1, particleBudget))
      this.foregroundLayer = createHailLayer(this.canvases.foreground, Math.max(1, capacityNeeded))
    }

    while (this.particles.length < particleBudget) {
      const isBackground = this.particles.length < Math.floor(particleBudget * 0.42)
      const particle: HailParticle = {
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        radius: 0,
        alpha: 0,
        depth: 0,
        bounces: 0,
      }

      recycleParticle(particle, this.size, this.options, isBackground, initial)
      this.particles.push(particle)
    }
  }

  private writeParticle(
    layer: WebGLHailLayer,
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

  private clearLayer(layer: WebGLHailLayer | undefined) {
    if (!layer) {
      return
    }

    layer.gl.viewport(0, 0, this.size.canvasWidth, this.size.canvasHeight)
    layer.gl.clearColor(0, 0, 0, 0)
    layer.gl.clear(layer.gl.COLOR_BUFFER_BIT)
  }
}

export function createWebGLHailRenderer(
  canvases: RendererCanvases,
  size: CanvasLayerSize,
  options: NormalizedAtmosphereOptions,
): WebGLHailRenderer | undefined {
  const renderer = new WebGLHailRenderer(canvases, size, options)

  if (!renderer.isReady()) {
    renderer.destroy()
    return undefined
  }

  return renderer
}
