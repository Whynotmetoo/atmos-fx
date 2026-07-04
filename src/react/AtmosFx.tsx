'use client'

import { forwardRef, useCallback, useEffect, useMemo, useRef, Children, cloneElement, isValidElement } from 'react'
import type { ComponentPropsWithoutRef, ForwardedRef } from 'react'
import { createAtmosphere } from '../core/createAtmosphere'
import type { AtmosphereController, AtmosphereOptions } from '../core/types'

type AtmosphereElementProps = Omit<ComponentPropsWithoutRef<'div'>, keyof AtmosphereOptions>
type RefCleanup = void | (() => void)

export type AtmosFxProps = AtmosphereOptions & AtmosphereElementProps

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
    preset,
    density,
    speed,
    wind,
    color,
    quality,
    opacity,
    alpha,
    bottomCollision,
    pauseWhenHidden,
    respectReducedMotion,
    liquidDripping,
    liquidGatheringPoint,
    surfaceDroplets,
    bgStart,
    bgEnd,
    injectStyles,
    styleNonce,
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

      if (opacity !== undefined) {
        nextOptions.opacity = opacity
      }

      if (alpha !== undefined) {
        nextOptions.alpha = alpha
      }

      if (bottomCollision !== undefined) {
        nextOptions.bottomCollision = bottomCollision
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

      nextOptions.liquidGatheringPoint = liquidGatheringPoint

      if (surfaceDroplets !== undefined) {
        nextOptions.surfaceDroplets = surfaceDroplets
      }

      if (bgStart !== undefined) {
        nextOptions.bgStart = bgStart
      }

      if (bgEnd !== undefined) {
        nextOptions.bgEnd = bgEnd
      }

      if (injectStyles !== undefined) {
        nextOptions.injectStyles = injectStyles
      }

      if (styleNonce !== undefined) {
        nextOptions.styleNonce = styleNonce
      }

      return nextOptions
    },
    [
      preset,
      density,
      speed,
      wind,
      color,
      quality,
      opacity,
      alpha,
      bottomCollision,
      pauseWhenHidden,
      respectReducedMotion,
      liquidDripping,
      liquidGatheringPoint,
      surfaceDroplets,
      bgStart,
      bgEnd,
      injectStyles,
      styleNonce,
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
  liquidGatheringPoint?: number
  transMode?: 'glass' | 'opacity' | 'solid'
  opacity?: number
  alpha?: number
  surfaceDroplets?: boolean
  asChild?: boolean
}

export const AtmosCard = forwardRef<HTMLDivElement, AtmosCardProps>(function AtmosCard(
  {
    liquidDripping = true,
    liquidGatheringPoint,
    transMode = 'glass',
    opacity,
    alpha,
    surfaceDroplets = true,
    asChild,
    children,
    ...props
  },
  ref,
) {
  if (asChild) {
    const child = Children.only(children)
    if (isValidElement(child)) {
      const childElement = child as React.ReactElement<any>
      const { className: childClassName, style: childStyle, ...childRestProps } = childElement.props
      const { className: wrapperClassName, style: wrapperStyle, ...wrapperRestProps } = props
      const childPropsTyped = childRestProps as Record<string, any>
      const wrapperPropsTyped = wrapperRestProps as Record<string, any>

      const mergedProps: Record<string, any> = { ...wrapperRestProps }

      for (const key in childPropsTyped) {
        if (Object.prototype.hasOwnProperty.call(childPropsTyped, key)) {
          const childValue = childPropsTyped[key]
          const wrapperValue = wrapperPropsTyped[key]

          if (key.startsWith('on') && typeof childValue === 'function' && typeof wrapperValue === 'function') {
            mergedProps[key] = (...args: any[]) => {
              wrapperValue(...args)
              childValue(...args)
            }
          } else {
            mergedProps[key] = childValue
          }
        }
      }

      return cloneElement(childElement, {
        ...mergedProps,
        className: [childClassName, wrapperClassName].filter(Boolean).join(' ') || undefined,
        style: { ...wrapperStyle, ...childStyle },
        ref: (node: any) => {
          let cleanup1: any
          if (typeof ref === 'function') {
            cleanup1 = ref(node)
          } else if (ref) {
            ref.current = node
          }

          const childRef = childElement.props?.ref ?? (childElement as any).ref
          let cleanup2: any
          if (typeof childRef === 'function') {
            cleanup2 = childRef(node)
          } else if (childRef) {
            childRef.current = node
          }

          if (typeof cleanup1 === 'function' || typeof cleanup2 === 'function') {
            return () => {
              if (typeof cleanup1 === 'function') {
                cleanup1()
              } else if (typeof ref === 'function') {
                ref(null)
              } else if (ref) {
                ref.current = null
              }

              if (typeof cleanup2 === 'function') {
                cleanup2()
              } else if (typeof childRef === 'function') {
                childRef(null)
              } else if (childRef) {
                childRef.current = null
              }
            }
          }
        },
        'data-atmos-collision': '',
        'data-atmos-liquid-dripping': liquidDripping !== undefined ? String(liquidDripping) : undefined,
        'data-atmos-liquid-gathering-point': liquidGatheringPoint !== undefined ? String(liquidGatheringPoint) : undefined,
        'data-atmos-glass': transMode === 'glass' ? '' : undefined,
        'data-atmos-solid': transMode === 'solid' ? '' : undefined,
        'data-atmos-opacity': transMode === 'opacity' ? String(opacity ?? 0.1) : undefined,
        'data-atmos-alpha': transMode === 'glass' && alpha !== undefined ? String(alpha) : undefined,
        'data-atmos-surface-droplets': surfaceDroplets !== undefined ? String(surfaceDroplets) : undefined,
      })
    }
  }

  return (
    <div
      ref={ref}
      data-atmos-collision=""
      data-atmos-liquid-dripping={liquidDripping !== undefined ? String(liquidDripping) : undefined}
      data-atmos-liquid-gathering-point={liquidGatheringPoint !== undefined ? String(liquidGatheringPoint) : undefined}
      data-atmos-glass={transMode === 'glass' ? '' : undefined}
      data-atmos-solid={transMode === 'solid' ? '' : undefined}
      data-atmos-opacity={transMode === 'opacity' ? String(opacity ?? 0.1) : undefined}
      data-atmos-alpha={transMode === 'glass' && alpha !== undefined ? String(alpha) : undefined}
      data-atmos-surface-droplets={surfaceDroplets !== undefined ? String(surfaceDroplets) : undefined}
      {...props}
    >
      {children}
    </div>
  )
})
