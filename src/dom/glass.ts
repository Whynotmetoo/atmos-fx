import type { NormalizedAtmosphereOptions } from '../core/types'

const OPACITY_VARIABLE = '--atmos-fx-opacity'
const ALPHA_VARIABLE = '--atmos-fx-alpha'
const OBSERVED_ATTRIBUTES = ['data-atmos-opacity', 'data-atmos-alpha']

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

  const observeOptions: MutationObserverInit = {
    attributes: true,
    attributeFilter: OBSERVED_ATTRIBUTES,
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
    syncOpacityElements()
    syncAlphaElements()
  }

  const MutationObserverCtor = ownerWindow?.MutationObserver
  const mutationObserver =
    MutationObserverCtor === undefined
      ? undefined
      : new MutationObserverCtor(() => {
          syncDomState()
        })

  mutationObserver?.observe(root, observeOptions)

  return {
    sync(nextOptions) {
      root.style.setProperty(OPACITY_VARIABLE, String(nextOptions.opacity))
      root.style.setProperty(ALPHA_VARIABLE, String(nextOptions.alpha))
      syncDomState()
    },
    destroy() {
      mutationObserver?.disconnect()

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
