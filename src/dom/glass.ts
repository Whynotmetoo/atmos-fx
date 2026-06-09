import type { NormalizedAtmosphereOptions } from '../core/types'

const OPACITY_VARIABLE = '--atoms-fx-opacity'
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
      if (!nextElements.has(element) && element.dataset.atomsOpaque === MANAGED_OPAQUE_VALUE) {
        delete element.dataset.atomsOpaque
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

      if (element.dataset.atomsOpaque === undefined) {
        if (element.dataset.atomsOpaque !== MANAGED_OPAQUE_VALUE) {
          element.dataset.atomsOpaque = MANAGED_OPAQUE_VALUE
        }
      }

      if (element.dataset.atomsOpaque === MANAGED_OPAQUE_VALUE) {
        nextElements.add(element)
      }
    }

    clearManagedOpaqueElements(nextElements)
  }

  const syncOpacityElements = () => {
    const nextElements = new Set<HTMLElement>()

    for (const element of root.querySelectorAll('[data-atoms-opacity]')) {
      if (!(element instanceof HTMLElement)) {
        continue
      }

      nextElements.add(element)
      const opacity = clampOpacity(element.dataset.atomsOpacity ?? '')

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
        element.dataset.atomsLayer !== undefined ||
        element.dataset.atomsOpaque !== undefined
      ) {
        continue
      }

      if (element.querySelector('[data-atoms-opaque]')) {
        if (element.dataset.atomsContainsOpaque !== MANAGED_CONTAINS_OPAQUE_VALUE) {
          element.dataset.atomsContainsOpaque = MANAGED_CONTAINS_OPAQUE_VALUE
        }
        nextElements.add(element)
      }
    }

    for (const element of managedOpaqueContainerElements) {
      if (
        !nextElements.has(element) &&
        element.dataset.atomsContainsOpaque === MANAGED_CONTAINS_OPAQUE_VALUE
      ) {
        delete element.dataset.atomsContainsOpaque
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
      root.dataset.atomsTransparency = nextOptions.transparency
      syncDomState()
    },
    destroy() {
      stopObserving()
      clearManagedOpaqueElements()

      for (const element of trackedOpacityElements) {
        element.style.removeProperty(OPACITY_VARIABLE)
      }

      for (const element of managedOpaqueContainerElements) {
        if (element.dataset.atomsContainsOpaque === MANAGED_CONTAINS_OPAQUE_VALUE) {
          delete element.dataset.atomsContainsOpaque
        }
      }

      trackedOpacityElements.clear()
      managedOpaqueContainerElements.clear()
      delete root.dataset.atomsTransparency
    },
  }
}
