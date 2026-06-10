import { createCanvasLayer } from '../dom/canvasLayer'
import { createCollisionTargetManager } from '../dom/collisionTargets'
import { createGlassController } from '../dom/glass'
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

export function createAtmosphere(
  element: HTMLElement,
  options: AtmosphereOptions = {},
): AtmosphereController {
  if (!(element instanceof HTMLElement)) {
    throw new TypeError('createAtmosphere requires an HTMLElement root.')
  }

  const ownerDocument = element.ownerDocument
  const ownerWindow = ownerDocument.defaultView
  const reducedMotionQuery = getReducedMotionQuery()
  const glassController = createGlassController(element)
  let currentOptions: AtmosphereOptions = { ...options }
  let normalizedOptions: NormalizedAtmosphereOptions = normalizeAtmosphereOptions(currentOptions)
  let state: ControllerState = 'idle'
  let canvasLayer: CanvasLayer | undefined
  let renderer: Canvas2DRenderer | undefined
  let rendererParticle: AtmosphereParticle | undefined
  let rendererRequest: NormalizedAtmosphereOptions['renderer'] | undefined
  let visibilityPaused = false
  let reducedMotionPaused = false
  let manuallyPaused = false

  const scheduler = createAnimationScheduler((time) => {
    renderer?.render(time)
  })

  const collisionTargetManager = createCollisionTargetManager(
    element,
    normalizedOptions,
    (targets) => {
      renderer?.setCollisionTargets(targets)
    },
  )

  const assertActive = () => {
    if (state === 'destroyed') {
      throw new Error('Cannot use an atmosphere controller after destroy().')
    }
  }

  const syncDataset = () => {
    element.dataset.atomsFxPreset = normalizedOptions.preset
    element.dataset.atomsParticle = normalizedOptions.particle
    element.dataset.atomsRendererRequested = normalizedOptions.renderer

    if (renderer) {
      element.dataset.atomsRenderer = renderer.backend
    }

    glassController.sync(normalizedOptions)
  }

  const syncCollisionTargets = () => {
    renderer?.setCollisionTargets(collisionTargetManager.updateOptions(normalizedOptions))
  }

  const setState = (nextState: ControllerState) => {
    state = nextState

    if (nextState === 'destroyed') {
      delete element.dataset.atomsFx
      return
    }

    element.dataset.atomsFx = nextState
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
      renderer?.resize(size)
      renderer?.setCollisionTargets(collisionTargetManager.refresh())
    }

    return size
  }

  const ensureRenderer = () => {
    if (!canvasLayer) {
      return
    }

    const shouldRecreateRenderer =
      renderer !== undefined &&
      (rendererParticle !== normalizedOptions.particle ||
        rendererRequest !== normalizedOptions.renderer)
    const shouldRecreateCanvasLayer =
      renderer !== undefined &&
      shouldRecreateRenderer &&
      (renderer.backend === 'webgl' ||
        rendererRequest !== normalizedOptions.renderer ||
        (normalizedOptions.renderer !== 'canvas2d' && normalizedOptions.particle === 'rain'))

    if (shouldRecreateRenderer) {
      renderer?.destroy()
      renderer = undefined
      rendererParticle = undefined
      rendererRequest = undefined

      if (shouldRecreateCanvasLayer) {
        canvasLayer?.destroy()
        canvasLayer = undefined
        ensureCanvasLayer()
      }
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
      rendererRequest = normalizedOptions.renderer
      element.dataset.atomsRenderer = renderer.backend
      renderer.setCollisionTargets(collisionTargetManager.getTargets())
      return
    }

    renderer.updateOptions(normalizedOptions)
    element.dataset.atomsRenderer = renderer.backend
    renderer.setCollisionTargets(collisionTargetManager.getTargets())
  }

  const shouldReduceMotion = () =>
    normalizedOptions.respectReducedMotion && Boolean(reducedMotionQuery?.matches)

  const shouldPauseForHiddenDocument = () =>
    normalizedOptions.pauseWhenHidden && ownerDocument.hidden

  const hasAutoPause = () => visibilityPaused || reducedMotionPaused

  const refreshAutoPauseFlags = () => {
    visibilityPaused = shouldPauseForHiddenDocument()
    reducedMotionPaused = shouldReduceMotion()
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

  ownerDocument.addEventListener('visibilitychange', handleVisibilityChange)
  ownerWindow?.addEventListener('resize', handleContainerResize)
  const ResizeObserverCtor = ownerWindow?.ResizeObserver
  const resizeObserver =
    ResizeObserverCtor === undefined ? undefined : new ResizeObserverCtor(handleContainerResize)
  resizeObserver?.observe(element)
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
      syncDataset()
      syncCollisionTargets()
      ensureRenderer()
      startAnimationIfAllowed()
    },
    destroy() {
      ownerDocument.removeEventListener('visibilitychange', handleVisibilityChange)
      ownerWindow?.removeEventListener('resize', handleContainerResize)
      resizeObserver?.disconnect()
      removeReducedMotionListener()
      scheduler.stop()
      collisionTargetManager.destroy()
      renderer?.destroy()
      renderer = undefined
      rendererParticle = undefined
      rendererRequest = undefined
      glassController.destroy()
      canvasLayer?.destroy()
      canvasLayer = undefined
      setState('destroyed')
      delete element.dataset.atomsFxPreset
      delete element.dataset.atomsParticle
      delete element.dataset.atomsRenderer
      delete element.dataset.atomsRendererRequested
    },
  }

  return controller
}
