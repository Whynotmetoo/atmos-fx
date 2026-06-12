import type { NormalizedAtmosphereOptions } from '../core/types'

const OPACITY_VARIABLE = '--atmos-fx-opacity'
const CONTENT_OPACITY_VARIABLE = '--atmos-fx-content-opacity'
const SURFACE_OPACITY_VARIABLE = '--atmos-fx-surface-opacity'
const MANAGED_OPAQUE_VALUE = 'managed'
const MANAGED_CONTAINS_OPAQUE_VALUE = 'managed'

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
  const managedOpaqueElements = new Set<HTMLElement>()
  const managedOpaqueContainerElements = new Set<HTMLElement>()
  let options: NormalizedAtmosphereOptions | undefined
  let observing = false

  const observeOptions: MutationObserverInit = {
    attributes: true,
    childList: true,
    subtree: true,
  }

  const clearManagedOpaqueElements = (nextElements = new Set<HTMLElement>()) => {
    for (const element of managedOpaqueElements) {
      if (!nextElements.has(element) && element.dataset.atmosOpaque === MANAGED_OPAQUE_VALUE) {
        delete element.dataset.atmosOpaque
      }
    }

    if (nextElements.size === 0) {
      managedOpaqueElements.clear()
      return
    }

    for (const element of Array.from(managedOpaqueElements)) {
      if (!nextElements.has(element)) {
        managedOpaqueElements.delete(element)
      }
    }
  }

  const syncOpaqueSelector = () => {
    if (!options?.opaqueSelector) {
      clearManagedOpaqueElements()
      return
    }

    const nextElements = new Set<HTMLElement>()

    for (const element of root.querySelectorAll(options.opaqueSelector)) {
      if (!(element instanceof HTMLElement)) {
        continue
      }

      managedOpaqueElements.add(element)

      if (element.dataset.atmosOpaque === undefined) {
        if (element.dataset.atmosOpaque !== MANAGED_OPAQUE_VALUE) {
          element.dataset.atmosOpaque = MANAGED_OPAQUE_VALUE
        }
      }

      if (element.dataset.atmosOpaque === MANAGED_OPAQUE_VALUE) {
        nextElements.add(element)
      }
    }

    clearManagedOpaqueElements(nextElements)
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

  const syncOpaqueContainers = () => {
    const nextElements = new Set<HTMLElement>()

    for (const element of Array.from(root.children)) {
      if (
        !(element instanceof HTMLElement) ||
        element.dataset.atmosLayer !== undefined ||
        element.dataset.atmosOpaque !== undefined
      ) {
        continue
      }

      if (element.querySelector('[data-atmos-opaque]')) {
        if (element.dataset.atmosContainsOpaque !== MANAGED_CONTAINS_OPAQUE_VALUE) {
          element.dataset.atmosContainsOpaque = MANAGED_CONTAINS_OPAQUE_VALUE
        }
        nextElements.add(element)
      }
    }

    for (const element of managedOpaqueContainerElements) {
      if (
        !nextElements.has(element) &&
        element.dataset.atmosContainsOpaque === MANAGED_CONTAINS_OPAQUE_VALUE
      ) {
        delete element.dataset.atmosContainsOpaque
      }
    }

    managedOpaqueContainerElements.clear()

    for (const element of nextElements) {
      managedOpaqueContainerElements.add(element)
    }
  }

  const syncDomState = () => {
    stopObserving()
    syncOpaqueSelector()
    syncOpacityElements()
    syncOpaqueContainers()
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
      options = nextOptions
      root.dataset.atmosTransparency = nextOptions.transparency
      root.style.setProperty(CONTENT_OPACITY_VARIABLE, String(nextOptions.contentOpacity))
      root.style.setProperty(SURFACE_OPACITY_VARIABLE, String(nextOptions.surfaceOpacity))
      syncDomState()
    },
    destroy() {
      stopObserving()
      clearManagedOpaqueElements()

      for (const element of trackedOpacityElements) {
        element.style.removeProperty(OPACITY_VARIABLE)
      }

      for (const element of managedOpaqueContainerElements) {
        if (element.dataset.atmosContainsOpaque === MANAGED_CONTAINS_OPAQUE_VALUE) {
          delete element.dataset.atmosContainsOpaque
        }
      }

      trackedOpacityElements.clear()
      managedOpaqueContainerElements.clear()
      root.style.removeProperty(CONTENT_OPACITY_VARIABLE)
      root.style.removeProperty(SURFACE_OPACITY_VARIABLE)
      delete root.dataset.atmosTransparency
    },
  }
}
