import type { NormalizedAtmosphereOptions } from '../core/types'

const OPACITY_VARIABLE = '--atmos-fx-opacity'
const ALPHA_VARIABLE = '--atmos-fx-alpha'

function clampOpacity(value: string): string | undefined {
  const parsed = Number.parseFloat(value)

  if (Number.isNaN(parsed)) {
    return undefined
  }

  return String(Math.min(1, Math.max(0, parsed)))
}

export type GlassController = {
  sync(options: NormalizedAtmosphereOptions): void
  destroy(): void
}

export function createGlassController(root: HTMLElement): GlassController {
  const ownerWindow = root.ownerDocument.defaultView
  const trackedOpacityElements = new Set<HTMLElement>()
  const trackedAlphaElements = new Set<HTMLElement>()
  let observing = false

  const observeOptions: MutationObserverInit = {
    attributes: true,
    childList: true,
    subtree: true,
  }

  const syncOpacityElements = () => {
    const nextElements = new Set<HTMLElement>()

    for (const element of root.querySelectorAll('[data-atmos-opacity]')) {
      if (!(element instanceof HTMLElement)) {
        continue
      }

      nextElements.add(element)
      const opacity = clampOpacity(element.dataset.atmosOpacity ?? '')

      if (opacity === undefined) {
        element.style.removeProperty(OPACITY_VARIABLE)
      } else {
        if (element.style.getPropertyValue(OPACITY_VARIABLE) !== opacity) {
          element.style.setProperty(OPACITY_VARIABLE, opacity)
        }
      }
    }

    for (const element of trackedOpacityElements) {
      if (!nextElements.has(element)) {
        element.style.removeProperty(OPACITY_VARIABLE)
      }
    }

    trackedOpacityElements.clear()

    for (const element of nextElements) {
      trackedOpacityElements.add(element)
    }
  }

  const syncAlphaElements = () => {
    const nextElements = new Set<HTMLElement>()

    for (const element of root.querySelectorAll('[data-atmos-alpha]')) {
      if (!(element instanceof HTMLElement)) {
        continue
      }

      nextElements.add(element)
      const alpha = clampOpacity(element.dataset.atmosAlpha ?? '')

      if (alpha === undefined) {
        element.style.removeProperty(ALPHA_VARIABLE)
      } else {
        if (element.style.getPropertyValue(ALPHA_VARIABLE) !== alpha) {
          element.style.setProperty(ALPHA_VARIABLE, alpha)
        }
      }
    }

    for (const element of trackedAlphaElements) {
      if (!nextElements.has(element)) {
        element.style.removeProperty(ALPHA_VARIABLE)
      }
    }

    trackedAlphaElements.clear()

    for (const element of nextElements) {
      trackedAlphaElements.add(element)
    }
  }

  const syncDomState = () => {
    stopObserving()
    syncOpacityElements()
    syncAlphaElements()
    startObserving()
  }

  const MutationObserverCtor = ownerWindow?.MutationObserver
  const mutationObserver =
    MutationObserverCtor === undefined
      ? undefined
      : new MutationObserverCtor(() => {
          syncDomState()
        })

  const startObserving = () => {
    if (!mutationObserver || observing) {
      return
    }

    mutationObserver.observe(root, observeOptions)
    observing = true
  }

  const stopObserving = () => {
    if (!mutationObserver || !observing) {
      return
    }

    mutationObserver.disconnect()
    observing = false
  }

  startObserving()

  return {
    sync(nextOptions) {
      root.style.setProperty(OPACITY_VARIABLE, String(nextOptions.opacity))
      root.style.setProperty(ALPHA_VARIABLE, String(nextOptions.alpha))
      syncDomState()
    },
    destroy() {
      stopObserving()

      for (const element of trackedOpacityElements) {
        element.style.removeProperty(OPACITY_VARIABLE)
      }
      for (const element of trackedAlphaElements) {
        element.style.removeProperty(ALPHA_VARIABLE)
      }

      trackedOpacityElements.clear()
      trackedAlphaElements.clear()
      root.style.removeProperty(OPACITY_VARIABLE)
      root.style.removeProperty(ALPHA_VARIABLE)
    },
  }
}
