import { createCanvasLayer } from '../dom/canvasLayer'
import { normalizeAtmosphereOptions } from './options'
import { createAnimationScheduler } from './scheduler'
import type {
  AtmosphereController,
  AtmosphereOptions,
  NormalizedAtmosphereOptions,
} from './types'
import type { CanvasLayer } from '../dom/canvasLayer'

type ControllerState = 'idle' | 'running' | 'paused' | 'stopped' | 'destroyed'

function getReducedMotionQuery(): MediaQueryList | undefined {
  if (typeof window === 'undefined' || !window.matchMedia) {
    return undefined
  }

  return window.matchMedia('(prefers-reduced-motion: reduce)')
}

export function createAtmosphere(
  element: HTMLElement,
  options: AtmosphereOptions = {},
): AtmosphereController {
  if (!(element instanceof HTMLElement)) {
    throw new TypeError('createAtmosphere requires an HTMLElement root.')
  }

  const ownerDocument = element.ownerDocument
  const reducedMotionQuery = getReducedMotionQuery()
  let normalizedOptions: NormalizedAtmosphereOptions = normalizeAtmosphereOptions(options)
  let state: ControllerState = 'idle'
  let canvasLayer: CanvasLayer | undefined
  let visibilityPaused = false
  let reducedMotionPaused = false

  const scheduler = createAnimationScheduler(() => {
    canvasLayer?.resize()
  })

  const assertActive = () => {
    if (state === 'destroyed') {
      throw new Error('Cannot use an atmosphere controller after destroy().')
    }
  }

  const syncDataset = () => {
    element.dataset.atomsFxPreset = normalizedOptions.preset
    element.dataset.atomsTransparency = normalizedOptions.transparency
    element.dataset.atomsParticle = normalizedOptions.particle
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

    canvasLayer.resize()
  }

  const shouldReduceMotion = () =>
    normalizedOptions.respectReducedMotion && Boolean(reducedMotionQuery?.matches)

  const shouldPauseForHiddenDocument = () =>
    normalizedOptions.pauseWhenHidden && ownerDocument.hidden

  const startAnimationIfAllowed = () => {
    if (state !== 'running') {
      scheduler.stop()
      return
    }

    if (shouldReduceMotion() || shouldPauseForHiddenDocument()) {
      scheduler.stop()
      setState('paused')
      reducedMotionPaused = shouldReduceMotion()
      visibilityPaused = shouldPauseForHiddenDocument()
      return
    }

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

      if (!reducedMotionPaused) {
        setState('running')
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

      if (!visibilityPaused) {
        setState('running')
        startAnimationIfAllowed()
      }
    }
  }

  ownerDocument.addEventListener('visibilitychange', handleVisibilityChange)
  reducedMotionQuery?.addEventListener('change', handleReducedMotionChange)

  const controller: AtmosphereController = {
    start() {
      assertActive()
      ensureCanvasLayer()
      syncDataset()
      setState('running')
      startAnimationIfAllowed()
    },
    stop() {
      assertActive()
      visibilityPaused = false
      reducedMotionPaused = false
      scheduler.stop()
      setState('stopped')
    },
    pause() {
      assertActive()
      if (state === 'running') {
        scheduler.stop()
        setState('paused')
      }
    },
    resume() {
      assertActive()
      if (state === 'paused') {
        visibilityPaused = false
        reducedMotionPaused = false
        setState('running')
        startAnimationIfAllowed()
      }
    },
    resize() {
      assertActive()
      canvasLayer?.resize()
    },
    update(nextOptions) {
      assertActive()
      normalizedOptions = normalizeAtmosphereOptions({
        ...normalizedOptions,
        ...nextOptions,
      })
      syncDataset()
      startAnimationIfAllowed()
    },
    destroy() {
      ownerDocument.removeEventListener('visibilitychange', handleVisibilityChange)
      reducedMotionQuery?.removeEventListener('change', handleReducedMotionChange)
      scheduler.stop()
      canvasLayer?.destroy()
      canvasLayer = undefined
      setState('destroyed')
      delete element.dataset.atomsFxPreset
      delete element.dataset.atomsTransparency
      delete element.dataset.atomsParticle
    },
  }

  return controller
}
