import { RainEffect } from './rain-card'
import type { NormalizedAtmosphereOptions } from '../core/types'
import type { CollisionTargetRect } from './collisionTargets'

/** Attribute that opts a card into the backdrop water-drop effect. */
const ATTR = 'data-atmos-surface-droplets'
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
  // Opt-in: attribute present and not explicitly "false"
  return el.hasAttribute(ATTR) && el.getAttribute(ATTR) !== 'false'
}

/**
 * Manages per-card WebGL water-drop canvases.
 *
 * Layer model:
 *   <card [data-atmos-surface-droplets]>
 *     <canvas data-atmos-layer="card-rain" />   ← z-index: 0, behind card content
 *     (card children)
 *   </card>
 */
export function createCardRainController(_root: HTMLElement): CardRainController {
  const entries = new Map<HTMLElement, CardEntry>()
  let active = true    // mirrors running state of parent scheduler
  let isRain = false   // only operate in rain preset

  function addCard(el: HTMLElement): void {
    if (entries.has(el)) return

    const canvas = el.ownerDocument.createElement('canvas')
    canvas.setAttribute(LAYER_ATTR, LAYER_VALUE)
    canvas.setAttribute('aria-hidden', 'true')
    canvas.style.cssText =
      'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:0;border-radius:inherit;'

    // Prepend canvas so it sits behind card content
    if (el.firstChild) {
      el.insertBefore(canvas, el.firstChild)
    } else {
      el.appendChild(canvas)
    }

    const effect = new RainEffect(canvas, { autoStart: active && isRain })

    entries.set(el, { element: el, canvas, effect })
  }

  function removeCard(entry: CardEntry): void {
    entry.effect.destroy()
    entry.canvas.parentNode?.removeChild(entry.canvas)
  }

  return {
    sync(options, targets) {
      isRain = options.preset === 'rain'

      // Build set of opted-in elements from current collision targets
      const nextElements = new Set<HTMLElement>()
      for (const t of targets) {
        if (t.element && isOptedIn(t.element)) {
          nextElements.add(t.element)
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
        if (isRain && active) {
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
      for (const e of entries.values()) e.effect.resize()
    },

    destroy() {
      active = false
      for (const e of entries.values()) removeCard(e)
      entries.clear()
    },
  }
}
