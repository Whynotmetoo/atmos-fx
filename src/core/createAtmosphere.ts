import { normalizeAtmosphereOptions } from './options'
import type {
  AtmosphereController,
  AtmosphereOptions,
  NormalizedAtmosphereOptions,
} from './types'

type ControllerState = 'idle' | 'running' | 'paused' | 'stopped' | 'destroyed'

export function createAtmosphere(
  element: HTMLElement,
  options: AtmosphereOptions = {},
): AtmosphereController {
  if (!(element instanceof HTMLElement)) {
    throw new TypeError('createAtmosphere requires an HTMLElement root.')
  }

  let normalizedOptions: NormalizedAtmosphereOptions = normalizeAtmosphereOptions(options)
  let state: ControllerState = 'idle'

  const assertActive = () => {
    if (state === 'destroyed') {
      throw new Error('Cannot use an atmosphere controller after destroy().')
    }
  }

  const syncDataset = () => {
    element.dataset.atomsFxPreset = normalizedOptions.preset
    element.dataset.atomsTransparency = normalizedOptions.transparency
  }

  return {
    start() {
      assertActive()
      state = 'running'
      element.dataset.atomsFx = 'running'
      syncDataset()
    },
    stop() {
      assertActive()
      state = 'stopped'
      element.dataset.atomsFx = 'stopped'
    },
    pause() {
      assertActive()
      if (state === 'running') {
        state = 'paused'
        element.dataset.atomsFx = 'paused'
      }
    },
    resume() {
      assertActive()
      if (state === 'paused') {
        state = 'running'
        element.dataset.atomsFx = 'running'
      }
    },
    resize() {
      assertActive()
    },
    update(nextOptions) {
      assertActive()
      normalizedOptions = normalizeAtmosphereOptions({
        ...normalizedOptions,
        ...nextOptions,
      })
      syncDataset()
    },
    destroy() {
      state = 'destroyed'
      delete element.dataset.atomsFx
      delete element.dataset.atomsFxPreset
      delete element.dataset.atomsTransparency
    },
  }
}
