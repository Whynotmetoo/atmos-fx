import { RainEffect } from './rain-card'
import type { NormalizedAtmosphereOptions } from '../core/types'
import type { CollisionTargetRect } from './collisionTargets'

/** Layer attribute so we can skip our own canvases during collision detection. */
const LAYER_ATTR = 'data-atmos-layer'
const LAYER_VALUE = 'card-rain'

interface CardEntry {
  element: HTMLElement
  canvas:  HTMLCanvasElement
  effect:  RainEffect | null
  isIntersectingCard: boolean
  isIntersectingDrips: boolean
}

export type CardRainController = {
  sync(options: NormalizedAtmosphereOptions, targets: readonly CollisionTargetRect[]): void
  pause(): void
  resume(): void
  resize(): void
  destroy(): void
}

function isOptedIn(el: HTMLElement, width: number, height: number): boolean {
  const tag = el.tagName.toUpperCase()
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
    return false
  }
  return el.hasAttribute('data-atmos-glass') &&
         !el.hasAttribute('data-atmos-solid') &&
         width >= 100 &&
         height >= 80
}


/**
 * Manages per-card WebGL water-drop canvases.
 *
 * Layer model:
 *   <card [data-atmos-glass]>
 *     <canvas data-atmos-layer="card-rain" />   ← z-index: -1, behind card content
 *     (card children)
 *   </card>
 */
export function createCardRainController(_root: HTMLElement): CardRainController {
  const entries = new Map<HTMLElement, CardEntry>()
  if (typeof window !== 'undefined') {
    if (!(window as any).__cardRainControllers) {
      ;(window as any).__cardRainControllers = []
    }
    ;(window as any).__cardRainControllers.push(entries)
  }
  let active = true    // mirrors running state of parent scheduler
  let isRain = false   // only operate in rain preset
  let runEffect = false
  let initTimerId: number | null = null

  function scheduleInitialization(): void {
    if (initTimerId !== null) return

    const tick = () => {
      let nextEntry: CardEntry | null = null
      for (const [_, entry] of entries) {
        if (entry.effect === null) {
          nextEntry = entry
          break
        }
      }

      if (nextEntry) {
        nextEntry.effect = new RainEffect(nextEntry.canvas, { autoStart: false, maxPixelRatio: 1.0 })
        const shouldRun = runEffect && nextEntry.isIntersectingCard
        if (shouldRun) {
          nextEntry.effect.start()
        }
        initTimerId = requestAnimationFrame(tick)
      } else {
        initTimerId = null
      }
    }

    initTimerId = requestAnimationFrame(tick)
  }

  function addCard(el: HTMLElement): void {
    if (entries.has(el)) return

    const canvas = el.ownerDocument.createElement('canvas')
    canvas.setAttribute(LAYER_ATTR, LAYER_VALUE)
    canvas.setAttribute('aria-hidden', 'true')

    // Prepend canvas so it sits behind card content
    if (el.firstChild) {
      el.insertBefore(canvas, el.firstChild)
    } else {
      el.appendChild(canvas)
    }

    entries.set(el, { element: el, canvas, effect: null, isIntersectingCard: true, isIntersectingDrips: true })
    scheduleInitialization()
  }

  function removeCard(entry: CardEntry): void {
    entry.element.removeAttribute('data-atmos-card-fx')
    if (entry.effect) {
      entry.effect.destroy()
    }
    entry.canvas.parentNode?.removeChild(entry.canvas)
  }

  return {
    sync(options, targets) {
      isRain = options.preset === 'rain'
      const isHighQuality = options.quality === 'high'
      runEffect = isRain && isHighQuality && active

      // Build set of opted-in elements from current collision targets
      const nextElements = new Set<HTMLElement>()
      if (runEffect) {
        for (const t of targets) {
          if (t.element && isOptedIn(t.element, t.width, t.height)) {
            nextElements.add(t.element)
          }
        }
      }

      // Add new cards
      for (const el of nextElements) {
        addCard(el)
      }

      // Remove stale cards
      for (const [el, entry] of entries) {
        if (!nextElements.has(el)) {
          removeCard(entry)
          entries.delete(el)
        }
      }

      // Start/stop based on preset
      for (const [el, entry] of entries) {
        if (entry.effect) {
          entry.effect.setDensity(options.density)
        }
        const target = targets.find(t => t.element === el)
        const isIntersectingCard = target ? target.isIntersectingCard !== false : true
        const isIntersectingDrips = target ? target.isIntersectingDrips !== false : true

        entry.isIntersectingCard = isIntersectingCard
        entry.isIntersectingDrips = isIntersectingDrips

        const shouldRun = runEffect && isIntersectingCard
        if (entry.effect) {
          if (shouldRun) {
            entry.effect.start()
          } else {
            entry.effect.stop()
          }
        }

        const isCardRainRunning = shouldRun
        const isDripsRunning = options.preset === 'rain' && options.liquidDripping && isIntersectingDrips

        if (active && (isCardRainRunning || isDripsRunning)) {
          el.setAttribute('data-atmos-card-fx', 'running')
        } else {
          el.setAttribute('data-atmos-card-fx', active ? 'paused' : 'stopped')
        }
      }
    },

    pause() {
      active = false
      runEffect = false
      for (const [el, e] of entries) {
        e.effect?.stop()
        el.setAttribute('data-atmos-card-fx', 'stopped')
      }
    },

    resume() {
      active = true
      runEffect = isRain
      if (isRain) {
        for (const [el, e] of entries) {
          if (e.isIntersectingCard) {
            e.effect?.start()
          }
          const isCardRainRunning = e.isIntersectingCard
          const isDripsRunning = e.isIntersectingDrips
          if (isCardRainRunning || isDripsRunning) {
            el.setAttribute('data-atmos-card-fx', 'running')
          } else {
            el.setAttribute('data-atmos-card-fx', 'paused')
          }
        }
      }
    },

    resize() {
      for (const e of entries.values()) {
        e.effect?.resize()
      }
    },

    destroy() {
      active = false
      runEffect = false
      if (initTimerId !== null) {
        cancelAnimationFrame(initTimerId)
        initTimerId = null
      }
      for (const e of entries.values()) removeCard(e)
      entries.clear()
    },
  }
}
