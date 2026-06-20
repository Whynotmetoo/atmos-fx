import type { NormalizedAtmosphereOptions } from '../core/types'
import type { CollisionTargetRect } from './collisionTargets'

type LiquidDrip = {
  elapsed: number
  phaseOffset: number
  waveLeft: number
  waveRight: number
  dripX: number
  targetBottom: number
  liquidDripping: boolean
  scale: number
  collisionY: number
  hasSplashed: boolean
  
  // DOM Elements
  group: SVGGElement
  path: SVGPathElement
  bulge: SVGCircleElement
  droplet: SVGEllipseElement
  clipPath: SVGClipPathElement
  clipRect: SVGRectElement
  filter: SVGFilterElement
  blur: SVGFEGaussianBlurElement
}

export type LiquidDripsController = {
  sync(options: NormalizedAtmosphereOptions, targets: readonly CollisionTargetRect[]): void
  update(deltaTimeSeconds: number): void
  destroy(): void
}

function easeOutQuad(x: number): number {
  return 1 - (1 - x) * (1 - x)
}

function easeInQuad(x: number): number {
  return x * x
}

function easeInOutQuad(x: number): number {
  return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2
}

// Animation cycle and phase boundaries normalized to a 5400ms cycle
const CYCLE_DURATION_MS = 5400
const GATHER_END_T = 1200 / CYCLE_DURATION_MS
const BULGE_END_T = 2800 / CYCLE_DURATION_MS
const STRETCH_END_T = 3600 / CYCLE_DURATION_MS
const PINCH_END_T = 3720 / CYCLE_DURATION_MS
const FALL_END_T = 4800 / CYCLE_DURATION_MS
const SPLASH_END_T = 5080 / CYCLE_DURATION_MS

// Wave settings
const WAVE_GATHER_END_T = BULGE_END_T
const WAVE_RELEASE_T = PINCH_END_T
const WAVE_FORM_DURATION = 800 / CYCLE_DURATION_MS

// Residual bulge settings
const RESIDUAL_BULGE_START_T = 3280 / CYCLE_DURATION_MS
const RESIDUAL_BULGE_DURATION = 240 / CYCLE_DURATION_MS

// Recoil timing
const RECOIL_START_T = PINCH_END_T
const RECOIL_DURATION = 1 - RECOIL_START_T
const RECOIL_ROTATION = Math.PI * 2

// 17-point wave sampling positions normalized between waveLeft (0.0) and waveRight (1.0)
const WAVE_SAMPLE_PROGRESSES = [
  0.0,
  0.07142857, // 40/560
  0.14285714, // 80/560 (leftWaveStartX)
  0.21428571, // 120/560
  0.28571429, // 160/560
  0.35714286, // 200/560
  0.42857143, // 240/560
  0.5,        // 280/560
  0.57142857, // 320/560
  0.625,      // 350/560
  0.6875,     // 385/560 (dripX)
  0.74107143, // 415/560
  0.79464286, // 445/560
  0.83928571, // 470/560 (rightWaveStartX)
  0.89285714, // 500/560
  0.94642857, // 530/560
  1.0
]

function getWaveY(
  x: number,
  t: number,
  baseAmp: number,
  waveLeft: number,
  waveRight: number,
  dripX: number,
  scale: number,
): number {
  if (t >= WAVE_RELEASE_T) return 0

  const leftWaveStartX = waveLeft + (dripX - waveLeft) * 0.208
  const rightWaveStartX = waveRight - (waveRight - dripX) * 0.514

  const gatherProgress = easeInOutQuad(Math.min(1, t / WAVE_GATHER_END_T))
  const leftCenter = leftWaveStartX + (dripX - leftWaveStartX) * gatherProgress
  const rightCenter = rightWaveStartX + (dripX - rightWaveStartX) * gatherProgress

  const basePulseWidth = 85 * scale
  const targetPulseWidth = 45 * scale
  const pulseWidth = basePulseWidth - gatherProgress * (basePulseWidth - targetPulseWidth)

  const formation = easeOutQuad(Math.min(1, t / WAVE_FORM_DURATION))
  const releaseProgress = Math.max(
    0,
    (t - WAVE_GATHER_END_T) / (WAVE_RELEASE_T - WAVE_GATHER_END_T)
  )
  const releaseFade = 1 - easeInQuad(releaseProgress)

  const getPulseHeight = (center: number) => {
    const distance = Math.abs(x - center)
    if (distance >= pulseWidth) return 0
    return (Math.cos((Math.PI * distance) / pulseWidth) + 1) / 2
  }

  const leftHeight = getPulseHeight(leftCenter)
  const rightHeight = getPulseHeight(rightCenter)
  const combinedHeight =
    x < dripX
      ? leftHeight
      : x > dripX
        ? rightHeight
        : Math.max(leftHeight, rightHeight)

  if (baseAmp === 0) return 0
  return (baseAmp + 2.0) * formation * releaseFade * combinedHeight
}

let scratchCanvas: HTMLCanvasElement | null = null
let scratchCtx: CanvasRenderingContext2D | null = null

function parseColorRGB(colorStr: string): { rgb: string; alpha: number } {
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
        scratchCtx.fillStyle = colorStr
        scratchCtx.fillRect(0, 0, 1, 1)
        const data = scratchCtx.getImageData(0, 0, 1, 1).data
        return {
          rgb: `rgb(${data[0]}, ${data[1]}, ${data[2]})`,
          alpha: data[3] / 255,
        }
      }
    } catch (_e) {
      // Fall through to regex parser
    }
  }

  // Fallback for SSR/Node/testing environments without 2D canvas support
  let r = 255
  let g = 255
  let b = 255
  let a = 0.72

  const hex3 = colorStr.match(/^#([0-9a-fA-F]{3})$/)
  if (hex3) {
    r = parseInt(hex3[1][0] + hex3[1][0], 16)
    g = parseInt(hex3[1][1] + hex3[1][1], 16)
    b = parseInt(hex3[1][2] + hex3[1][2], 16)
    a = 1.0
  }

  const hex6 = colorStr.match(/^#([0-9a-fA-F]{6})$/)
  if (hex6) {
    r = parseInt(hex6[1].slice(0, 2), 16)
    g = parseInt(hex6[1].slice(2, 4), 16)
    b = parseInt(hex6[1].slice(4, 6), 16)
    a = 1.0
  }

  const rgba = colorStr.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)/)
  if (rgba) {
    r = parseInt(rgba[1], 10)
    g = parseInt(rgba[2], 10)
    b = parseInt(rgba[3], 10)
    a = rgba[4] !== undefined ? parseFloat(rgba[4]) : 1.0
  }

  return {
    rgb: `rgb(${r}, ${g}, ${b})`,
    alpha: a,
  }
}

export function createLiquidDripsController(
  root: HTMLElement,
  onSplash?: (x: number, y: number, vx: number, scale: number) => void,
): LiquidDripsController {
  const doc = root.ownerDocument
  const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('class', 'atmos-liquid-svg')
  svg.setAttribute('data-atmos-layer', 'liquid')
  svg.style.position = 'absolute'
  svg.style.inset = '0'
  svg.style.width = '100%'
  svg.style.height = '100%'
  svg.style.pointerEvents = 'none'
  svg.style.zIndex = '4'

  const defs = doc.createElementNS('http://www.w3.org/2000/svg', 'defs')
  svg.appendChild(defs)

  const group = doc.createElementNS('http://www.w3.org/2000/svg', 'g')
  svg.appendChild(group)

  root.appendChild(svg)

  const drips: LiquidDrip[] = []
  let options: NormalizedAtmosphereOptions | undefined

  const createDrip = (index: number) => {
    const cardGroup = doc.createElementNS('http://www.w3.org/2000/svg', 'g')

    const filterId = `atmos-liquid-goo-${index}-${Math.random().toString(36).substring(2, 9)}`
    const filter = doc.createElementNS('http://www.w3.org/2000/svg', 'filter')
    filter.setAttribute('id', filterId)

    const blur = doc.createElementNS('http://www.w3.org/2000/svg', 'feGaussianBlur')
    blur.setAttribute('in', 'SourceGraphic')
    blur.setAttribute('stdDeviation', '6')
    blur.setAttribute('result', 'blur')

    const matrix = doc.createElementNS('http://www.w3.org/2000/svg', 'feColorMatrix')
    matrix.setAttribute('in', 'blur')
    matrix.setAttribute('mode', 'matrix')
    matrix.setAttribute('values', '1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 19 -9')
    matrix.setAttribute('result', 'gooey')

    filter.appendChild(blur)
    filter.appendChild(matrix)
    defs.appendChild(filter)

    cardGroup.setAttribute('filter', `url(#${filterId})`)

    const clipId = `atmos-liquid-clip-${index}-${Math.random().toString(36).substring(2, 9)}`
    const clipPath = doc.createElementNS('http://www.w3.org/2000/svg', 'clipPath')
    clipPath.setAttribute('id', clipId)

    const clipRect = doc.createElementNS('http://www.w3.org/2000/svg', 'rect')
    clipRect.setAttribute('x', '-10000')
    clipRect.setAttribute('y', '0')
    clipRect.setAttribute('width', '20000')
    clipRect.setAttribute('height', '20000')

    clipPath.appendChild(clipRect)
    defs.appendChild(clipPath)

    cardGroup.setAttribute('clip-path', `url(#${clipId})`)

    const path = doc.createElementNS('http://www.w3.org/2000/svg', 'path')
    path.setAttribute('class', 'atmos-liquid-element')

    const bulge = doc.createElementNS('http://www.w3.org/2000/svg', 'circle')
    bulge.setAttribute('class', 'atmos-liquid-element')
    bulge.setAttribute('r', '0')

    const droplet = doc.createElementNS('http://www.w3.org/2000/svg', 'ellipse')
    droplet.setAttribute('class', 'atmos-liquid-element')
    droplet.setAttribute('rx', '0')
    droplet.setAttribute('ry', '0')

    cardGroup.appendChild(path)
    cardGroup.appendChild(bulge)
    cardGroup.appendChild(droplet)
    group.appendChild(cardGroup)

    drips.push({
      elapsed: 0,
      phaseOffset: index * 1200, // staggered start
      waveLeft: 0,
      waveRight: 0,
      dripX: 0,
      targetBottom: 0,
      liquidDripping: true,
      scale: 1.0,
      collisionY: 10000,
      hasSplashed: false,
      group: cardGroup,
      path,
      bulge,
      droplet,
      clipPath,
      clipRect,
      filter,
      blur,
    })
  }

  const removeDrip = (index: number) => {
    const drip = drips[index]
    if (drip) {
      drip.group.remove()
      drip.clipPath.remove()
      drip.filter.remove()
      drips.splice(index, 1)
    }
  }

  const clearDrips = () => {
    while (drips.length > 0) {
      removeDrip(drips.length - 1)
    }
  }

  return {
    sync(nextOptions, targets) {
      options = nextOptions
      const isEnabled = options.particle === 'rain' && options.liquidDripping

      if (!isEnabled) {
        svg.style.display = 'none'
        clearDrips()
        return
      }

      svg.style.display = 'block'
      const parsedColor = parseColorRGB(options.color)
      // Make liquid color slightly semi-transparent
      svg.style.opacity = String(parsedColor.alpha * 0.25)

      // Sync count
      while (drips.length < targets.length) {
        createDrip(drips.length)
      }
      while (drips.length > targets.length) {
        removeDrip(drips.length - 1)
      }

      // Sync geometry and color
      for (let i = 0; i < targets.length; i++) {
        const drip = drips[i]
        const target = targets[i]
        const indent = Math.min(20, target.width * 0.15)

        drip.waveLeft = target.x + indent
        drip.waveRight = target.right - indent
        drip.dripX = drip.waveLeft + (drip.waveRight - drip.waveLeft) * 0.6875
        drip.targetBottom = target.bottom
        // Scale factor: narrower card -> smaller waves, bulges, and falling droplet size (clamped to 0.6 to survive gooey blur)
        drip.scale = Math.min(1.0, Math.max(0.6, target.width / 300))

        // Update the blur standard deviation based on scale to preserve gooey shape visibility
        drip.blur.setAttribute('stdDeviation', (6 * drip.scale).toFixed(2))

        // Find the highest collision target directly below this drip point
        let collisionY = 10000
        if (options.bottomCollision) {
          collisionY = root.clientHeight || 10000
        }
        for (let j = 0; j < targets.length; j++) {
          const t = targets[j]
          if (t.element === target.element) {
            continue
          }
          if (t.y >= target.bottom - 2 && drip.dripX >= t.x && drip.dripX <= t.right) {
            if (t.y < collisionY) {
              collisionY = t.y
            }
          }
        }
        drip.collisionY = collisionY

        const cardLiquidDripping = target.element?.dataset.atmosLiquidDripping !== 'false'
        drip.liquidDripping = cardLiquidDripping
        drip.group.style.display = cardLiquidDripping ? 'block' : 'none'

        drip.path.setAttribute('fill', parsedColor.rgb)
        drip.bulge.setAttribute('fill', parsedColor.rgb)
        drip.droplet.setAttribute('fill', parsedColor.rgb)

        // Update the top boundary of the clip path rect to align exactly with target card bottom
        drip.clipRect.setAttribute('y', target.bottom.toFixed(1))
      }
    },

    update(deltaTimeSeconds) {
      if (!options) return
      const isEnabled = options.particle === 'rain' && options.liquidDripping

      if (!isEnabled || drips.length === 0) {
        return
      }

      const speed = options.speed
      const baseCycleDuration = 5400

      for (let i = 0; i < drips.length; i++) {
        const drip = drips[i]

        if (!drip.liquidDripping) {
          drip.path.setAttribute('d', '')
          drip.bulge.setAttribute('r', '0')
          drip.droplet.setAttribute('rx', '0')
          drip.droplet.setAttribute('ry', '0')
          continue
        }
        const leftSpan = drip.dripX - drip.waveLeft
        const rightSpan = drip.waveRight - drip.dripX

        if (leftSpan <= 0 || rightSpan <= 0) {
          drip.path.setAttribute('d', '')
          drip.bulge.setAttribute('r', '0')
          drip.droplet.setAttribute('rx', '0')
          drip.droplet.setAttribute('ry', '0')
          continue
        }

        drip.elapsed += deltaTimeSeconds * 1000 * speed
        const t = ((drip.elapsed + drip.phaseOffset) % baseCycleDuration) / baseCycleDuration

        const BULGE_BASE_Y_OFFSET = -2
        const DROPLET_BASE_Y_OFFSET = -2
        const scale = drip.scale

        let bulgeR = 0
        let bulgeCY = drip.targetBottom + BULGE_BASE_Y_OFFSET

        let dropletRX = 0
        let dropletRY = 0
        let dropletCY = drip.targetBottom + DROPLET_BASE_Y_OFFSET

        let baseAmp = 1.8

        if (t < GATHER_END_T) {
          // Phase 1: Gathering
          bulgeR = 0
          bulgeCY = drip.targetBottom + BULGE_BASE_Y_OFFSET
          dropletRX = 0
          dropletRY = 0
          dropletCY = drip.targetBottom + DROPLET_BASE_Y_OFFSET
          baseAmp = 1.8
          drip.hasSplashed = false
        } else if (t < BULGE_END_T) {
          // Phase 2: Bulging
          const phaseDuration = BULGE_END_T - GATHER_END_T
          const phaseProgress = (t - GATHER_END_T) / phaseDuration
          const easedProgress = easeInOutQuad(phaseProgress)

          bulgeR = easedProgress * 8.0 * scale
          bulgeCY = drip.targetBottom + BULGE_BASE_Y_OFFSET + easedProgress * 4.0 * scale

          dropletRX = 0
          dropletRY = 0
          dropletCY = bulgeCY

          baseAmp = 1.8 + easedProgress * 0.4
        } else if (t < STRETCH_END_T) {
          // Phase 3: Stretching
          const phaseProgress = (t - BULGE_END_T) / (STRETCH_END_T - BULGE_END_T)
          const easedProgress = easeInOutQuad(phaseProgress)

          const residualProgress = Math.min(
            1,
            Math.max(0, (t - RESIDUAL_BULGE_START_T) / RESIDUAL_BULGE_DURATION)
          )
          const residualEase = easeInOutQuad(residualProgress)
          bulgeR = residualEase * 5.0 * scale
          bulgeCY = drip.targetBottom + BULGE_BASE_Y_OFFSET + 4.0 * scale - residualEase * scale

          const stretchDuration = PINCH_END_T - BULGE_END_T
          const p_s = (t - BULGE_END_T) / stretchDuration
          dropletRX = (8.0 - p_s * 3.5) * scale
          dropletRY = (8.0 + p_s * 10.0) * scale
          dropletCY = drip.targetBottom + BULGE_BASE_Y_OFFSET + 4.0 * scale + Math.pow(p_s, 4) * 63.0 * scale

          baseAmp = 2.2 + easedProgress * 1.3
        } else if (t < PINCH_END_T) {
          // Phase 4: Pinch-off
          bulgeR = 5.0 * scale
          bulgeCY = drip.targetBottom + BULGE_BASE_Y_OFFSET + 3.0 * scale

          const stretchDuration = PINCH_END_T - BULGE_END_T
          const p_s = (t - BULGE_END_T) / stretchDuration
          dropletRX = (8.0 - p_s * 3.5) * scale
          dropletRY = (8.0 + p_s * 10.0) * scale
          dropletCY = drip.targetBottom + BULGE_BASE_Y_OFFSET + 4.0 * scale + Math.pow(p_s, 4) * 63.0 * scale

          baseAmp = 3.5
        } else if (t < FALL_END_T) {
          // Phase 5: Falling & Recoil
          const fallDuration = FALL_END_T - PINCH_END_T
          const phaseProgress = (t - PINCH_END_T) / fallDuration

          const fallY =
            drip.targetBottom +
            BULGE_BASE_Y_OFFSET +
            4.0 * scale +
            63.0 * scale +
            295.8 * phaseProgress +
            109.2 * Math.pow(phaseProgress, 2)

          // Check if droplet hits the collision level
          if (fallY >= drip.collisionY) {
            if (!drip.hasSplashed) {
              drip.hasSplashed = true
              onSplash?.(drip.dripX, drip.collisionY, 0, scale)
            }
            dropletRX = 0
            dropletRY = 0
            dropletCY = drip.collisionY
          } else {
            // Keep drawing the smooth, scalable SVG droplet while falling
            dropletRX = 4.5 * scale
            dropletRY = 18.0 * scale
            dropletCY = fallY
          }

          const wobbleProgress = (t - RECOIL_START_T) / RECOIL_DURATION
          const wobbleTime = wobbleProgress * RECOIL_ROTATION
          const decay = Math.max(0, 1 - wobbleProgress)
          const wobbleOffset = Math.cos(wobbleTime) * 3.0 * decay * scale

          bulgeR = Math.max(0, 5.0 * decay * scale)
          bulgeCY = drip.targetBottom + BULGE_BASE_Y_OFFSET + wobbleOffset

          baseAmp = 0
        } else if (t < SPLASH_END_T) {
          // Phase 6: Splash & Dissolve
          dropletRX = 0
          dropletRY = 0
          dropletCY = drip.collisionY

          // In case it fell very fast and didn't trigger splash in Phase 5
          if (!drip.hasSplashed) {
            drip.hasSplashed = true
            const maxFallY =
              drip.targetBottom +
              BULGE_BASE_Y_OFFSET +
              4.0 * scale +
              63.0 * scale +
              295.8 +
              109.2
            if (drip.collisionY <= maxFallY) {
              onSplash?.(drip.dripX, drip.collisionY, 0, scale)
            }
          }

          const wobbleProgress = (t - RECOIL_START_T) / RECOIL_DURATION
          const wobbleTime = wobbleProgress * RECOIL_ROTATION
          const decay = Math.max(0, 1 - wobbleProgress)
          const wobbleOffset = Math.cos(wobbleTime) * 3.0 * decay * scale

          bulgeR = Math.max(0, 5.0 * decay * scale)
          bulgeCY = drip.targetBottom + BULGE_BASE_Y_OFFSET + wobbleOffset

          baseAmp = 0
        } else {
          // Phase 7: Cool down
          const wobbleProgress = (t - RECOIL_START_T) / RECOIL_DURATION
          const wobbleTime = wobbleProgress * RECOIL_ROTATION
          const decay = Math.max(0, 1 - wobbleProgress)
          const wobbleOffset = Math.cos(wobbleTime) * 3.0 * decay * scale

          bulgeR = Math.max(0, 5.0 * decay * scale)
          bulgeCY = drip.targetBottom + BULGE_BASE_Y_OFFSET + wobbleOffset

          dropletRX = 0
          dropletRY = 0
          dropletCY = drip.targetBottom + DROPLET_BASE_Y_OFFSET
          baseAmp = 0
        }

        // Wave control points heights and 17-point spline path generation
        const scaledAmp = baseAmp * scale
        const waveSpan = drip.waveRight - drip.waveLeft
        const points = WAVE_SAMPLE_PROGRESSES.map((prog, idx) => {
          const xVal = drip.waveLeft + prog * waveSpan
          const yVal =
            idx === 0 || idx === WAVE_SAMPLE_PROGRESSES.length - 1
              ? drip.targetBottom - 1.0
              : drip.targetBottom - 1.0 +
                getWaveY(
                  xVal,
                  t,
                  scaledAmp,
                  drip.waveLeft,
                  drip.waveRight,
                  drip.dripX,
                  scale,
                )
          return { x: xVal, y: yVal }
        })

        const wl = drip.waveLeft.toFixed(1)
        const wr = drip.waveRight.toFixed(1)
        const ybTop = (drip.targetBottom - 20).toFixed(1)
        const dxVal = drip.dripX.toFixed(1)

        let pathD = `M ${wl},${ybTop} L ${points[0].x.toFixed(1)},${points[0].y.toFixed(1)} `

        for (let idx = 0; idx < points.length - 1; idx++) {
          const p0 = points[Math.max(0, idx - 1)]
          const p1 = points[idx]
          const p2 = points[idx + 1]
          const p3 = points[Math.min(points.length - 1, idx + 2)]
          const cp1x = p1.x + (p2.x - p0.x) / 6
          const cp1y = p1.y + (p2.y - p0.y) / 6
          const cp2x = p2.x - (p3.x - p1.x) / 6
          const cp2y = p2.y - (p3.y - p1.y) / 6

          pathD +=
            `C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ` +
            `${cp2x.toFixed(1)},${cp2y.toFixed(1)} ` +
            `${p2.x.toFixed(1)},${p2.y.toFixed(1)} `
        }

        pathD += `L ${wr},${ybTop} Z`

        drip.path.setAttribute('d', pathD)
        drip.bulge.setAttribute('cy', bulgeCY.toFixed(1))
        drip.bulge.setAttribute('r', bulgeR.toFixed(1))
        drip.bulge.setAttribute('cx', dxVal)
        drip.droplet.setAttribute('cx', dxVal)
        drip.droplet.setAttribute('cy', dropletCY.toFixed(1))
        drip.droplet.setAttribute('rx', dropletRX.toFixed(1))
        drip.droplet.setAttribute('ry', dropletRY.toFixed(1))
      }
    },

    destroy() {
      clearDrips()
      svg.remove()
    },
  }
}
