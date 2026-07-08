import { loadSharedRainAssets, RainEffect, RainRenderer } from './rain-card'
import type { NormalizedAtmosphereOptions } from '../core/types'
import type { CollisionTargetRect } from './collisionTargets'

/** Layer attribute so we can skip our own canvases during collision detection. */
const LAYER_ATTR = 'data-atmos-layer'
const LAYER_VALUE = 'card-rain'

interface CardEntry {
  element: HTMLElement
  canvas: HTMLCanvasElement
  effect: RainEffect
  isIntersectingCard: boolean
  isIntersectingDrips: boolean
}

export type CardRainController = {
  sync(options: NormalizedAtmosphereOptions, targets: readonly CollisionTargetRect[]): void
  pause(): void
  resume(): void
  resize(): void
  destroy(): void
}

function isOptedIn(el: HTMLElement, width: number, height: number): boolean {
  const tag = el.tagName.toUpperCase()
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
    return false
  }
  return el.hasAttribute('data-atmos-glass') &&
         !el.hasAttribute('data-atmos-solid') &&
         width >= 100 &&
         height >= 80
}

/**
 * Manages independent per-card simulations through one shared WebGL renderer
 * and one requestAnimationFrame loop for this AtmosFx root.
 */
export function createCardRainController(root: HTMLElement): CardRainController {
  const ownerWindow = root.ownerDocument.defaultView
  const entries = new Map<HTMLElement, CardEntry>()
  const sharedCanvas = root.ownerDocument.createElement('canvas')
  let sharedRenderer: RainRenderer | null = null
  let rendererPromise: Promise<void> | null = null
  let frameId: number | null = null
  let active = false
  let isRain = false
  let qualityAllowsCardRain = false
  let liquidDripping = false
  let runEffect = false
  let destroyed = false
  let latestOptions: NormalizedAtmosphereOptions | null = null
  let latestTargets: readonly CollisionTargetRect[] = []

  function cancelFrame(): void {
    if (frameId === null) return
    ownerWindow?.cancelAnimationFrame(frameId)
    frameId = null
  }

  function requestFrame(): void {
    const hasRenderableCard = [...entries.values()].some(entry =>
      entry.isIntersectingCard && entry.effect.isReady(),
    )
    if (
      destroyed ||
      !runEffect ||
      !sharedRenderer ||
      !hasRenderableCard ||
      frameId !== null ||
      !ownerWindow
    ) return
    frameId = ownerWindow.requestAnimationFrame(renderFrame)
  }

  function ensureSharedRenderer(): void {
    if (sharedRenderer || rendererPromise || destroyed) return

    rendererPromise = loadSharedRainAssets()
      .then(({ refraction }) => {
        if (destroyed) return
        sharedRenderer = new RainRenderer(sharedCanvas, null, refraction)
        requestFrame()
      })
      .catch((error: unknown) => {
        console.error('AtmosFx: failed to initialize card rain renderer', error)
      })
      .finally(() => {
        rendererPromise = null
      })
  }

  function renderFrame(time: number): void {
    frameId = null
    if (destroyed || !runEffect || !sharedRenderer) return

    const runnable = [...entries.values()].filter(entry =>
      entry.isIntersectingCard && entry.effect.isReady(),
    )

    let maxWidth = 1
    let maxHeight = 1
    for (const entry of runnable) {
      const { width, height } = entry.effect.getSize()
      maxWidth = Math.max(maxWidth, width)
      maxHeight = Math.max(maxHeight, height)
    }

    if (sharedCanvas.width !== maxWidth || sharedCanvas.height !== maxHeight) {
      sharedRenderer.resize(maxWidth, maxHeight)
    }

    for (const entry of runnable) {
      entry.effect.render(time, sharedRenderer)
    }

    requestFrame()
  }

  function addCard(el: HTMLElement, density: number): void {
    if (entries.has(el)) return

    const canvas = el.ownerDocument.createElement('canvas')
    canvas.setAttribute(LAYER_ATTR, LAYER_VALUE)
    canvas.setAttribute('aria-hidden', 'true')

    if (el.firstChild) {
      el.insertBefore(canvas, el.firstChild)
    } else {
      el.appendChild(canvas)
    }

    const effect = new RainEffect(canvas, { maxPixelRatio: 1 })
    effect.setDensity(density).start()
    effect.ready.then(requestFrame)
    entries.set(el, {
      element: el,
      canvas,
      effect,
      isIntersectingCard: true,
      isIntersectingDrips: true,
    })
    ensureSharedRenderer()
  }

  function removeCard(entry: CardEntry): void {
    entry.element.removeAttribute('data-atmos-card-fx')
    entry.effect.destroy()
    entry.canvas.parentNode?.removeChild(entry.canvas)
  }

  function updateEntryState(entry: CardEntry): void {
    const shouldRun = runEffect && entry.isIntersectingCard
    if (shouldRun) {
      entry.effect.start()
    } else {
      entry.effect.stop()
      entry.effect.clear()
    }

    const isDripsRunning = active && isRain && liquidDripping && entry.isIntersectingDrips
    if (shouldRun || isDripsRunning) {
      entry.element.setAttribute('data-atmos-card-fx', 'running')
    } else {
      entry.element.setAttribute('data-atmos-card-fx', active ? 'paused' : 'stopped')
    }
  }

  function reconcile(
    options: NormalizedAtmosphereOptions,
    targets: readonly CollisionTargetRect[],
  ): void {
    isRain = options.preset === 'rain'
    qualityAllowsCardRain = options.quality !== 'low'
    liquidDripping = options.liquidDripping
    runEffect = active && isRain && qualityAllowsCardRain

    const targetByElement = new Map<HTMLElement, CollisionTargetRect>()
    for (const target of targets) {
      if (target.element && isOptedIn(target.element, target.width, target.height)) {
        targetByElement.set(target.element, target)
        if (runEffect) addCard(target.element, options.density)
      }
    }

    for (const [el, entry] of entries) {
      const target = targetByElement.get(el)
      if (!target) {
        removeCard(entry)
        entries.delete(el)
        continue
      }

      entry.isIntersectingCard = target.isIntersectingCard !== false
      entry.isIntersectingDrips = target.isIntersectingDrips !== false
      entry.effect.setDensity(options.density)
      updateEntryState(entry)
    }

    if (runEffect) {
      ensureSharedRenderer()
      requestFrame()
    } else {
      cancelFrame()
    }
  }

  return {
    sync(options, targets) {
      latestOptions = options
      latestTargets = targets
      reconcile(options, targets)
    },

    pause() {
      active = false
      runEffect = false
      cancelFrame()
      for (const entry of entries.values()) updateEntryState(entry)
    },

    resume() {
      active = true
      if (latestOptions) reconcile(latestOptions, latestTargets)
    },

    resize() {
      for (const entry of entries.values()) entry.effect.resize()
      requestFrame()
    },

    destroy() {
      if (destroyed) return
      destroyed = true
      active = false
      runEffect = false
      cancelFrame()
      for (const entry of entries.values()) removeCard(entry)
      entries.clear()
      sharedRenderer?.destroy()
      sharedRenderer = null
    },
  }
}
