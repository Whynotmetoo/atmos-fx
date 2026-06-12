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
  
  // DOM Elements
  group: SVGGElement
  path: SVGPathElement
  bulge: SVGCircleElement
  droplet: SVGEllipseElement
  clipPath: SVGClipPathElement
  clipRect: SVGRectElement
}

export type LiquidDripsController = {
  sync(options: NormalizedAtmosphereOptions, targets: readonly CollisionTargetRect[]): void
  update(deltaTimeSeconds: number): void
  destroy(): void
}

function easeInOutQuad(x: number): number {
  return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2
}

function getWaveY(
  x: number,
  t: number,
  baseAmp: number,
  waveLeft: number,
  waveRight: number,
  dripX: number,
): number {
  const wavelength = 140
  const k = (2 * Math.PI) / wavelength
  const N_waves = 3
  const wavePhase = t * 2 * Math.PI * N_waves

  if (x < dripX) {
    const phase = k * (x - waveLeft) - wavePhase
    const span = dripX - waveLeft
    const envelope = span > 0 ? Math.sin((Math.PI * (x - waveLeft)) / span) : 0
    return baseAmp * Math.sin(phase) * envelope
  } else {
    const phase = k * (waveRight - x) - wavePhase
    const span = waveRight - dripX
    const envelope = span > 0 ? Math.sin((Math.PI * (waveRight - x)) / span) : 0
    return baseAmp * Math.sin(phase) * envelope
  }
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

export function createLiquidDripsController(root: HTMLElement): LiquidDripsController {
  const doc = root.ownerDocument
  const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('class', 'atoms-liquid-svg')
  svg.setAttribute('data-atoms-layer', 'liquid')
  svg.style.position = 'absolute'
  svg.style.inset = '0'
  svg.style.width = '100%'
  svg.style.height = '100%'
  svg.style.pointerEvents = 'none'
  svg.style.zIndex = '1'

  const defs = doc.createElementNS('http://www.w3.org/2000/svg', 'defs')
  const filterId = `atoms-liquid-goo-${Math.random().toString(36).substring(2, 9)}`
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
  svg.appendChild(defs)

  const group = doc.createElementNS('http://www.w3.org/2000/svg', 'g')
  svg.appendChild(group)

  root.appendChild(svg)

  const drips: LiquidDrip[] = []
  let options: NormalizedAtmosphereOptions | undefined

  const createDrip = (index: number) => {
    const cardGroup = doc.createElementNS('http://www.w3.org/2000/svg', 'g')
    cardGroup.setAttribute('filter', `url(#${filterId})`)

    const clipId = `atoms-liquid-clip-${index}-${Math.random().toString(36).substring(2, 9)}`
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
    path.setAttribute('class', 'atoms-liquid-element')

    const bulge = doc.createElementNS('http://www.w3.org/2000/svg', 'circle')
    bulge.setAttribute('class', 'atoms-liquid-element')
    bulge.setAttribute('r', '0')

    const droplet = doc.createElementNS('http://www.w3.org/2000/svg', 'ellipse')
    droplet.setAttribute('class', 'atoms-liquid-element')
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
      group: cardGroup,
      path,
      bulge,
      droplet,
      clipPath,
      clipRect,
    })
  }

  const removeDrip = (index: number) => {
    const drip = drips[index]
    if (drip) {
      drip.group.remove()
      drip.clipPath.remove()
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
      svg.style.opacity = String(parsedColor.alpha)

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
        drip.dripX = drip.waveLeft + (drip.waveRight - drip.waveLeft) * 0.65
        drip.targetBottom = target.bottom

        const cardLiquidDripping = target.element?.dataset.atomsLiquidDripping !== 'false'
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
      const baseCycleDuration = 4000

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

        let bulgeR = 0
        let bulgeCY = drip.targetBottom + BULGE_BASE_Y_OFFSET

        let dropletRX = 0
        let dropletRY = 0
        let dropletCY = drip.targetBottom + DROPLET_BASE_Y_OFFSET

        let baseAmp = 0.6

        if (t < 0.15) {
          // Phase 1: Resting
          bulgeR = 0
          bulgeCY = drip.targetBottom + BULGE_BASE_Y_OFFSET
          dropletRX = 0
          dropletRY = 0
          dropletCY = drip.targetBottom + DROPLET_BASE_Y_OFFSET
          baseAmp = 0.6
        } else if (t < 0.35) {
          // Phase 2: Bulging
          const phaseProgress = (t - 0.15) / 0.2
          const easedProgress = easeInOutQuad(phaseProgress)

          bulgeR = easedProgress * 8.0
          bulgeCY = drip.targetBottom + BULGE_BASE_Y_OFFSET + easedProgress * 4.0

          dropletRX = 0
          dropletRY = 0
          dropletCY = bulgeCY

          baseAmp = 0.6 + easedProgress * 1.6
        } else if (t < 0.55) {
          // Phase 3: Stretching
          const phaseProgress = (t - 0.35) / 0.2
          const easedProgress = easeInOutQuad(phaseProgress)

          bulgeCY = drip.targetBottom + BULGE_BASE_Y_OFFSET + 4.0
          bulgeR = 0

          const p_s = (t - 0.35) / 0.23
          dropletRX = 8.0 - p_s * 3.5
          dropletRY = 8.0 + p_s * 10.0
          dropletCY = bulgeCY + Math.pow(p_s, 4) * 63.0

          baseAmp = 2.2 + easedProgress * 1.3
        } else if (t < 0.58) {
          // Phase 4: Pinch-off
          const phaseProgress = (t - 0.55) / 0.03

          bulgeR = 0
          bulgeCY = drip.targetBottom + BULGE_BASE_Y_OFFSET + 4.0 - phaseProgress * 2.0

          const p_s = (t - 0.35) / 0.23
          dropletRX = 8.0 - p_s * 3.5
          dropletRY = 8.0 + p_s * 10.0
          dropletCY = drip.targetBottom + BULGE_BASE_Y_OFFSET + 4.0 + Math.pow(p_s, 4) * 63.0

          baseAmp = 3.5
        } else if (t < 0.85) {
          // Phase 5: Falling & Recoil
          const phaseProgress = (t - 0.58) / 0.27

          dropletCY =
            drip.targetBottom +
            BULGE_BASE_Y_OFFSET +
            4.0 +
            65.0 +
            295.8 * phaseProgress +
            109.2 * Math.pow(phaseProgress, 2)
          dropletRX = 4.5
          dropletRY = 18.0

          const wobbleProgress = (t - 0.58) / 0.27
          const wobbleTime = wobbleProgress * 12.0
          const decay = Math.exp(-wobbleProgress * 5.5)
          const wobbleOffset = Math.cos(wobbleTime) * 3.0 * decay

          bulgeR = Math.max(0, 5.0 * decay)
          bulgeCY = drip.targetBottom + BULGE_BASE_Y_OFFSET + wobbleOffset

          baseAmp = 0.6 + 2.9 * decay
        } else if (t < 0.92) {
          // Phase 6: Splash & Dissolve
          dropletRX = 0
          dropletRY = 0
          dropletCY = drip.targetBottom + 610.0

          const wobbleProgress = (t - 0.58) / 0.27
          const wobbleTime = wobbleProgress * 12.0
          const decay = Math.exp(-wobbleProgress * 5.5)
          const wobbleOffset = Math.cos(wobbleTime) * 3.0 * decay

          bulgeR = Math.max(0, 5.0 * decay)
          bulgeCY = drip.targetBottom + BULGE_BASE_Y_OFFSET + wobbleOffset

          baseAmp = 0.6 + 2.9 * decay
        } else {
          // Phase 7: Cool down
          bulgeR = 0
          bulgeCY = drip.targetBottom + BULGE_BASE_Y_OFFSET
          dropletRX = 0
          dropletRY = 0
          dropletCY = drip.targetBottom + DROPLET_BASE_Y_OFFSET
          baseAmp = 0.6
        }

        // Wave control points heights
        const ly1 = getWaveY(drip.waveLeft + leftSpan * 0.25, t, baseAmp, drip.waveLeft, drip.waveRight, drip.dripX)
        const ly2 = getWaveY(drip.waveLeft + leftSpan * 0.5, t, baseAmp, drip.waveLeft, drip.waveRight, drip.dripX)
        const ly3 = getWaveY(drip.waveLeft + leftSpan * 0.75, t, baseAmp, drip.waveLeft, drip.waveRight, drip.dripX)
        const ly4 = getWaveY(drip.dripX, t, baseAmp, drip.waveLeft, drip.waveRight, drip.dripX)
        const ry1 = getWaveY(drip.dripX + rightSpan * 0.5, t, baseAmp, drip.waveLeft, drip.waveRight, drip.dripX)

        const y1Val = drip.targetBottom + ly1
        const y2Val = drip.targetBottom + ly2
        const y3Val = drip.targetBottom + ly3
        const y4Val = drip.targetBottom + ly4
        const ry1Val = drip.targetBottom + ry1

        const wl = drip.waveLeft.toFixed(1)
        const wr = drip.waveRight.toFixed(1)
        const yb = drip.targetBottom.toFixed(1)
        const ybTop = (drip.targetBottom - 20).toFixed(1)

        const w_left_segment = leftSpan * 0.25
        const w_right_segment = rightSpan * 0.5

        const c1x1 = (drip.waveLeft + w_left_segment * 0.1875).toFixed(1)
        const c1x2 = (drip.waveLeft + w_left_segment * 0.85 - w_left_segment * 0.4).toFixed(1)
        const lx1 = (drip.waveLeft + w_left_segment).toFixed(1)

        const c2x1 = (drip.waveLeft + w_left_segment + w_left_segment * 0.4).toFixed(1)
        const c2x2 = (drip.waveLeft + w_left_segment * 2 - w_left_segment * 0.4).toFixed(1)
        const lx2 = (drip.waveLeft + w_left_segment * 2).toFixed(1)

        const c3x1 = (drip.waveLeft + w_left_segment * 2 + w_left_segment * 0.4).toFixed(1)
        const c3x2 = (drip.waveLeft + w_left_segment * 3 - w_left_segment * 0.4).toFixed(1)
        const lx3 = (drip.waveLeft + w_left_segment * 3).toFixed(1)

        const c4x1 = (drip.waveLeft + w_left_segment * 3 + w_left_segment * 0.4).toFixed(1)
        const c4x2 = (drip.dripX - w_left_segment * 0.4).toFixed(1)
        const dxVal = drip.dripX.toFixed(1)

        const c5x1 = (drip.dripX + w_right_segment * 0.32).toFixed(1)
        const c5x2 = (drip.dripX + w_right_segment - w_right_segment * 0.32).toFixed(1)
        const rx1 = (drip.dripX + w_right_segment).toFixed(1)

        const c6x1 = (drip.dripX + w_right_segment + w_right_segment * 0.32).toFixed(1)
        const c6x2 = (drip.waveRight - w_right_segment * 0.28).toFixed(1)

        const pathD =
          `M ${wl},${ybTop} L ${wl},${yb} ` +
          `C ${c1x1},${yb} ${c1x2},${y1Val.toFixed(1)} ${lx1},${y1Val.toFixed(1)} ` +
          `C ${c2x1},${y1Val.toFixed(1)} ${c2x2},${y2Val.toFixed(1)} ${lx2},${y2Val.toFixed(1)} ` +
          `C ${c3x1},${y2Val.toFixed(1)} ${c3x2},${y3Val.toFixed(1)} ${lx3},${y3Val.toFixed(1)} ` +
          `C ${c4x1},${y3Val.toFixed(1)} ${c4x2},${y4Val.toFixed(1)} ${dxVal},${y4Val.toFixed(1)} ` +
          `C ${c5x1},${y4Val.toFixed(1)} ${c5x2},${ry1Val.toFixed(1)} ${rx1},${ry1Val.toFixed(1)} ` +
          `C ${c6x1},${ry1Val.toFixed(1)} ${c6x2},${yb} ${wr},${yb} ` +
          `L ${wr},${ybTop} Z`

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
