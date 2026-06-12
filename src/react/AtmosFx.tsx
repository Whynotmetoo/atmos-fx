'use client'

import { forwardRef, useCallback, useEffect, useMemo, useRef, Children, cloneElement, isValidElement } from 'react'
import type { ComponentPropsWithoutRef, ForwardedRef } from 'react'
import { createAtmosphere } from '../core/createAtmosphere'
import type { AtmosphereController, AtmosphereOptions, AtmospherePreset } from '../core/types'

type AtmosphereElementProps = Omit<ComponentPropsWithoutRef<'div'>, keyof AtmosphereOptions>
type RefCleanup = void | (() => void)

export interface AtmosFxProps extends AtmosphereOptions, AtmosphereElementProps {
  mode?: AtmospherePreset
}

function assignRef<T>(ref: ForwardedRef<T>, value: T | null): RefCleanup {
  if (typeof ref === 'function') {
    return ref(value)
  }

  if (ref) {
    ref.current = value
  }
}

export const AtmosFx = forwardRef<HTMLDivElement, AtmosFxProps>(function AtmosFx(
  {
    mode,
    preset,
    particle,
    density,
    speed,
    wind,
    color,
    quality,
    transparency,
    contentOpacity,
    surfaceOpacity,
    snowAccumulation,
    hailBounce,
    bottomCollision,
    collisionSelector,
    opaqueSelector,
    pauseWhenHidden,
    respectReducedMotion,
    liquidDripping,
    ...elementProps
  },
  forwardedRef,
) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const controllerRef = useRef<AtmosphereController | null>(null)
  const atmosphereOptions = useMemo<AtmosphereOptions>(
    () => {
      const nextOptions: AtmosphereOptions = {}

      const resolvedPreset = mode !== undefined ? mode : preset
      if (resolvedPreset !== undefined) {
        nextOptions.preset = resolvedPreset
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

      if (contentOpacity !== undefined) {
        nextOptions.contentOpacity = contentOpacity
      }

      if (surfaceOpacity !== undefined) {
        nextOptions.surfaceOpacity = surfaceOpacity
      }

      if (snowAccumulation !== undefined) {
        nextOptions.snowAccumulation = snowAccumulation
      }

      if (hailBounce !== undefined) {
        nextOptions.hailBounce = hailBounce
      }

      if (bottomCollision !== undefined) {
        nextOptions.bottomCollision = bottomCollision
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

      if (liquidDripping !== undefined) {
        nextOptions.liquidDripping = liquidDripping
      }

      return nextOptions
    },
    [
      mode,
      preset,
      particle,
      density,
      speed,
      wind,
      color,
      quality,
      transparency,
      contentOpacity,
      surfaceOpacity,
      snowAccumulation,
      hailBounce,
      bottomCollision,
      collisionSelector,
      opaqueSelector,
      pauseWhenHidden,
      respectReducedMotion,
      liquidDripping,
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

export interface AtmosCardProps extends React.HTMLAttributes<HTMLDivElement> {
  liquidDripping?: boolean
  transMode?: 'glass' | 'opacity' | 'solid'
  opacity?: number
  asChild?: boolean
}

export const AtmosCard = forwardRef<HTMLDivElement, AtmosCardProps>(function AtmosCard(
  { liquidDripping, transMode, opacity, asChild, children, ...props },
  ref,
) {
  if (asChild) {
    const child = Children.only(children)
    if (isValidElement(child)) {
      const childElement = child as React.ReactElement<any>
      return cloneElement(childElement, {
        ref: (node: any) => {
          if (typeof ref === 'function') {
            ref(node)
          } else if (ref) {
            (ref as any).current = node
          }
          const childRef = (childElement as any).ref
          if (typeof childRef === 'function') {
            childRef(node)
          } else if (childRef) {
            childRef.current = node
          }
        },
        'data-atoms-collision': '',
        'data-atoms-liquid-dripping': liquidDripping !== undefined ? String(liquidDripping) : undefined,
        'data-atoms-glass': transMode === 'glass' ? '' : undefined,
        'data-atoms-opaque': transMode === 'solid' ? 'managed' : undefined,
        'data-atoms-opacity': transMode === 'opacity' ? String(opacity ?? 0.72) : undefined,
        ...childElement.props,
        className: [childElement.props.className, props.className].filter(Boolean).join(' ') || undefined,
        style: { ...props.style, ...childElement.props.style },
      })
    }
  }

  return (
    <div
      ref={ref}
      data-atoms-collision=""
      data-atoms-liquid-dripping={liquidDripping !== undefined ? String(liquidDripping) : undefined}
      data-atoms-glass={transMode === 'glass' ? '' : undefined}
      data-atoms-opaque={transMode === 'solid' ? 'managed' : undefined}
      data-atoms-opacity={transMode === 'opacity' ? String(opacity ?? 0.72) : undefined}
      {...props}
    >
      {children}
    </div>
  )
})
