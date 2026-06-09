'use client'

import { forwardRef, useCallback, useEffect, useMemo, useRef } from 'react'
import type { ComponentPropsWithoutRef, ForwardedRef } from 'react'
import { createAtmosphere } from '../core/createAtmosphere'
import type { AtmosphereController, AtmosphereOptions } from '../core/types'

type AtmosphereElementProps = Omit<ComponentPropsWithoutRef<'div'>, keyof AtmosphereOptions>
type RefCleanup = void | (() => void)

export type AtmosphereProps = AtmosphereOptions & AtmosphereElementProps

function assignRef<T>(ref: ForwardedRef<T>, value: T | null): RefCleanup {
  if (typeof ref === 'function') {
    return ref(value)
  }

  if (ref) {
    ref.current = value
  }
}

export const Atmosphere = forwardRef<HTMLDivElement, AtmosphereProps>(function Atmosphere(
  {
    preset,
    particle,
    density,
    speed,
    wind,
    color,
    quality,
    transparency,
    collisionSelector,
    opaqueSelector,
    pauseWhenHidden,
    respectReducedMotion,
    ...elementProps
  },
  forwardedRef,
) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const controllerRef = useRef<AtmosphereController | null>(null)
  const atmosphereOptions = useMemo<AtmosphereOptions>(
    () => {
      const nextOptions: AtmosphereOptions = {}

      if (preset !== undefined) {
        nextOptions.preset = preset
      }

      if (particle !== undefined) {
        nextOptions.particle = particle
      }

      if (density !== undefined) {
        nextOptions.density = density
      }

      if (speed !== undefined) {
        nextOptions.speed = speed
      }

      if (wind !== undefined) {
        nextOptions.wind = wind
      }

      if (color !== undefined) {
        nextOptions.color = color
      }

      if (quality !== undefined) {
        nextOptions.quality = quality
      }

      if (transparency !== undefined) {
        nextOptions.transparency = transparency
      }

      if (collisionSelector !== undefined) {
        nextOptions.collisionSelector = collisionSelector
      }

      if (opaqueSelector !== undefined) {
        nextOptions.opaqueSelector = opaqueSelector
      }

      if (pauseWhenHidden !== undefined) {
        nextOptions.pauseWhenHidden = pauseWhenHidden
      }

      if (respectReducedMotion !== undefined) {
        nextOptions.respectReducedMotion = respectReducedMotion
      }

      return nextOptions
    },
    [
      preset,
      particle,
      density,
      speed,
      wind,
      color,
      quality,
      transparency,
      collisionSelector,
      opaqueSelector,
      pauseWhenHidden,
      respectReducedMotion,
    ],
  )
  const optionsRef = useRef(atmosphereOptions)
  optionsRef.current = atmosphereOptions

  const setRootRef = useCallback(
    (node: HTMLDivElement | null) => {
      rootRef.current = node
      const cleanup = assignRef(forwardedRef, node)

      if (node === null) {
        return undefined
      }

      return () => {
        if (rootRef.current === node) {
          rootRef.current = null
        }

        if (typeof cleanup === 'function') {
          cleanup()
          return
        }

        assignRef(forwardedRef, null)
      }
    },
    [forwardedRef],
  )

  useEffect(() => {
    if (!rootRef.current) {
      return undefined
    }

    const controller = createAtmosphere(rootRef.current, optionsRef.current)
    controllerRef.current = controller
    controller.start()

    return () => {
      controller.destroy()
      controllerRef.current = null
    }
  }, [])

  useEffect(() => {
    controllerRef.current?.update(atmosphereOptions)
  }, [atmosphereOptions])

  return <div ref={setRootRef} {...elementProps} />
})
