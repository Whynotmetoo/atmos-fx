import { createCanvasLayer } from '../dom/canvasLayer'
import { createCollisionTargetManager } from '../dom/collisionTargets'
import { createGlassController } from '../dom/glass'
import { createLiquidDripsController } from '../dom/liquid'
import { createRenderer } from '../renderers/createRenderer'
import { normalizeAtmosphereOptions } from './options'
import { createAnimationScheduler } from './scheduler'
import type {
  AtmosphereController,
  AtmosphereParticle,
  AtmosphereOptions,
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
    --atmos-fx-content-opacity: 0.72;
    --atmos-fx-surface-opacity: 0.14;
    --atmos-fx-glass-strong-opacity: calc(var(--atmos-fx-surface-opacity) + 0.08);
    --atmos-fx-glass-strong: rgb(255 255 255 / var(--atmos-fx-glass-strong-opacity));
    --atmos-fx-glass-base: rgb(255 255 255 / var(--atmos-fx-surface-opacity));
    --atmos-fx-glass-background: linear-gradient(145deg, var(--atmos-fx-glass-strong), rgb(255 255 255 / calc(var(--atmos-fx-surface-opacity) * 0.58))), var(--atmos-fx-glass-base);
    --atmos-fx-glass-border: rgb(255 255 255 / 0.24);
    --atmos-fx-glass-shadow: 0 24px 60px rgb(14 22 32 / 0.34), inset 0 -48px 80px rgb(255 255 255 / 0.04);
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
    z-index: 0;
  }
  [data-atmos-layer='weather-foreground'] {
    z-index: 3;
  }
  [data-atmos-layer='liquid'] {
    z-index: 4;
  }
  [data-atmos-fx] :where([data-atmos-glass], [data-atmos-opaque], [data-atmos-opacity], [data-atmos-collision]) {
    position: relative;
    z-index: 2;
  }
  [data-atmos-fx][data-atmos-transparency='glass'] :where([data-atmos-glass]) {
    background: rgb(255 255 255 / 0.14);
    background: var(--atmos-fx-glass-background);
    border: 1px solid rgb(255 255 255 / 0.24);
    border: 1px solid var(--atmos-fx-glass-border);
    box-shadow: var(--atmos-fx-glass-shadow);
    backdrop-filter: blur(8px) saturate(1.25);
    -webkit-backdrop-filter: blur(8px) saturate(1.25);
  }
  [data-atmos-fx] :where([data-atmos-opacity]) {
    opacity: var(--atmos-fx-opacity, var(--atmos-fx-content-opacity));
  }
  [data-atmos-fx] :where([data-atmos-opaque]) {
    opacity: 1;
    box-shadow: none;
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
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
  let state: ControllerState = 'idle'
  let canvasLayer: CanvasLayer | undefined
  let renderer: Canvas2DRenderer | undefined
  let rendererParticle: AtmosphereParticle | undefined
  let visibilityPaused = false
  let reducedMotionPaused = false
  let intersectionPaused = false
  let isIntersecting = true
  let manuallyPaused = false
  let lastTime: number | undefined

  const scheduler = createAnimationScheduler((time) => {
    const deltaSeconds =
      lastTime === undefined
        ? 1 / 60
        : Math.min(0.05, Math.max(0, (time - lastTime) / 1000))
    lastTime = time

    renderer?.render(time)
    liquidDripsController.update(deltaSeconds)
  })

  const collisionTargetManager = createCollisionTargetManager(
    element,
    normalizedOptions,
    (targets) => {
      renderer?.setCollisionTargets(targets)
      liquidDripsController.sync(normalizedOptions, targets)
    },
  )

  const assertActive = () => {
    if (state === 'destroyed') {
      throw new Error('Cannot use an atmosphere controller after destroy().')
    }
  }

  const syncDataset = () => {
    element.dataset.atmosFxPreset = normalizedOptions.preset
    element.dataset.atmosParticle = normalizedOptions.particle

    if (renderer) {
      element.dataset.atmosRenderer = renderer.backend
    }

    glassController.sync(normalizedOptions)
  }

  const syncCollisionTargets = () => {
    const targets = collisionTargetManager.updateOptions(normalizedOptions)
    renderer?.setCollisionTargets(targets)
    liquidDripsController.sync(normalizedOptions, targets)
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

    return canvasLayer.resize()
  }

  const resizeLayerAndRenderer = () => {
    const size = canvasLayer?.resize()

    if (size) {
      const targets = collisionTargetManager.refresh()
      renderer?.resize(size)
      renderer?.setCollisionTargets(targets)
      liquidDripsController.sync(normalizedOptions, targets)
    }

    return size
  }

  const ensureRenderer = () => {
    if (!canvasLayer) {
      return
    }

    const shouldRecreateRenderer =
      renderer !== undefined &&
      rendererParticle !== normalizedOptions.particle

    if (shouldRecreateRenderer) {
      renderer?.destroy()
      renderer = undefined
      rendererParticle = undefined

      canvasLayer?.destroy()
      canvasLayer = undefined
      ensureCanvasLayer()
    }

    const activeCanvasLayer = canvasLayer

    if (!activeCanvasLayer) {
      return
    }

    if (!renderer) {
      renderer = createRenderer(
        {
          background: activeCanvasLayer.backgroundCanvas,
          foreground: activeCanvasLayer.foregroundCanvas,
        },
        activeCanvasLayer.getSize(),
        normalizedOptions,
      )
      rendererParticle = normalizedOptions.particle
      element.dataset.atmosRenderer = renderer.backend
      renderer.setCollisionTargets(collisionTargetManager.getTargets())
      return
    }

    renderer.updateOptions(normalizedOptions)
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
      return
    }

    refreshAutoPauseFlags()

    if (hasAutoPause()) {
      scheduler.stop()
      setState('paused')
      return
    }

    setState('running')
    scheduler.start()
  }

  const handleVisibilityChange = () => {
    if (!normalizedOptions.pauseWhenHidden || state === 'destroyed' || state === 'stopped') {
      return
    }

    if (ownerDocument.hidden && state === 'running') {
      visibilityPaused = true
      scheduler.stop()
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
      liquidDripsController.sync(normalizedOptions, [])
      lastTime = undefined
      setState('stopped')
    },
    pause() {
      assertActive()
      if (state === 'running') {
        manuallyPaused = true
        visibilityPaused = false
        reducedMotionPaused = false
        scheduler.stop()
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
      removeReducedMotionListener()
      scheduler.stop()
      collisionTargetManager.destroy()
      renderer?.destroy()
      renderer = undefined
      rendererParticle = undefined
      liquidDripsController.destroy()
      glassController.destroy()
      canvasLayer?.destroy()
      canvasLayer = undefined
      setState('destroyed')
      delete element.dataset.atmosFxPreset
      delete element.dataset.atmosParticle
      delete element.dataset.atmosRenderer
    }
  }

  return controller
}
