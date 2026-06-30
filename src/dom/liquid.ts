import type { NormalizedAtmosphereOptions } from '../core/types'
import type { CollisionTargetRect } from './collisionTargets'

type LiquidDrip = {
  elapsed: number
  phaseOffset: number
  waveLeft: number
  waveRight: number
  dripX: number
  randomGatheringPoint: number
  gatheringDurationMs: number
  cycleDurationMs: number
  targetBottom: number
  liquidDripping: boolean
  scale: number
  dropMotionPower: number
  dropMotionFactor: number
  dropAccelerationDistance: number
  dropTerminalVelocity: number
  maxDropDistance: number
  collisionY: number
  hasSplashed: boolean
  isIntersecting: boolean
  targetElement: HTMLElement | null
  
  // DOM Elements
  group: SVGGElement
  path: SVGPathElement
  bulge: SVGCircleElement
  droplet: SVGPathElement
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

// Gathering scales with card width. A 300px card uses a 1500ms baseline
// timing, while wider cards add 2ms per pixel until the 4000ms cap.
const GATHERING_BASE_MS = 1250
const GATHERING_MS_PER_PX = 2.8
const MAX_GATHERING_DURATION_MS = 5500
const MIN_GATHERING_POINT = 0.33
const MAX_GATHERING_POINT = 0.66

// Every phase after Gathering keeps its established duration.
const BULGING_DURATION_MS = 900
const STRETCHING_DURATION_MS = 650
const PINCH_DURATION_MS = 270
const FALLING_DURATION_MS = 1080
const SPLASH_DURATION_MS = 280
const COOL_DOWN_DURATION_MS = 320
const POST_GATHERING_DURATION_MS =
  BULGING_DURATION_MS +
  STRETCHING_DURATION_MS +
  PINCH_DURATION_MS +
  FALLING_DURATION_MS +
  SPLASH_DURATION_MS +
  COOL_DOWN_DURATION_MS

export function getLiquidGatheringDuration(width: number): number {
  return Math.min(
    MAX_GATHERING_DURATION_MS,
    GATHERING_BASE_MS + Math.max(0, width) * GATHERING_MS_PER_PX,
  )
}

function clampGatheringPoint(value: number): number {
  return Math.min(MAX_GATHERING_POINT, Math.max(MIN_GATHERING_POINT, value))
}

function createRandomGatheringPoint(): number {
  return (
    MIN_GATHERING_POINT +
    Math.random() * (MAX_GATHERING_POINT - MIN_GATHERING_POINT)
  )
}

function getCardGatheringPoint(
  element: HTMLElement | undefined,
  configuredPoint: number | undefined,
  randomPoint: number,
): number {
  const cardValue = element?.dataset.atmosLiquidGatheringPoint
  if (cardValue !== undefined) {
    const parsedValue = Number(cardValue)
    if (Number.isFinite(parsedValue)) {
      return clampGatheringPoint(parsedValue)
    }
  }

  return configuredPoint === undefined
    ? randomPoint
    : clampGatheringPoint(configuredPoint)
}

export function getLiquidWaveCenter(
  startX: number,
  gatheringX: number,
  gatheringProgress: number,
): number {
  return startX + (gatheringX - startX) * gatheringProgress
}

// Droplet shape and gravity motion
const GLOBAL_SCALE = 0.8
const DROPLET_START_RX = 8
const DROPLET_END_RX = 4.5
const DROPLET_START_RY = 8
const DROPLET_END_RY = 18
const DROPLET_LENGTH_SCALE = 1.3
// The unfiltered ellipse retains more visible area than the same geometry after
// the gooey alpha threshold. Scale it at detach time to preserve visual volume.
const DETACHED_DROPLET_WIDTH_SCALE = 0.7
const DETACHED_DROPLET_START_LENGTH_SCALE = 0.7
const DETACHED_DROPLET_END_LENGTH_SCALE = 0.5
const TERMINAL_VELOCITY_START_PROGRESS = 0.75 
const BASE_DROP_MOTION_POWER = 3
// Narrow cards scale the attached stretch but retain the existing long falling
// range. A slightly higher power keeps their pinch-off position from dropping
// too far while preserving the shared terminal-velocity handoff.
const DROP_MOTION_SCALE_POWER_ADJUSTMENT = 1.25
const ATTACHED_DROP_DISTANCE = 63
const FALLING_DROP_DISTANCE = 295.8 + 109.2
export const LIQUID_VISIBILITY_TOP_MARGIN_PX = Math.ceil(
  ATTACHED_DROP_DISTANCE * GLOBAL_SCALE +
  FALLING_DROP_DISTANCE +
  DROPLET_END_RY * DROPLET_LENGTH_SCALE * GLOBAL_SCALE +
  4 * GLOBAL_SCALE,
)
const DROP_MOTION_DURATION_SECONDS =
  (STRETCHING_DURATION_MS + PINCH_DURATION_MS + FALLING_DURATION_MS) / 1000
const ACCELERATION_DURATION_SECONDS =
  DROP_MOTION_DURATION_SECONDS * TERMINAL_VELOCITY_START_PROGRESS
const CONSTANT_SPEED_DURATION_SECONDS =
  DROP_MOTION_DURATION_SECONDS - ACCELERATION_DURATION_SECONDS

// Wave settings
const WAVE_FORM_DURATION_MS = 800
// Recoil timing
const RECOIL_DURATION_MS =
  FALLING_DURATION_MS + SPLASH_DURATION_MS + COOL_DOWN_DURATION_MS
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

// Preallocated static module-level buffers
const progressesBuffer = new Float32Array(32)
const pointsBuffer = Array.from({ length: 32 }, () => ({ x: 0, y: 0 }))
const pathSegments: string[] = []

export function fillWaveSampleProgresses(
  outBuffer: Float32Array,
  elapsedMs: number,
  waveLeft: number,
  waveRight: number,
  dripX: number,
  scale: number,
  gatheringDurationMs: number,
): number {
  const waveSpan = waveRight - waveLeft
  if (waveSpan <= 0) {
    for (let i = 0; i < WAVE_SAMPLE_PROGRESSES.length; i++) {
      outBuffer[i] = WAVE_SAMPLE_PROGRESSES[i]
    }
    return WAVE_SAMPLE_PROGRESSES.length
  }

  const bulgeEndMs = gatheringDurationMs + BULGING_DURATION_MS
  const releaseEndMs =
    bulgeEndMs + STRETCHING_DURATION_MS + PINCH_DURATION_MS
  if (elapsedMs >= releaseEndMs) {
    for (let i = 0; i < WAVE_SAMPLE_PROGRESSES.length; i++) {
      outBuffer[i] = WAVE_SAMPLE_PROGRESSES[i]
    }
    return WAVE_SAMPLE_PROGRESSES.length
  }

  const gatherProgress = easeInOutQuad(
    Math.min(1, elapsedMs / gatheringDurationMs),
  )

  const leftWaveStartX = waveLeft + (dripX - waveLeft) * 0.208
  const rightWaveStartX = waveRight - (waveRight - dripX) * 0.514

  const leftCenter = getLiquidWaveCenter(
    leftWaveStartX,
    dripX,
    gatherProgress,
  )
  const rightCenter = getLiquidWaveCenter(
    rightWaveStartX,
    dripX,
    gatherProgress,
  )

  const basePulseWidth = 85 * scale
  const targetPulseWidth = 45 * scale
  const pulseWidth =
    basePulseWidth - gatherProgress * (basePulseWidth - targetPulseWidth)

  const leftCenterProg = (leftCenter - waveLeft) / waveSpan
  const rightCenterProg = (rightCenter - waveLeft) / waveSpan
  const pulseProg = pulseWidth / waveSpan

  // Populate output buffer with initial 17 points
  let count = WAVE_SAMPLE_PROGRESSES.length
  for (let i = 0; i < count; i++) {
    outBuffer[i] = WAVE_SAMPLE_PROGRESSES[i]
  }

  const EPSILON = 0.005

  const tryAddCandidate = (p: number) => {
    if (p > 0 && p < 1) {
      let exists = false
      for (let i = 0; i < count; i++) {
        if (Math.abs(outBuffer[i] - p) < EPSILON) {
          exists = true
          break
        }
      }
      if (!exists && count < outBuffer.length) {
        outBuffer[count] = p
        count++
      }
    }
  }

  tryAddCandidate(leftCenterProg)
  tryAddCandidate(leftCenterProg - pulseProg)
  tryAddCandidate(leftCenterProg + pulseProg)
  tryAddCandidate(rightCenterProg)
  tryAddCandidate(rightCenterProg - pulseProg)
  tryAddCandidate(rightCenterProg + pulseProg)

  // In-place sort of the active elements in outBuffer (count elements)
  for (let i = 1; i < count; i++) {
    const key = outBuffer[i]
    let j = i - 1
    while (j >= 0 && outBuffer[j] > key) {
      outBuffer[j + 1] = outBuffer[j]
      j = j - 1
    }
    outBuffer[j + 1] = key
  }

  return count
}

export function getWaveSampleProgresses(
  elapsedMs: number,
  waveLeft: number,
  waveRight: number,
  dripX: number,
  scale: number,
  gatheringDurationMs: number,
): number[] {
  const buf = new Float32Array(32)
  const count = fillWaveSampleProgresses(
    buf,
    elapsedMs,
    waveLeft,
    waveRight,
    dripX,
    scale,
    gatheringDurationMs,
  )
  const result: number[] = []
  for (let i = 0; i < count; i++) {
    result.push(buf[i])
  }
  return result
}

function getWaveY(
  x: number,
  dripX: number,
  leftCenter: number,
  rightCenter: number,
  pulseWidth: number,
  baseAmp: number,
  formation: number,
  releaseFade: number,
): number {
  if (baseAmp === 0) return 0

  const leftDist = Math.abs(x - leftCenter)
  const leftHeight = leftDist >= pulseWidth ? 0 : (Math.cos((Math.PI * leftDist) / pulseWidth) + 1) / 2

  const rightDist = Math.abs(x - rightCenter)
  const rightHeight = rightDist >= pulseWidth ? 0 : (Math.cos((Math.PI * rightDist) / pulseWidth) + 1) / 2

  const combinedHeight =
    x < dripX
      ? leftHeight
      : x > dripX
        ? rightHeight
        : Math.max(leftHeight, rightHeight)

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
  const randomGatheringPoints = new WeakMap<HTMLElement, number>()
  const dripMap = new WeakMap<HTMLElement, LiquidDrip>()

  const observer = typeof IntersectionObserver !== 'undefined'
    ? new IntersectionObserver((entries) => {
        for (let i = 0; i < entries.length; i++) {
          const entry = entries[i]
          const drip = dripMap.get(entry.target as HTMLElement)
          if (drip) {
            drip.isIntersecting = entry.isIntersecting
          }
        }
      }, {
        root: null,
        rootMargin: `${LIQUID_VISIBILITY_TOP_MARGIN_PX}px 0px 0px 0px`,
        threshold: 0.0,
      })
    : null

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

    const droplet = doc.createElementNS('http://www.w3.org/2000/svg', 'path')
    droplet.setAttribute('class', 'atmos-liquid-element atmos-liquid-droplet')

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
      randomGatheringPoint: createRandomGatheringPoint(),
      gatheringDurationMs: getLiquidGatheringDuration(0),
      cycleDurationMs: getLiquidGatheringDuration(0) + POST_GATHERING_DURATION_MS,
      targetBottom: 0,
      liquidDripping: true,
      scale: 1.0,
      dropMotionPower: BASE_DROP_MOTION_POWER,
      dropMotionFactor: 0,
      dropAccelerationDistance: 0,
      dropTerminalVelocity: 0,
      maxDropDistance: ATTACHED_DROP_DISTANCE + FALLING_DROP_DISTANCE,
      collisionY: 10000,
      hasSplashed: false,
      isIntersecting: true,
      targetElement: null,
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
      if (drip.targetElement) {
        if (observer) {
          observer.unobserve(drip.targetElement)
        }
        dripMap.delete(drip.targetElement)
      }
      drip.droplet.remove()
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

        const element = target.element || null
        if (drip.targetElement !== element) {
          if (drip.targetElement) {
            if (observer) {
              observer.unobserve(drip.targetElement)
            }
            dripMap.delete(drip.targetElement)
          }
          drip.targetElement = element
          if (element) {
            dripMap.set(element, drip)
            if (observer) {
              observer.observe(element)
            }
          }
        }

        const indent = Math.min(20, target.width * 0.15)

        drip.waveLeft = target.x + indent
        drip.waveRight = target.right - indent
        if (target.element) {
          const existingPoint = randomGatheringPoints.get(target.element)
          if (existingPoint === undefined) {
            drip.randomGatheringPoint = createRandomGatheringPoint()
            randomGatheringPoints.set(target.element, drip.randomGatheringPoint)
          } else {
            drip.randomGatheringPoint = existingPoint
          }
        }
        const gatheringPoint = getCardGatheringPoint(
          target.element,
          options.liquidGatheringPoint,
          drip.randomGatheringPoint,
        )
        drip.dripX =
          drip.waveLeft + (drip.waveRight - drip.waveLeft) * gatheringPoint
        drip.gatheringDurationMs = getLiquidGatheringDuration(target.width)
        drip.cycleDurationMs =
          drip.gatheringDurationMs + POST_GATHERING_DURATION_MS
        drip.targetBottom = target.bottom
        // Scale factor: narrower card -> smaller waves, bulges, and falling droplet size (clamped to 0.6 to survive gooey blur)
        drip.scale =
          Math.min(1.0, Math.max(0.6, target.width / 300)) * GLOBAL_SCALE
        drip.dropMotionPower =
          BASE_DROP_MOTION_POWER +
          (1 - drip.scale) * DROP_MOTION_SCALE_POWER_ADJUSTMENT
        drip.maxDropDistance =
          ATTACHED_DROP_DISTANCE * drip.scale + FALLING_DROP_DISTANCE
        drip.dropMotionFactor =
          drip.maxDropDistance /
          (Math.pow(ACCELERATION_DURATION_SECONDS, drip.dropMotionPower) +
            drip.dropMotionPower *
              Math.pow(ACCELERATION_DURATION_SECONDS, drip.dropMotionPower - 1) *
              CONSTANT_SPEED_DURATION_SECONDS)
        drip.dropTerminalVelocity =
          drip.dropMotionPower *
          drip.dropMotionFactor *
          Math.pow(ACCELERATION_DURATION_SECONDS, drip.dropMotionPower - 1)
        drip.dropAccelerationDistance =
          drip.dropMotionFactor *
          Math.pow(ACCELERATION_DURATION_SECONDS, drip.dropMotionPower)

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
        drip.droplet.style.display = cardLiquidDripping ? 'block' : 'none'

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

      for (let i = 0; i < drips.length; i++) {
        const drip = drips[i]

        if (!drip.isIntersecting) {
          continue
        }

        if (!drip.liquidDripping) {
          drip.path.setAttribute('d', '')
          drip.bulge.setAttribute('r', '0')
          drip.droplet.setAttribute('d', '')
          continue
        }
        const leftSpan = drip.dripX - drip.waveLeft
        const rightSpan = drip.waveRight - drip.dripX

        if (leftSpan <= 0 || rightSpan <= 0) {
          drip.path.setAttribute('d', '')
          drip.bulge.setAttribute('r', '0')
          drip.droplet.setAttribute('d', '')
          continue
        }

        drip.elapsed += deltaTimeSeconds * 1000 * speed
        const elapsedMs =
          (drip.elapsed + drip.phaseOffset) % drip.cycleDurationMs
        const gatherEndMs = drip.gatheringDurationMs
        const bulgeEndMs = gatherEndMs + BULGING_DURATION_MS
        const stretchEndMs = bulgeEndMs + STRETCHING_DURATION_MS
        const pinchEndMs = stretchEndMs + PINCH_DURATION_MS
        const fallEndMs = pinchEndMs + FALLING_DURATION_MS
        const splashEndMs = fallEndMs + SPLASH_DURATION_MS
        // Leave the goo filter when pinch-off starts, before the filter's alpha
        // threshold erodes the now-isolated ellipse. It still overlaps the
        // residual bulge here, so the parent switch has no visible seam.
        const isOutsideGooFilter = elapsedMs >= stretchEndMs
        const dropletParent = isOutsideGooFilter ? group : drip.group

        if (drip.droplet.parentNode !== dropletParent) {
          dropletParent.appendChild(drip.droplet)
          if (isOutsideGooFilter) {
            drip.droplet.setAttribute(
              'clip-path',
              drip.group.getAttribute('clip-path') || ''
            )
          } else {
            drip.droplet.removeAttribute('clip-path')
          }
        }

        const BULGE_BASE_Y_OFFSET = -2
        const DROPLET_BASE_Y_OFFSET = -2
        const scale = drip.scale

        const dropletShapeProgress = Math.min(
          1,
          Math.max(
            0,
            (elapsedMs - bulgeEndMs) /
              (STRETCHING_DURATION_MS + PINCH_DURATION_MS),
          ),
        )
        const dropletLengthScale =
          1 + (DROPLET_LENGTH_SCALE - 1) * easeInOutQuad(dropletShapeProgress)
        const activeDropletRX =
          (DROPLET_START_RX +
            (DROPLET_END_RX - DROPLET_START_RX) * dropletShapeProgress) *
          scale
        const activeDropletRY =
          (DROPLET_START_RY +
            (DROPLET_END_RY - DROPLET_START_RY) * dropletShapeProgress) *
          dropletLengthScale *
          scale

        const motionElapsedSeconds = Math.min(
          DROP_MOTION_DURATION_SECONDS,
          Math.max(0, (elapsedMs - bulgeEndMs) / 1000),
        )
        const dropMotionOffset =
          motionElapsedSeconds <= ACCELERATION_DURATION_SECONDS
            ? drip.dropMotionFactor *
              Math.pow(motionElapsedSeconds, drip.dropMotionPower)
            : drip.dropAccelerationDistance +
              drip.dropTerminalVelocity *
                (motionElapsedSeconds - ACCELERATION_DURATION_SECONDS)
        const dropMotionStartY =
          drip.targetBottom + BULGE_BASE_Y_OFFSET + 4.0 * scale
        const dropMotionY = dropMotionStartY + dropMotionOffset

        let bulgeR = 0
        let bulgeCY = drip.targetBottom + BULGE_BASE_Y_OFFSET

        let dropletRX = 0
        let dropletRY = 0
        let dropletCY = drip.targetBottom + DROPLET_BASE_Y_OFFSET

        let baseAmp = 1.8

        if (elapsedMs < gatherEndMs) {
          // Phase 1: Gathering - Early bulge expansion (easeInQuad)
          const progress = elapsedMs / gatherEndMs
          const eased = easeInQuad(progress)
          bulgeR = eased * 4.0 * scale
          bulgeCY = drip.targetBottom + BULGE_BASE_Y_OFFSET + eased * 2.0 * scale

          dropletRX = 0
          dropletRY = 0
          dropletCY = drip.targetBottom + DROPLET_BASE_Y_OFFSET
          baseAmp = 1.8
          drip.hasSplashed = false
        } else if (elapsedMs < bulgeEndMs) {
          // Phase 2: Bulging - Smoothly continue expansion (easeOutQuad)
          const phaseProgress =
            (elapsedMs - gatherEndMs) / BULGING_DURATION_MS
          const easedProgress = easeOutQuad(phaseProgress)

          bulgeR = (4.0 + easedProgress * 4.0) * scale
          bulgeCY = drip.targetBottom + BULGE_BASE_Y_OFFSET + (2.0 + easedProgress * 2.0) * scale

          dropletRX = 0
          dropletRY = 0
          dropletCY = bulgeCY

          baseAmp = 1.8 + easedProgress * 0.4
        } else if (elapsedMs < stretchEndMs) {
          // Phase 3: Stretching - Extend expansion, then shrink to residual bulge
          const phaseProgress =
            (elapsedMs - bulgeEndMs) / STRETCHING_DURATION_MS
          const easedProgress = easeInOutQuad(phaseProgress)

          const elapsedInStretch = elapsedMs - bulgeEndMs
          if (elapsedInStretch < 200) {
            const progress = elapsedInStretch / 200
            const eased = easeInOutQuad(progress)
            bulgeR = (8.0 + eased * 0.5) * scale
            bulgeCY = drip.targetBottom + BULGE_BASE_Y_OFFSET + (4.0 + eased * 1.0) * scale
          } else {
            const progress = (elapsedInStretch - 200) / 450
            const eased = easeInOutQuad(progress)
            bulgeR = (8.5 - eased * 3.5) * scale
            bulgeCY = drip.targetBottom + BULGE_BASE_Y_OFFSET + (5.0 - eased * 2.0) * scale
          }

          dropletRX = activeDropletRX
          dropletRY = activeDropletRY
          dropletCY = dropMotionY

          baseAmp = 2.2 + easedProgress * 1.3
        } else if (elapsedMs < pinchEndMs) {
          // Phase 4: Pinch-off
          bulgeR = 5.0 * scale
          bulgeCY = drip.targetBottom + BULGE_BASE_Y_OFFSET + 3.0 * scale

          dropletRX = activeDropletRX
          dropletRY = activeDropletRY
          dropletCY = dropMotionY

          baseAmp = 3.5
        } else if (elapsedMs < fallEndMs) {
          // Phase 5: Falling & Recoil
          // Check if droplet hits the collision level
          if (dropMotionY >= drip.collisionY) {
            if (!drip.hasSplashed) {
              drip.hasSplashed = true
              onSplash?.(drip.dripX, drip.collisionY, 0, scale)
            }
            dropletRX = 0
            dropletRY = 0
            dropletCY = drip.collisionY
          } else {
            // Keep drawing the smooth, scalable SVG droplet while falling
            dropletRX = activeDropletRX
            dropletRY = activeDropletRY
            dropletCY = dropMotionY
          }

          const wobbleProgress =
            (elapsedMs - pinchEndMs) / RECOIL_DURATION_MS
          const wobbleTime = wobbleProgress * RECOIL_ROTATION
          const decay = Math.max(0, 1 - wobbleProgress)
          const wobbleOffset = Math.cos(wobbleTime) * 3.0 * decay * scale

          bulgeR = Math.max(0, 5.0 * decay * scale)
          bulgeCY = drip.targetBottom + BULGE_BASE_Y_OFFSET + wobbleOffset

          baseAmp = 0
        } else if (elapsedMs < splashEndMs) {
          // Phase 6: Splash & Dissolve
          dropletRX = 0
          dropletRY = 0
          dropletCY = drip.collisionY

          // In case it fell very fast and didn't trigger splash in Phase 5
          if (!drip.hasSplashed) {
            drip.hasSplashed = true
            const maxFallY = dropMotionStartY + drip.maxDropDistance
            if (drip.collisionY <= maxFallY) {
              onSplash?.(drip.dripX, drip.collisionY, 0, scale)
            }
          }

          const wobbleProgress =
            (elapsedMs - pinchEndMs) / RECOIL_DURATION_MS
          const wobbleTime = wobbleProgress * RECOIL_ROTATION
          const decay = Math.max(0, 1 - wobbleProgress)
          const wobbleOffset = Math.cos(wobbleTime) * 3.0 * decay * scale

          bulgeR = Math.max(0, 5.0 * decay * scale)
          bulgeCY = drip.targetBottom + BULGE_BASE_Y_OFFSET + wobbleOffset

          baseAmp = 0
        } else {
          // Phase 7: Cool down
          const wobbleProgress =
            (elapsedMs - pinchEndMs) / RECOIL_DURATION_MS
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

        // Precalculate wave parameters once per drip update
        const leftWaveStartX = drip.waveLeft + (drip.dripX - drip.waveLeft) * 0.208
        const rightWaveStartX = drip.waveRight - (drip.waveRight - drip.dripX) * 0.514
        const gatherProgress = easeInOutQuad(
          Math.min(1, elapsedMs / drip.gatheringDurationMs),
        )
        const leftCenter = getLiquidWaveCenter(
          leftWaveStartX,
          drip.dripX,
          gatherProgress,
        )
        const rightCenter = getLiquidWaveCenter(
          rightWaveStartX,
          drip.dripX,
          gatherProgress,
        )

        const basePulseWidth = 85 * scale
        const targetPulseWidth = 45 * scale
        const pulseWidth =
          basePulseWidth - gatherProgress * (basePulseWidth - targetPulseWidth)

        const formation = easeOutQuad(Math.min(1, elapsedMs / WAVE_FORM_DURATION_MS))
        const releaseEndMs = pinchEndMs
        const releaseProgress = Math.max(
          0,
          (elapsedMs - bulgeEndMs) / (releaseEndMs - bulgeEndMs),
        )
        const releaseFade = 1 - easeInQuad(releaseProgress)

        const scaledAmp = baseAmp * scale
        const waveSpan = drip.waveRight - drip.waveLeft

        const progressesCount = fillWaveSampleProgresses(
          progressesBuffer,
          elapsedMs,
          drip.waveLeft,
          drip.waveRight,
          drip.dripX,
          scale,
          drip.gatheringDurationMs,
        )

        for (let idx = 0; idx < progressesCount; idx++) {
          const prog = progressesBuffer[idx]
          const xVal = drip.waveLeft + prog * waveSpan
          let yVal = drip.targetBottom - 1.0

          if (scaledAmp !== 0 && idx > 0 && idx < progressesCount - 1) {
            yVal += getWaveY(
              xVal,
              drip.dripX,
              leftCenter,
              rightCenter,
              pulseWidth,
              scaledAmp,
              formation,
              releaseFade,
            )
          }

          const pt = pointsBuffer[idx]
          pt.x = xVal
          pt.y = yVal
        }

        const wl = drip.waveLeft.toFixed(1)
        const wr = drip.waveRight.toFixed(1)
        const ybTop = (drip.targetBottom - 20).toFixed(1)
        const dxVal = drip.dripX.toFixed(1)

        pathSegments.length = 0
        pathSegments.push('M ', wl, ',', ybTop, ' L ', pointsBuffer[0].x.toFixed(1), ',', pointsBuffer[0].y.toFixed(1), ' ')

        for (let idx = 0; idx < progressesCount - 1; idx++) {
          const p0 = pointsBuffer[Math.max(0, idx - 1)]
          const p1 = pointsBuffer[idx]
          const p2 = pointsBuffer[idx + 1]
          const p3 = pointsBuffer[Math.min(progressesCount - 1, idx + 2)]
          const cp1x = p1.x + (p2.x - p0.x) / 6
          const cp1y = p1.y + (p2.y - p0.y) / 6
          const cp2x = p2.x - (p3.x - p1.x) / 6
          const cp2y = p2.y - (p3.y - p1.y) / 6

          pathSegments.push(
            'C ', cp1x.toFixed(1), ',', cp1y.toFixed(1), ' ',
            cp2x.toFixed(1), ',', cp2y.toFixed(1), ' ',
            p2.x.toFixed(1), ',', p2.y.toFixed(1), ' '
          )
        }

        pathSegments.push('L ', wr, ',', ybTop, ' Z')
        const pathD = pathSegments.join('')

        drip.path.setAttribute('d', pathD)
        drip.bulge.setAttribute('cy', bulgeCY.toFixed(1))
        drip.bulge.setAttribute('r', bulgeR.toFixed(1))
        drip.bulge.setAttribute('cx', dxVal)
        const filterExitProgress = Math.min(
          1,
          Math.max(0, (elapsedMs - stretchEndMs) / PINCH_DURATION_MS),
        )
        const detachedLengthScale =
          DETACHED_DROPLET_START_LENGTH_SCALE +
          (DETACHED_DROPLET_END_LENGTH_SCALE -
            DETACHED_DROPLET_START_LENGTH_SCALE) *
            easeInOutQuad(filterExitProgress)
        const visualScaleX = isOutsideGooFilter ? DETACHED_DROPLET_WIDTH_SCALE : 1
        const visualScaleY = isOutsideGooFilter ? detachedLengthScale : 1
        const renderedRY = dropletRY * visualScaleY
        const lowerHalfRY = isOutsideGooFilter
          ? dropletRY * DETACHED_DROPLET_START_LENGTH_SCALE
          : renderedRY
        // Counter-shift the center by the added radius. The lower tip keeps
        // following the original gravity path while the extra length grows up.
        const renderedCY = dropletCY - (renderedRY - lowerHalfRY)

        const w = dropletRX * visualScaleX
        const h = renderedRY

        if (w <= 0 || h <= 0) {
          const x = parseFloat(dxVal)
          const y = renderedCY
          drip.droplet.setAttribute('d', `M ${x.toFixed(1)},${y.toFixed(1)}`)
        } else {
          const x = parseFloat(dxVal)
          const y = renderedCY
          const xStr = x.toFixed(1)
          const yMinusH = (y - h).toFixed(1)
          const yPlusH = (y + h).toFixed(1)
          const xPlusW = (x + w).toFixed(1)
          const xMinusW = (x - w).toFixed(1)

          // Cubic Bezier control points for teardrop shape
          const cp1x = (x + 0.2 * w).toFixed(1)
          const cp2y = (y - 0.3 * h).toFixed(1)
          const cp3y = (y + 0.3 * h).toFixed(1)

          const cp4y = (y + 0.7 * h).toFixed(1)
          const cp5x = (x + 0.5 * w).toFixed(1)

          const cp6x = (x - 0.5 * w).toFixed(1)

          const cp8x = (x - 0.2 * w).toFixed(1)

          const dropletD = `M ${xStr},${yMinusH} ` +
            `C ${cp1x},${yMinusH} ${xPlusW},${cp2y} ${xPlusW},${cp3y} ` +
            `C ${xPlusW},${cp4y} ${cp5x},${yPlusH} ${xStr},${yPlusH} ` +
            `C ${cp6x},${yPlusH} ${xMinusW},${cp4y} ${xMinusW},${cp3y} ` +
            `C ${xMinusW},${cp2y} ${cp8x},${yMinusH} ${xStr},${yMinusH} Z`

          drip.droplet.setAttribute('d', dropletD)
        }
      }
    },

    destroy() {
      clearDrips()
      if (observer) {
        observer.disconnect()
      }
      svg.remove()
    },
  }
}
