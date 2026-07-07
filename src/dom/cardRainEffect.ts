import { RainEffect } from './rain-card'
import type { NormalizedAtmosphereOptions } from '../core/types'
import type { CollisionTargetRect } from './collisionTargets'

/** Layer attribute so we can skip our own canvases during collision detection. */
const LAYER_ATTR = 'data-atmos-layer'
const LAYER_VALUE = 'card-rain'

interface CardEntry {
  element: HTMLElement
  canvas:  HTMLCanvasElement
  effect:  RainEffect
}

export type CardRainController = {
  sync(options: NormalizedAtmosphereOptions, targets: readonly CollisionTargetRect[]): void
  pause(): void
  resume(): void
  resize(): void
  destroy(): void
}

function isOptedIn(el: HTMLElement): boolean {
  return el.hasAttribute('data-atmos-glass') && !el.hasAttribute('data-atmos-solid')
}

function getPadding(el: HTMLElement) {
  const style = el.ownerDocument.defaultView?.getComputedStyle(el)
  return {
    left:   parseFloat(style?.paddingLeft   || '0') || 0,
    right:  parseFloat(style?.paddingRight  || '0') || 0,
    top:    parseFloat(style?.paddingTop    || '0') || 0,
    bottom: parseFloat(style?.paddingBottom || '0') || 0,
  }
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

    const effect = new RainEffect(canvas, { autoStart: false })
    effect.setPadding(getPadding(el))

    entries.set(el, { element: el, canvas, effect })
  }

  function removeCard(entry: CardEntry): void {
    entry.effect.destroy()
    entry.canvas.parentNode?.removeChild(entry.canvas)
  }

  return {
    sync(options, targets) {
      isRain = options.preset === 'rain'
      const isLowQuality = options.quality === 'low'
      const runEffect = isRain && !isLowQuality && active

      // Build set of opted-in elements from current collision targets
      const nextElements = new Set<HTMLElement>()
      if (runEffect) {
        for (const t of targets) {
          if (t.element && isOptedIn(t.element)) {
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
      for (const entry of entries.values()) {
        entry.effect.setPadding(getPadding(entry.element))
        entry.effect.setDensity(options.density)
        if (runEffect) {
          entry.effect.start()
        } else {
          entry.effect.stop()
        }
      }
    },

    pause() {
      active = false
      for (const e of entries.values()) e.effect.stop()
    },

    resume() {
      active = true
      if (isRain) {
        for (const e of entries.values()) e.effect.start()
      }
    },

    resize() {
      for (const e of entries.values()) {
        e.effect.setPadding(getPadding(e.element))
        e.effect.resize()
      }
    },

    destroy() {
      active = false
      for (const e of entries.values()) removeCard(e)
      entries.clear()
    },
  }
}
