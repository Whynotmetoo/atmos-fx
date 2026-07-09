import { createCanvasLayer } from '../dom/canvasLayer'
import { createCollisionTargetManager } from '../dom/collisionTargets'
import type { CollisionTargetRect } from '../dom/collisionTargets'
import { createGlassController } from '../dom/glass'
import { createLiquidDripsController, LIQUID_VISIBILITY_TOP_MARGIN_PX } from '../dom/liquid'
import { createCardRainController } from '../dom/cardRainEffect'
import { createRenderer } from '../renderers/createRenderer'
import { normalizeAtmosphereOptions } from './options'
import { createAnimationScheduler } from './scheduler'
import { QualityMonitor } from './qualityMonitor'
import type {
  AtmosphereController,
  AtmosphereOptions,
  AtmospherePreset,
  NormalizedAtmosphereOptions,
} from './types'
import type { CanvasLayer } from '../dom/canvasLayer'
import type { Canvas2DRenderer } from '../renderers/canvas2d/types'

type ControllerState = 'idle' | 'running' | 'paused' | 'stopped' | 'destroyed'

function getReducedMotionQuery(): MediaQueryList | undefined {
  if (typeof window === 'undefined' || !window.matchMedia) {
    return undefined
  }

  return window.matchMedia('(prefers-reduced-motion: reduce)')
}

function addReducedMotionListener(
  query: MediaQueryList | undefined,
  listener: () => void,
): () => void {
  if (!query) {
    return () => undefined
  }

  if (typeof query.addEventListener === 'function') {
    query.addEventListener('change', listener)
    return () => query.removeEventListener('change', listener)
  }

  query.addListener(listener)
  return () => query.removeListener(listener)
}

const CSS_CONTENT = `
@layer atmos-fx {
  [data-atmos-fx] {
    --atmos-fx-opacity: 0.1;
    --atmos-fx-alpha: 0.12;
    --atmos-fx-glass-background: rgba(255, 255, 255, var(--atmos-fx-alpha));
    --atmos-fx-glass-border-start: rgba(255, 255, 255, 0.6);
    --atmos-fx-glass-border-end: rgba(255, 255, 255, 0.15);
    --atmos-fx-glass-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), inset 0 -1px 0 rgba(255, 255, 255, 0.08), 0 4px 10px rgba(0, 0, 0, 0.08), 0 20px 50px rgba(0, 0, 0, 0.3);
    position: relative;
    overflow: hidden;
    isolation: isolate;
  }
  [data-atmos-layer='weather-background'],
  [data-atmos-layer='weather-foreground'],
  [data-atmos-layer='liquid'] {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }
  [data-atmos-layer='weather-background'] {
    filter: blur(0.8px);
    z-index: 0;
  }
  [data-atmos-layer='weather-foreground'] {
    filter: blur(0.6px);
    z-index: 3;
  }
  [data-atmos-fx][data-atmos-quality='low'] > [data-atmos-layer='weather-background'],
  [data-atmos-fx][data-atmos-quality='low'] > [data-atmos-layer='weather-foreground'] {
    filter: none;
  }
  [data-atmos-layer='liquid'] {
    z-index: 4;
  }
  [data-atmos-fx] :where([data-atmos-glass], [data-atmos-solid], [data-atmos-opacity], [data-atmos-collision]) {
    position: relative;
    z-index: 2;
  }
  [data-atmos-fx] :where([data-atmos-glass]):not([data-atmos-solid]) {
    background: rgba(255, 255, 255, 0.08);
    background:
      linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0) 40%, rgba(255, 255, 255, 0) 100%),
      url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.045'/%3E%3C/svg%3E"),
      var(--atmos-fx-glass-background);
    box-shadow: var(--atmos-fx-glass-shadow);
    backdrop-filter: blur(6px) saturate(130%);
    -webkit-backdrop-filter: blur(6px) saturate(130%);
    transition: background 0.15s;
  }
  [data-atmos-fx] input:where([data-atmos-glass]):not([data-atmos-solid]),
  [data-atmos-fx] select:where([data-atmos-glass]):not([data-atmos-solid]),
  [data-atmos-fx] textarea:where([data-atmos-glass]):not([data-atmos-solid]) {
    border: 1px solid rgba(255, 255, 255, 0.22);
    border: 1px solid var(--atmos-fx-glass-border-end);
  }
  [data-atmos-fx] input:where([data-atmos-glass]):not([data-atmos-solid])::before,
  [data-atmos-fx] select:where([data-atmos-glass]):not([data-atmos-solid])::before,
  [data-atmos-fx] textarea:where([data-atmos-glass]):not([data-atmos-solid])::before {
    display: none !important;
    content: none !important;
  }
  [data-atmos-fx] :where([data-atmos-glass]):not([data-atmos-solid])::before {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: inherit;
    pointer-events: none;
    background: linear-gradient(
      135deg,
      var(--atmos-fx-glass-border-start),
      rgba(255, 255, 255, 0.05) 35%,
      var(--atmos-fx-glass-border-end)
    );
    opacity: 0.55;
    mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
    -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
    padding: 1px;
    -webkit-mask-composite: xor;
    mask-composite: exclude;
  }
  [data-atmos-fx] :where([data-atmos-opacity]):not([data-atmos-solid]) {
    background: rgba(255, 255, 255, var(--atmos-fx-opacity));
  }
  [data-atmos-fx] :where([data-atmos-solid]) {
    opacity: 1;
    box-shadow: none;
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
  }
  [data-atmos-fx] :where([data-atmos-glass]) {
    overflow: hidden;
    isolation: isolate;
  }
  [data-atmos-layer='card-rain'] {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: -1;
    border-radius: inherit;
    filter: blur(0.6px);
  }
  [data-atmos-card-fx='paused'] [data-atmos-layer='card-rain'],
  [data-atmos-card-fx='stopped'] [data-atmos-layer='card-rain'] {
    display: none;
  }
}
`

function injectStyles(doc: Document, nonce?: string) {
  const id = 'atmos-fx-styles'
  let style = doc.getElementById(id) as HTMLStyleElement | null
  if (!style) {
    style = doc.createElement('style')
    style.id = id
    style.textContent = CSS_CONTENT
    if (nonce) {
      style.setAttribute('nonce', nonce)
    }
    doc.head.appendChild(style)
  } else if (nonce) {
    style.setAttribute('nonce', nonce)
  }
}

export function createAtmosphere(
  element: HTMLElement,
  options: AtmosphereOptions = {},
): AtmosphereController {
  if (!(element instanceof HTMLElement)) {
    throw new TypeError('createAtmosphere requires an HTMLElement root.')
  }

  let currentOptions: AtmosphereOptions = { ...options }
  let normalizedOptions: NormalizedAtmosphereOptions = normalizeAtmosphereOptions(currentOptions)
  const ownerDocument = element.ownerDocument
  if (normalizedOptions.injectStyles) {
    injectStyles(ownerDocument, normalizedOptions.styleNonce)
  }
  const ownerWindow = ownerDocument.defaultView
  const reducedMotionQuery = getReducedMotionQuery()
  const glassController = createGlassController(element)
  const liquidDripsController = createLiquidDripsController(element, (x, y, vx, scale) => {
    if (renderer && typeof renderer.spawnSplash === 'function') {
      renderer.spawnSplash(x, y, vx, scale)
    }
  })
  const cardRainController = createCardRainController(element)
  let state: ControllerState = 'idle'
  let canvasLayer: CanvasLayer | undefined
  let renderer: Canvas2DRenderer | undefined
  let rendererPreset: AtmospherePreset | undefined
  let visibilityPaused = false
  let reducedMotionPaused = false
  let intersectionPaused = false
  let isIntersecting = true
  let manuallyPaused = false
  let lastTime: number | undefined

  const qualityMonitor = new QualityMonitor(normalizedOptions.quality === 'auto')

  const getEffectiveOptions = (): NormalizedAtmosphereOptions => {
    const scaling = qualityMonitor.getScalingState()

    // Auto step 0 represents high; every lower auto step supplies an override.
    const baseQuality = normalizedOptions.quality === 'auto'
      ? 'high'
      : normalizedOptions.quality

    let finalQuality = baseQuality
    if (scaling.qualityTierOverride) {
      const tierRank = { low: 1, medium: 2, high: 3 }
      if (tierRank[scaling.qualityTierOverride] < tierRank[baseQuality]) {
        finalQuality = scaling.qualityTierOverride
      }
    }

    return {
      ...normalizedOptions,
      quality: finalQuality,
    }
  }

  const scheduler = createAnimationScheduler((time) => {
    const deltaSeconds =
      lastTime === undefined
        ? 1 / 60
        : Math.min(0.05, Math.max(0, (time - lastTime) / 1000))
    lastTime = time

    const frameStart = performance.now()
    renderer?.render(time)
    liquidDripsController.update(deltaSeconds)
    const frameDuration = performance.now() - frameStart

    qualityMonitor.recordFrame(time, frameDuration, () => {
      const scaling = qualityMonitor.getScalingState()
      syncDataset()
      const size = canvasLayer?.resize(scaling.dprCap)
      if (size) {
        renderer?.resize(size)
      }
      ensureRenderer()
      syncCollisionTargets()
    })
  })

  let observedCards = new Set<HTMLElement>()
  const cardVisibilityMap = new WeakMap<HTMLElement, boolean>()
  const dripVisibilityMap = new WeakMap<HTMLElement, boolean>()

  const cardIntersectionObserver = ownerWindow?.IntersectionObserver
    ? new ownerWindow.IntersectionObserver((entries) => {
        let changed = false
        for (let i = 0; i < entries.length; i++) {
          const entry = entries[i]!
          const el = entry.target as HTMLElement
          const prev = cardVisibilityMap.get(el)
          if (prev !== entry.isIntersecting) {
            cardVisibilityMap.set(el, entry.isIntersecting)
            changed = true
          }
        }
        if (changed) {
          syncTargets(collisionTargetManager.getTargets())
        }
      }, {
        root: null,
        threshold: 0.0,
      })
    : null

  const dripIntersectionObserver = ownerWindow?.IntersectionObserver
    ? new ownerWindow.IntersectionObserver((entries) => {
        let changed = false
        for (let i = 0; i < entries.length; i++) {
          const entry = entries[i]!
          const el = entry.target as HTMLElement
          const prev = dripVisibilityMap.get(el)
          if (prev !== entry.isIntersecting) {
            dripVisibilityMap.set(el, entry.isIntersecting)
            changed = true
          }
        }
        if (changed) {
          syncTargets(collisionTargetManager.getTargets())
        }
      }, {
        root: null,
        rootMargin: `${LIQUID_VISIBILITY_TOP_MARGIN_PX}px 0px 0px 0px`,
        threshold: 0.0,
      })
    : null

  const collisionTargetManager = createCollisionTargetManager(
    element,
    (targets) => {
      syncTargets(targets)
    },
  )

  const assertActive = () => {
    if (state === 'destroyed') {
      throw new Error('Cannot use an atmosphere controller after destroy().')
    }
  }

  const syncDataset = () => {
    element.dataset.atmosFxPreset = normalizedOptions.preset
    element.dataset.atmosQuality = getEffectiveOptions().quality

    if (renderer) {
      element.dataset.atmosRenderer = renderer.backend
    }

    glassController.sync(normalizedOptions)
  }

  const syncTargets = (targets: readonly CollisionTargetRect[]) => {
    // Centralized visibility tracking
    const nextObserved = new Set<HTMLElement>()
    for (let i = 0; i < targets.length; i++) {
      const t = targets[i]!
      if (t.element) {
        nextObserved.add(t.element)
        if (!observedCards.has(t.element)) {
          cardIntersectionObserver?.observe(t.element)
          dripIntersectionObserver?.observe(t.element)
        }
        t.isIntersectingCard = cardVisibilityMap.get(t.element) !== false
        t.isIntersectingDrips = dripVisibilityMap.get(t.element) !== false
      }
    }
    for (const el of observedCards) {
      if (!nextObserved.has(el)) {
        cardIntersectionObserver?.unobserve(el)
        dripIntersectionObserver?.unobserve(el)
        cardVisibilityMap.delete(el)
        dripVisibilityMap.delete(el)
      }
    }
    observedCards = nextObserved

    renderer?.setCollisionTargets(targets)
    const effectiveOptions = getEffectiveOptions()
    liquidDripsController.sync(effectiveOptions, targets)
    cardRainController.sync(effectiveOptions, targets)
  }

  const syncCollisionTargets = () => {
    collisionTargetManager.refresh()
  }

  const setState = (nextState: ControllerState) => {
    state = nextState

    if (nextState === 'destroyed') {
      delete element.dataset.atmosFx
      return
    }

    element.dataset.atmosFx = nextState
  }

  const ensureCanvasLayer = () => {
    if (!canvasLayer) {
      canvasLayer = createCanvasLayer(element)
    }

    const scaling = qualityMonitor.getScalingState()
    return canvasLayer.resize(scaling.dprCap)
  }

  const resizeLayerAndRenderer = () => {
    const scaling = qualityMonitor.getScalingState()
    const size = canvasLayer?.resize(scaling.dprCap)

    if (size) {
      renderer?.resize(size)
      syncCollisionTargets()
    }

    return size
  }

  const ensureRenderer = () => {
    if (!canvasLayer) {
      return
    }

    const shouldRecreateRenderer =
      renderer !== undefined &&
      rendererPreset !== normalizedOptions.preset

    if (shouldRecreateRenderer) {
      renderer?.destroy()
      renderer = undefined
      rendererPreset = undefined
    }

    const activeCanvasLayer = canvasLayer

    if (!activeCanvasLayer) {
      return
    }

    const effectiveOptions = getEffectiveOptions()
    if (!renderer) {
      renderer = createRenderer(
        {
          background: activeCanvasLayer.backgroundCanvas,
          foreground: activeCanvasLayer.foregroundCanvas,
        },
        activeCanvasLayer.getSize(),
        effectiveOptions,
      )
      rendererPreset = normalizedOptions.preset
      element.dataset.atmosRenderer = renderer.backend
      renderer.setCollisionTargets(collisionTargetManager.getTargets())
      const canRenderImmediately =
        state === 'running' &&
        !manuallyPaused &&
        !shouldPauseForHiddenDocument() &&
        !shouldReduceMotion() &&
        !shouldPauseForOutOfViewport()
      if (canRenderImmediately) {
        renderer.render(ownerWindow?.performance.now() ?? 0)
      }
      return
    }

    renderer.updateOptions(effectiveOptions)
    element.dataset.atmosRenderer = renderer.backend
    renderer.setCollisionTargets(collisionTargetManager.getTargets())
  }

  const shouldReduceMotion = () =>
    normalizedOptions.respectReducedMotion && Boolean(reducedMotionQuery?.matches)

  const shouldPauseForHiddenDocument = () =>
    normalizedOptions.pauseWhenHidden && ownerDocument.hidden

  const shouldPauseForOutOfViewport = () =>
    normalizedOptions.pauseWhenHidden && !isIntersecting

  const hasAutoPause = () => visibilityPaused || reducedMotionPaused || intersectionPaused

  const refreshAutoPauseFlags = () => {
    visibilityPaused = shouldPauseForHiddenDocument()
    reducedMotionPaused = shouldReduceMotion()
    intersectionPaused = shouldPauseForOutOfViewport()
  }

  const startAnimationIfAllowed = () => {
    if (state === 'destroyed' || state === 'stopped' || manuallyPaused) {
      scheduler.stop()
      cardRainController.pause()
      return
    }

    refreshAutoPauseFlags()

    if (hasAutoPause()) {
      scheduler.stop()
      cardRainController.pause()
      setState('paused')
      return
    }

    setState('running')
    cardRainController.resume()
    scheduler.start()
  }

  const handleVisibilityChange = () => {
    if (!normalizedOptions.pauseWhenHidden || state === 'destroyed' || state === 'stopped') {
      return
    }

    if (ownerDocument.hidden && state === 'running') {
      visibilityPaused = true
      scheduler.stop()
      cardRainController.pause()
      setState('paused')
      return
    }

    if (!ownerDocument.hidden && visibilityPaused) {
      visibilityPaused = false

      if (!hasAutoPause() && !manuallyPaused) {
        startAnimationIfAllowed()
      }
    }
  }

  const handleReducedMotionChange = () => {
    if (!normalizedOptions.respectReducedMotion || state === 'destroyed' || state === 'stopped') {
      return
    }

    if (shouldReduceMotion() && state === 'running') {
      reducedMotionPaused = true
      scheduler.stop()
      cardRainController.pause()
      setState('paused')
      return
    }

    if (!shouldReduceMotion() && reducedMotionPaused) {
      reducedMotionPaused = false

      if (!hasAutoPause() && !manuallyPaused) {
        startAnimationIfAllowed()
      }
    }
  }

  const handleContainerResize = () => {
    resizeLayerAndRenderer()
  }

  const handleIntersectionChange = (entries: IntersectionObserverEntry[]) => {
    if (state === 'destroyed' || state === 'stopped') {
      return
    }

    const entry = entries[0]
    if (entry) {
      isIntersecting = entry.isIntersecting
    }

    const nextIntersectionPaused = shouldPauseForOutOfViewport()
    if (nextIntersectionPaused) {
      intersectionPaused = true
      if (state === 'running') {
        scheduler.stop()
        cardRainController.pause()
        setState('paused')
      }
      return
    }

    if (!nextIntersectionPaused && intersectionPaused) {
      intersectionPaused = false

      if (!hasAutoPause() && !manuallyPaused) {
        startAnimationIfAllowed()
      }
    }
  }

  ownerDocument.addEventListener('visibilitychange', handleVisibilityChange)
  ownerWindow?.addEventListener('resize', handleContainerResize)
  const ResizeObserverCtor = ownerWindow?.ResizeObserver
  const resizeObserver =
    ResizeObserverCtor === undefined ? undefined : new ResizeObserverCtor(handleContainerResize)
  resizeObserver?.observe(element)
  
  const IntersectionObserverCtor = ownerWindow?.IntersectionObserver
  const intersectionObserver =
    IntersectionObserverCtor === undefined
      ? undefined
      : new IntersectionObserverCtor(handleIntersectionChange, { threshold: 0 })
  intersectionObserver?.observe(element)

  const removeReducedMotionListener = addReducedMotionListener(
    reducedMotionQuery,
    handleReducedMotionChange,
  )

  const controller: AtmosphereController = {
    start() {
      assertActive()
      const size = ensureCanvasLayer()
      qualityMonitor.setup(normalizedOptions.quality === 'auto')

      syncDataset()
      syncCollisionTargets()
      ensureRenderer()
      renderer?.resize(size)
      manuallyPaused = false
      setState('running')
      startAnimationIfAllowed()
    },
    stop() {
      assertActive()
      visibilityPaused = false
      reducedMotionPaused = false
      manuallyPaused = false
      scheduler.stop()
      renderer?.clear()
      cardRainController.pause()
      liquidDripsController.sync(normalizedOptions, [])
      cardRainController.sync(normalizedOptions, [])
      lastTime = undefined
      qualityMonitor.reset()
      setState('stopped')
    },
    pause() {
      assertActive()
      if (state === 'running') {
        manuallyPaused = true
        visibilityPaused = false
        reducedMotionPaused = false
        scheduler.stop()
        cardRainController.pause()
        setState('paused')
      }
    },
    resume() {
      assertActive()
      if (state === 'paused') {
        manuallyPaused = false
        visibilityPaused = false
        reducedMotionPaused = false
        setState('running')
        startAnimationIfAllowed()
      }
    },
    resize() {
      assertActive()
      resizeLayerAndRenderer()
      cardRainController.resize()
    },
    update(nextOptions) {
      assertActive()
      currentOptions = {
        ...currentOptions,
        ...nextOptions,
      }
      normalizedOptions = normalizeAtmosphereOptions(currentOptions)
      if (normalizedOptions.injectStyles) {
        injectStyles(ownerDocument, normalizedOptions.styleNonce)
      }
      qualityMonitor.setup(normalizedOptions.quality === 'auto')

      syncDataset()
      syncCollisionTargets()
      ensureRenderer()
      startAnimationIfAllowed()
    },
    destroy() {
      ownerDocument.removeEventListener('visibilitychange', handleVisibilityChange)
      ownerWindow?.removeEventListener('resize', handleContainerResize)
      resizeObserver?.disconnect()
      intersectionObserver?.disconnect()
      cardIntersectionObserver?.disconnect()
      dripIntersectionObserver?.disconnect()
      removeReducedMotionListener()
      scheduler.stop()
      collisionTargetManager.destroy()
      renderer?.destroy()
      renderer = undefined
      rendererPreset = undefined
      liquidDripsController.destroy()
      cardRainController.destroy()
      glassController.destroy()
      canvasLayer?.destroy()
      canvasLayer = undefined
      setState('destroyed')
      delete element.dataset.atmosFxPreset
      delete element.dataset.atmosQuality
      delete element.dataset.atmosRenderer
    }
  }

  return controller
}
