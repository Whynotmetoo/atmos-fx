import type { NormalizedAtmosphereOptions } from '../core/types'

const OPACITY_VARIABLE = '--atoms-fx-opacity'
const MANAGED_OPAQUE_VALUE = 'managed'

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
  let options: NormalizedAtmosphereOptions | undefined

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
        element.dataset.atomsOpaque = MANAGED_OPAQUE_VALUE
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
        element.style.setProperty(OPACITY_VARIABLE, opacity)
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

  const syncDomState = () => {
    syncOpaqueSelector()
    syncOpacityElements()
  }

  const MutationObserverCtor = ownerWindow?.MutationObserver
  const mutationObserver =
    MutationObserverCtor === undefined
      ? undefined
      : new MutationObserverCtor(() => {
          syncDomState()
        })

  mutationObserver?.observe(root, {
    attributes: true,
    childList: true,
    subtree: true,
  })

  return {
    sync(nextOptions) {
      options = nextOptions
      root.dataset.atomsTransparency = nextOptions.transparency
      syncDomState()
    },
    destroy() {
      mutationObserver?.disconnect()
      clearManagedOpaqueElements()

      for (const element of trackedOpacityElements) {
        element.style.removeProperty(OPACITY_VARIABLE)
      }

      trackedOpacityElements.clear()
      delete root.dataset.atomsTransparency
    },
  }
}
