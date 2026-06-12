import type { NormalizedAtmosphereOptions } from '../core/types'

export type CollisionTargetRect = {
  x: number
  y: number
  width: number
  height: number
  right: number
  bottom: number
}

export type CollisionTargetManager = {
  refresh(): readonly CollisionTargetRect[]
  updateOptions(options: NormalizedAtmosphereOptions): readonly CollisionTargetRect[]
  getTargets(): readonly CollisionTargetRect[]
  destroy(): void
}

const SCHEDULE_FALLBACK_DELAY = 50

function toRootRelativeRect(rootRect: DOMRect, targetRect: DOMRect): CollisionTargetRect {
  const x = targetRect.left - rootRect.left
  const y = targetRect.top - rootRect.top
  const width = Math.max(0, targetRect.width)
  const height = Math.max(0, targetRect.height)

  return {
    x,
    y,
    width,
    height,
    right: x + width,
    bottom: y + height,
  }
}

function getScrollableWindow(root: HTMLElement): (Window & typeof globalThis) | undefined {
  return root.ownerDocument.defaultView ?? undefined
}

export function collectCollisionTargetRects(
  root: HTMLElement,
  selector: string,
): CollisionTargetRect[] {
  const rootRect = root.getBoundingClientRect()
  const targets: CollisionTargetRect[] = []

  for (const target of root.querySelectorAll(selector)) {
    if (!(target instanceof HTMLElement) || target.dataset.atomsLayer !== undefined) {
      continue
    }

    const targetRect = target.getBoundingClientRect()

    if (targetRect.width <= 0 || targetRect.height <= 0) {
      continue
    }

    targets.push(toRootRelativeRect(rootRect, targetRect))
  }

  return targets
}

export function createCollisionTargetManager(
  root: HTMLElement,
  options: NormalizedAtmosphereOptions,
  onChange?: (targets: readonly CollisionTargetRect[]) => void,
): CollisionTargetManager {
  const ownerWindow = getScrollableWindow(root)
  const ResizeObserverCtor = ownerWindow?.ResizeObserver
  const MutationObserverCtor = ownerWindow?.MutationObserver
  let currentOptions = options
  let targets: CollisionTargetRect[] = []
  let observedTargets = new Set<HTMLElement>()
  let scheduled = false
  let destroyed = false
  let animationFrameId: number | undefined
  let timeoutId: number | undefined

  const notify = () => {
    onChange?.(targets)
  }

  const refresh = () => {
    if (destroyed) {
      return targets
    }

    scheduled = false
    targets = collectCollisionTargetRects(root, currentOptions.collisionSelector)

    if (resizeObserver) {
      const nextObservedTargets = new Set<HTMLElement>()

      for (const target of root.querySelectorAll(currentOptions.collisionSelector)) {
        if (!(target instanceof HTMLElement) || target.dataset.atomsLayer !== undefined) {
          continue
        }

        nextObservedTargets.add(target)

        if (!observedTargets.has(target)) {
          resizeObserver.observe(target)
        }
      }

      for (const target of observedTargets) {
        if (!nextObservedTargets.has(target)) {
          resizeObserver.unobserve(target)
        }
      }

      observedTargets = nextObservedTargets
    }

    notify()
    return targets
  }

  const scheduleRefresh = () => {
    if (destroyed || scheduled) {
      return
    }

    scheduled = true

    if (ownerWindow?.requestAnimationFrame) {
      animationFrameId = ownerWindow.requestAnimationFrame(() => {
        animationFrameId = undefined
        refresh()
      })
      return
    }

    timeoutId = ownerWindow?.setTimeout(() => {
      refresh()
    }, SCHEDULE_FALLBACK_DELAY)
  }

  const resizeObserver =
    ResizeObserverCtor === undefined
      ? undefined
      : new ResizeObserverCtor(() => {
          scheduleRefresh()
        })

  const mutationObserver =
    MutationObserverCtor === undefined
      ? undefined
      : new MutationObserverCtor((mutations) => {
          const hasSignificantMutation = mutations.some((mutation) => {
            const target = mutation.target as HTMLElement
            if (target && typeof target.closest === 'function') {
              return !target.closest('[data-atoms-layer]')
            }
            return true
          })

          if (hasSignificantMutation) {
            scheduleRefresh()
          }
        })

  resizeObserver?.observe(root)
  mutationObserver?.observe(root, {
    attributes: true,
    childList: true,
    subtree: true,
  })

  ownerWindow?.addEventListener('resize', scheduleRefresh)
  ownerWindow?.addEventListener('scroll', scheduleRefresh, true)

  return {
    refresh,
    updateOptions(nextOptions) {
      currentOptions = nextOptions
      return refresh()
    },
    getTargets() {
      return targets
    },
    destroy() {
      destroyed = true
      resizeObserver?.disconnect()
      mutationObserver?.disconnect()
      ownerWindow?.removeEventListener('resize', scheduleRefresh)
      ownerWindow?.removeEventListener('scroll', scheduleRefresh, true)

      if (animationFrameId !== undefined) {
        ownerWindow?.cancelAnimationFrame(animationFrameId)
      }

      if (timeoutId !== undefined) {
        ownerWindow?.clearTimeout(timeoutId)
      }

      targets = []
      observedTargets.clear()
    },
  }
}
