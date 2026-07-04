import type { NormalizedAtmosphereOptions } from '../core/types'
import type { CollisionTargetRect } from './collisionTargets'
import { extractAtmosphereColors } from './colorExtractor'
import { COLOR_BASE64, ALPHA_BASE64 } from './assets'

function loadImageFromBase64(base64: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = (e) => reject(e)
    img.src = `data:image/png;base64,${base64}`
  })
}

class DropletTemplates {
  static colorImg: HTMLImageElement | null = null
  static alphaImg: HTMLImageElement | null = null
  static templates: HTMLCanvasElement[] = []
  static clearBrush: HTMLCanvasElement | null = null
  static isLoaded = false
  static loadingPromise: Promise<void> | null = null

  static load(): Promise<void> {
    if (this.loadingPromise) return this.loadingPromise

    this.loadingPromise = Promise.all([
      loadImageFromBase64(COLOR_BASE64),
      loadImageFromBase64(ALPHA_BASE64)
    ]).then(([color, alpha]) => {
      this.colorImg = color
      this.alphaImg = alpha
      this.renderTemplates()
      this.isLoaded = true
    }).catch(err => {
      console.error('Failed to load droplet assets:', err)
    })

    return this.loadingPromise
  }

  private static renderTemplates() {
    const dropSize = 64
    const buffer = document.createElement('canvas')
    buffer.width = dropSize
    buffer.height = dropSize
    const bufferCtx = buffer.getContext('2d')!

    this.templates = Array.from({ length: 255 }).map((_, i) => {
      const drop = document.createElement('canvas')
      drop.width = dropSize
      drop.height = dropSize
      const ctx = drop.getContext('2d')!

      bufferCtx.clearRect(0, 0, dropSize, dropSize)

      bufferCtx.globalCompositeOperation = 'source-over'
      bufferCtx.drawImage(this.colorImg!, 0, 0, dropSize, dropSize)

      bufferCtx.globalCompositeOperation = 'screen'
      bufferCtx.fillStyle = `rgba(0, 0, ${i}, 1)`
      bufferCtx.fillRect(0, 0, dropSize, dropSize)

      ctx.globalCompositeOperation = 'source-over'
      ctx.drawImage(this.alphaImg!, 0, 0, dropSize, dropSize)

      ctx.globalCompositeOperation = 'source-in'
      ctx.drawImage(buffer, 0, 0, dropSize, dropSize)

      return drop
    })

    this.clearBrush = document.createElement('canvas')
    this.clearBrush.width = 64
    this.clearBrush.height = 64
    const clearCtx = this.clearBrush.getContext('2d')!
    clearCtx.fillStyle = '#000000'
    clearCtx.beginPath()
    clearCtx.arc(32, 32, 32, 0, Math.PI * 2)
    clearCtx.fill()
  }
}

interface Droplet {
  x: number
  y: number
  rx: number
  ry: number
  baseRx: number
  baseRy: number
  vx: number
  vy: number
  type: 'sliding' | 'static'
  alpha: number
  trailTimer: number
  isKilled?: boolean
  spreadX?: number
  spreadY?: number
}

class CardDropletState {
  card: HTMLElement
  width = 0
  height = 0
  dpr = 1
  canvasDroplets: HTMLCanvasElement
  canvasLiquid: HTMLCanvasElement
  droplets: Droplet[] = []
  dropletCounter = 0
  slideSpawnCounter = 0

  constructor(card: HTMLElement) {
    this.card = card
    this.canvasDroplets = document.createElement('canvas')
    this.canvasLiquid = document.createElement('canvas')
  }

  resize(w: number, h: number, dpr: number) {
    this.width = w
    this.height = h
    this.dpr = dpr

    const dw = Math.ceil(w * dpr)
    const dh = Math.ceil(h * dpr)

    if (this.canvasDroplets.width !== dw || this.canvasDroplets.height !== dh) {
      const temp = document.createElement('canvas')
      temp.width = this.canvasDroplets.width
      temp.height = this.canvasDroplets.height
      const tempCtx = temp.getContext('2d')
      if (tempCtx && this.canvasDroplets.width > 0) {
        tempCtx.drawImage(this.canvasDroplets, 0, 0)
      }

      this.canvasDroplets.width = dw
      this.canvasDroplets.height = dh
      this.canvasLiquid.width = dw
      this.canvasLiquid.height = dh

      const ctxDroplets = this.canvasDroplets.getContext('2d')
      if (ctxDroplets && temp.width > 0) {
        ctxDroplets.drawImage(temp, 0, 0, dw, dh)
      }
    }
  }

  update(dt: number, options: NormalizedAtmosphereOptions) {
    const minR = 6
    const maxR = 16
    const density = options.density
    const speed = options.speed
    const ctxDroplets = this.canvasDroplets.getContext('2d')

    // 1. Spawn small static background droplets
    if (density > 0) {
      const area = (this.width * this.height) / 100000
      this.dropletCounter += density * 12 * dt * area * speed
      while (this.dropletCounter >= 1) {
        this.dropletCounter--
        const rx = Math.random() * this.width
        const ry = Math.random() * this.height
        const rr = 2 + Math.random() * 3
        if (ctxDroplets) {
          this.drawDropletToCanvas(ctxDroplets, {
            x: rx,
            y: ry,
            rx: rr,
            ry: rr,
            baseRx: rr,
            baseRy: rr,
            vy: 0,
            vx: 0,
            type: 'static',
            alpha: 1.0,
            trailTimer: 0
          }, minR, maxR)
        }
      }
    }

    // 2. Spawn sliding droplets
    if (density > 0) {
      this.slideSpawnCounter += density * 1.8 * dt * speed
      while (this.slideSpawnCounter >= 1) {
        this.slideSpawnCounter--
        const rr = 8 + Math.random() * 8
        this.droplets.push({
          x: Math.random() * this.width,
          y: -20,
          rx: rr,
          ry: rr,
          baseRx: rr,
          baseRy: rr,
          vy: 60 + Math.random() * 60,
          vx: 0,
          type: 'sliding',
          alpha: 1.0,
          trailTimer: 0,
          spreadX: 1.5,
          spreadY: 1.5
        })
      }
    }

    // 3. Update physics
    for (let i = this.droplets.length - 1; i >= 0; i--) {
      const d = this.droplets[i]
      if (d.isKilled) continue

      d.spreadX = Math.max(0, (d.spreadX || 0) - dt * 4)
      d.spreadY = Math.max(0, (d.spreadY || 0) - dt * 2)

      if (d.type === 'sliding') {
        d.y += d.vy * dt * speed
        d.x += d.vx * dt * speed

        d.vx += (Math.random() - 0.5) * 80 * dt
        d.vx = Math.max(-25, Math.min(25, d.vx))

        // Clear trail
        if (ctxDroplets && DropletTemplates.clearBrush) {
          ctxDroplets.globalCompositeOperation = 'destination-out'
          const clearR = d.rx * 1.1
          ctxDroplets.drawImage(
            DropletTemplates.clearBrush,
            (d.x - clearR) * this.dpr,
            (d.y - clearR * 1.5) * this.dpr,
            clearR * 2 * this.dpr,
            clearR * 3 * this.dpr
          )
        }

        // Drop trail droplets
        d.trailTimer += dt * speed
        if (d.trailTimer > 0.05) {
          d.trailTimer = 0
          const rx_trail = d.rx * (0.22 + Math.random() * 0.15)
          if (ctxDroplets) {
            this.drawDropletToCanvas(ctxDroplets, {
              x: d.x + (Math.random() - 0.5) * d.rx * 0.3,
              y: d.y - d.rx * 0.8,
              rx: rx_trail,
              ry: rx_trail,
              baseRx: rx_trail,
              baseRy: rx_trail,
              vy: 0,
              vx: 0,
              type: 'static',
              alpha: 1.0,
              trailTimer: 0
            }, minR, maxR)
          }
        }
      }

      // Merge check
      for (let j = i - 1; j >= 0; j--) {
        const other = this.droplets[j]
        if (other.isKilled) continue

        const dx = d.x - other.x
        const dy = d.y - other.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        const threshold = (d.rx + other.rx) * 0.82

        if (dist < threshold) {
          const combinedArea = d.rx * d.rx + other.rx * other.rx
          const newRx = Math.min(maxR * 1.2, Math.sqrt(combinedArea))

          if (d.type === 'sliding' && other.type === 'sliding') {
            other.rx = newRx
            other.ry = newRx
            other.y = Math.max(d.y, other.y)
            other.vy = Math.max(d.vy, other.vy) * 1.15
            other.spreadX = 1.6
            other.spreadY = 1.6
            d.isKilled = true
            break
          } else if (d.type === 'sliding') {
            d.rx = newRx
            d.ry = newRx
            d.vy *= 1.08
            d.spreadX = 1.3
            d.spreadY = 1.3
            other.isKilled = true
          } else if (other.type === 'sliding') {
            other.rx = newRx
            other.ry = newRx
            other.vy *= 1.08
            other.spreadX = 1.3
            other.spreadY = 1.3
            d.isKilled = true
            break
          }
        }
      }
    }

    // Clean up killed and out-of-bounds droplets
    this.droplets = this.droplets.filter(
      d => !d.isKilled && (this.height <= 0 || d.y <= this.height + d.ry * 2)
    )

    // 4. Draw to composite canvas
    const ctxLiquid = this.canvasLiquid.getContext('2d')
    if (ctxLiquid) {
      ctxLiquid.clearRect(0, 0, this.canvasLiquid.width, this.canvasLiquid.height)

      if (DropletTemplates.isLoaded) {
        ctxLiquid.globalCompositeOperation = 'source-over'
        ctxLiquid.drawImage(this.canvasDroplets, 0, 0)

        this.droplets.forEach(d => {
          this.drawDropletToCanvas(ctxLiquid, d, minR, maxR)
        })
      }
    }
  }

  private drawDropletToCanvas(ctx: CanvasRenderingContext2D, d: Droplet, minR: number, maxR: number) {
    if (!DropletTemplates.isLoaded || DropletTemplates.templates.length === 0) return

    const normalizedR = Math.max(0, Math.min(1, (d.rx - minR) / (maxR - minR)))
    const idx = Math.floor(normalizedR * 254)
    const template = DropletTemplates.templates[idx]

    const scaleX = 1.0
    const scaleY = 1.5
    const spX = d.spreadX !== undefined ? d.spreadX : 0
    const spY = d.spreadY !== undefined ? d.spreadY : 0

    ctx.globalAlpha = d.alpha
    ctx.globalCompositeOperation = 'source-over'
    ctx.drawImage(
      template,
      (d.x - d.rx * scaleX * (spX + 1)) * this.dpr,
      (d.y - d.ry * scaleY * (spY + 1)) * this.dpr,
      (d.rx * 2 * scaleX * (spX + 1)) * this.dpr,
      (d.ry * 2 * scaleY * (spY + 1)) * this.dpr
    )
  }
}

export class SurfaceDropletsController {
  private root: HTMLElement
  private webglCanvas: HTMLCanvasElement
  private gl: WebGLRenderingContext
  private program: WebGLProgram | null = null
  private vertexShader: WebGLShader | null = null
  private fragmentShader: WebGLShader | null = null
  private buffer: WebGLBuffer | null = null
  private texture: WebGLTexture | null = null

  private canvasLiquidRoot: HTMLCanvasElement
  private activeCards = new Map<HTMLElement, CardDropletState>()
  private targets: readonly CollisionTargetRect[] = []

  // WebGL Shader locations
  private aPositionLoc = -1
  private uResolutionLoc: WebGLUniformLocation | null = null
  private uCardBoundsLoc: WebGLUniformLocation | null = null
  private uBorderRadiusLoc: WebGLUniformLocation | null = null
  private uBgStartLoc: WebGLUniformLocation | null = null
  private uBgEndLoc: WebGLUniformLocation | null = null
  private uRefractionLoc: WebGLUniformLocation | null = null
  private uShineLoc: WebGLUniformLocation | null = null
  private uShadowLoc: WebGLUniformLocation | null = null
  private uAlphaMulLoc: WebGLUniformLocation | null = null
  private uAlphaSubLoc: WebGLUniformLocation | null = null

  constructor(root: HTMLElement) {
    this.root = root
    this.webglCanvas = document.createElement('canvas')
    this.gl = this.webglCanvas.getContext('webgl', { alpha: true, depth: false, antialias: true })!
    this.canvasLiquidRoot = document.createElement('canvas')

    DropletTemplates.load().then(() => {
      this.initWebGL()
    })
  }

  private initWebGL() {
    const gl = this.gl

    const vsSource = `
      attribute vec2 a_position;
      varying vec2 v_rootPos;
      varying vec2 v_texCoord;
      uniform vec2 u_resolution;
      void main() {
        vec2 clipSpace = (a_position / u_resolution) * 2.0 - 1.0;
        gl_Position = vec4(clipSpace.x, -clipSpace.y, 0.0, 1.0);
        v_rootPos = a_position;
        v_texCoord = a_position / u_resolution;
      }
    `

    const fsSource = `
      precision mediump float;
      varying vec2 v_rootPos;
      varying vec2 v_texCoord;

      uniform sampler2D u_waterMap;
      uniform vec2 u_resolution;
      uniform vec4 u_cardBounds;
      uniform float u_borderRadius;

      uniform vec4 u_bgStart;
      uniform vec4 u_bgEnd;
      uniform float u_refractionStrength;
      uniform float u_shineStrength;
      uniform float u_shadowStrength;

      uniform float u_alphaMultiply;
      uniform float u_alphaSubtract;

      float sdRoundedRect(vec2 p, vec2 size, float r) {
        vec2 d = abs(p) - (size - vec2(r));
        return min(max(d.x, d.y), 0.0) + length(max(d, 0.0)) - r;
      }

      vec4 blend(vec4 bg, vec4 fg) {
        vec3 bgm = bg.rgb * bg.a;
        vec3 fgm = fg.rgb * fg.a;
        float ia = 1.0 - fg.a;
        float a = fg.a + bg.a * ia;
        vec3 rgb = a != 0.0 ? (fgm + bgm * ia) / a : vec3(0.0);
        return vec4(rgb, a);
      }

      void main() {
        vec2 cardCenter = u_cardBounds.xy + u_cardBounds.zw * 0.5;
        vec2 p = v_rootPos - cardCenter;
        float d = sdRoundedRect(p, u_cardBounds.zw * 0.5, u_borderRadius);
        if (d > 0.0) discard;

        vec4 cur = texture2D(u_waterMap, v_texCoord);
        float a = clamp(cur.a * u_alphaMultiply - u_alphaSubtract, 0.0, 1.0);

        float depth = cur.b;
        float nx = cur.g;
        float ny = cur.r;
        vec2 refraction = (vec2(nx, ny) - 0.5) * 2.0;

        vec2 offset = refraction * (128.0 + depth * 256.0) / u_resolution;

        float cardY = (v_rootPos.y - u_cardBounds.y) / u_cardBounds.w;
        float refractedCardY = clamp(cardY + offset.y * u_refractionStrength, 0.0, 1.0);
        vec3 refractedColor = mix(u_bgEnd.rgb, u_bgStart.rgb, refractedCardY);

        vec3 lightDir = normalize(vec3(-0.25, -0.75, 1.0));
        vec3 viewDir = vec3(0.0, 0.0, 1.0);
        vec3 halfDir = normalize(lightDir + viewDir);

        float nz = sqrt(max(0.0, 1.0 - dot(refraction, refraction)));
        vec3 normal3d = normalize(vec3(refraction.x, refraction.y, nz * 1.5));
        float spec = pow(max(dot(normal3d, halfDir), 0.0), 28.0) * u_shineStrength;

        float fresnel = pow(1.0 - max(dot(normal3d, viewDir), 0.0), 3.0) * 0.35;

        vec3 ambientTint = vec3(0.03, 0.06, 0.09);
        vec3 finalRGB = refractedColor + ambientTint + vec3(spec + fresnel);

        float innerShadow = clamp(dot(normal3d.xy, -lightDir.xy), 0.0, 1.0) * 0.22 * u_shadowStrength;
        finalRGB = max(vec3(0.0), finalRGB - innerShadow);

        vec4 fgColor = vec4(finalRGB, a);

        float shadowOffset = 0.008;
        vec4 curShadow = texture2D(u_waterMap, v_texCoord - vec2(0.0, shadowOffset));
        float shadowA = clamp(curShadow.a * u_alphaMultiply - (u_alphaSubtract + 0.3), 0.0, 1.0);
        if (shadowA > 0.0) {
          float shadowIntensity = shadowA * 0.35 * u_shadowStrength;
          vec4 shadowColor = vec4(0.0, 0.0, 0.0, shadowIntensity);
          fgColor = blend(shadowColor, fgColor);
        }

        if (fgColor.a <= 0.0) {
          discard;
        }

        gl_FragColor = fgColor;
      }
    `

    this.vertexShader = gl.createShader(gl.VERTEX_SHADER)!
    gl.shaderSource(this.vertexShader, vsSource)
    gl.compileShader(this.vertexShader)

    this.fragmentShader = gl.createShader(gl.FRAGMENT_SHADER)!
    gl.shaderSource(this.fragmentShader, fsSource)
    gl.compileShader(this.fragmentShader)

    this.program = gl.createProgram()!
    gl.attachShader(this.program, this.vertexShader)
    gl.attachShader(this.program, this.fragmentShader)
    gl.linkProgram(this.program)

    this.aPositionLoc = gl.getAttribLocation(this.program, 'a_position')
    this.uResolutionLoc = gl.getUniformLocation(this.program, 'u_resolution')
    this.uCardBoundsLoc = gl.getUniformLocation(this.program, 'u_cardBounds')
    this.uBorderRadiusLoc = gl.getUniformLocation(this.program, 'u_borderRadius')
    this.uBgStartLoc = gl.getUniformLocation(this.program, 'u_bgStart')
    this.uBgEndLoc = gl.getUniformLocation(this.program, 'u_bgEnd')
    this.uRefractionLoc = gl.getUniformLocation(this.program, 'u_refractionStrength')
    this.uShineLoc = gl.getUniformLocation(this.program, 'u_shineStrength')
    this.uShadowLoc = gl.getUniformLocation(this.program, 'u_shadowStrength')
    this.uAlphaMulLoc = gl.getUniformLocation(this.program, 'u_alphaMultiply')
    this.uAlphaSubLoc = gl.getUniformLocation(this.program, 'u_alphaSubtract')

    this.buffer = gl.createBuffer()

    this.texture = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, this.texture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  }

  sync(options: NormalizedAtmosphereOptions, targets: readonly CollisionTargetRect[]) {
    this.targets = targets

    const rect = this.root.getBoundingClientRect()
    const dpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1
    const w = Math.max(0, rect.width || this.root.clientWidth)
    const h = Math.max(0, rect.height || this.root.clientHeight)

    const dw = Math.ceil(w * dpr)
    const dh = Math.ceil(h * dpr)

    if (this.canvasLiquidRoot.width !== dw || this.canvasLiquidRoot.height !== dh) {
      this.canvasLiquidRoot.width = dw
      this.canvasLiquidRoot.height = dh
      this.webglCanvas.width = dw
      this.webglCanvas.height = dh
      if (this.gl) {
        this.gl.viewport(0, 0, dw, dh)
      }
    }

    const currentActive = new Set<HTMLElement>()

    if (options.surfaceDroplets) {
      targets.forEach(t => {
        const card = t.element
        if (!card) return

        const isEnabled = card.getAttribute('data-atmos-surface-droplets') !== 'false'
        if (!isEnabled) return

        currentActive.add(card)

        let canvas = card.querySelector('canvas[data-atmos-layer="surface-droplets"]') as HTMLCanvasElement | null
        if (!canvas) {
          canvas = document.createElement('canvas')
          canvas.dataset.atmosLayer = 'surface-droplets'
          canvas.style.position = 'absolute'
          canvas.style.inset = '0'
          canvas.style.width = '100%'
          canvas.style.height = '100%'
          canvas.style.pointerEvents = 'none'
          canvas.style.zIndex = '2'
          card.appendChild(canvas)
        }

        const cw = Math.ceil(t.width * dpr)
        const ch = Math.ceil(t.height * dpr)
        if (canvas.width !== cw || canvas.height !== ch) {
          canvas.width = cw
          canvas.height = ch
        }

        if (!this.activeCards.has(card)) {
          this.activeCards.set(card, new CardDropletState(card))
        }
      })
    }

    for (const card of this.activeCards.keys()) {
      if (!currentActive.has(card)) {
        const canvas = card.querySelector('canvas[data-atmos-layer="surface-droplets"]')
        if (canvas) {
          canvas.remove()
        }
        this.activeCards.delete(card)
      }
    }
  }

  update(dt: number, options: NormalizedAtmosphereOptions) {
    const dpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1
    const rootRect = this.root.getBoundingClientRect()
    const rootW = Math.max(0, rootRect.width || this.root.clientWidth)
    const rootH = Math.max(0, rootRect.height || this.root.clientHeight)

    // 1. Run CPU physics
    const activeStates: { state: CardDropletState; rect: CollisionTargetRect }[] = []
    this.targets.forEach(t => {
      const card = t.element
      if (!card) return
      const state = this.activeCards.get(card)
      if (!state) return

      state.resize(t.width, t.height, dpr)
      state.update(dt, options)
      activeStates.push({ state, rect: t })
    })

    if (!this.gl || !this.program || !DropletTemplates.isLoaded) return

    // 2. Clear and composite root normal map
    const ctxRoot = this.canvasLiquidRoot.getContext('2d')!
    ctxRoot.clearRect(0, 0, this.canvasLiquidRoot.width, this.canvasLiquidRoot.height)

    activeStates.forEach(({ state, rect }) => {
      ctxRoot.drawImage(
        state.canvasLiquid,
        rect.x * dpr,
        rect.y * dpr
      )
    })

    // 3. Render offscreen WebGL
    const gl = this.gl
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)

    gl.bindTexture(gl.TEXTURE_2D, this.texture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.canvasLiquidRoot)

    gl.useProgram(this.program)
    gl.uniform2f(this.uResolutionLoc, rootW, rootH)

    gl.uniform1f(this.uAlphaMulLoc, 6.0)
    gl.uniform1f(this.uAlphaSubLoc, 3.2)

    gl.uniform1f(this.uRefractionLoc, 1.25)
    gl.uniform1f(this.uShineLoc, 0.9)
    gl.uniform1f(this.uShadowLoc, 1.0)

    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer)
    gl.enableVertexAttribArray(this.aPositionLoc)
    gl.vertexAttribPointer(this.aPositionLoc, 2, gl.FLOAT, false, 0, 0)

    activeStates.forEach(({ state, rect }) => {
      const colors = extractAtmosphereColors(state.card, options.bgStart, options.bgEnd)
      const cStart = colors.bgStart
      const cEnd = colors.bgEnd

      gl.uniform4f(this.uBgStartLoc, cStart.r, cStart.g, cStart.b, cStart.a)
      gl.uniform4f(this.uBgEndLoc, cEnd.r, cEnd.g, cEnd.b, cEnd.a)

      const cardStyle = window.getComputedStyle(state.card)
      const borderRad = parseFloat(cardStyle.borderRadius) || 0.0
      gl.uniform1f(this.uBorderRadiusLoc, borderRad)

      gl.uniform4f(this.uCardBoundsLoc, rect.x, rect.y, rect.width, rect.height)

      const vertices = new Float32Array([
        rect.x, rect.y,
        rect.x + rect.width, rect.y,
        rect.x, rect.y + rect.height,
        rect.x, rect.y + rect.height,
        rect.x + rect.width, rect.y,
        rect.x + rect.width, rect.y + rect.height
      ])
      gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.DYNAMIC_DRAW)
      gl.drawArrays(gl.TRIANGLES, 0, 6)
    })

    // 4. Blit to card compositor canvases
    activeStates.forEach(({ state, rect }) => {
      const cardCanvas = state.card.querySelector('canvas[data-atmos-layer="surface-droplets"]') as HTMLCanvasElement
      if (!cardCanvas) return

      const cardCtx = cardCanvas.getContext('2d')!
      cardCtx.clearRect(0, 0, cardCanvas.width, cardCanvas.height)
      cardCtx.drawImage(
        this.webglCanvas,
        rect.x * dpr,
        rect.y * dpr,
        rect.width * dpr,
        rect.height * dpr,
        0,
        0,
        cardCanvas.width,
        cardCanvas.height
      )
    })
  }

  destroy() {
    const gl = this.gl
    for (const card of this.activeCards.keys()) {
      const canvas = card.querySelector('canvas[data-atmos-layer="surface-droplets"]')
      if (canvas) {
        canvas.remove()
      }
    }
    this.activeCards.clear()
    if (!gl) return

    if (this.buffer) gl.deleteBuffer(this.buffer)
    if (this.texture) gl.deleteTexture(this.texture)
    if (this.program) gl.deleteProgram(this.program)
    if (this.vertexShader) gl.deleteShader(this.vertexShader)
    if (this.fragmentShader) gl.deleteShader(this.fragmentShader)
  }
}
