import { useEffect, useRef } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { createAtmosphere } from '../core/createAtmosphere'
import type { AtmosphereController, AtmosphereOptions } from '../core/types'

export type AtmosphereProps = AtmosphereOptions & {
  children?: ReactNode
  className?: string
  style?: CSSProperties
}

export function Atmosphere({ children, className, style, ...options }: AtmosphereProps) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const controllerRef = useRef<AtmosphereController | null>(null)

  useEffect(() => {
    if (!rootRef.current) {
      return undefined
    }

    const controller = createAtmosphere(rootRef.current, options)
    controllerRef.current = controller
    controller.start()

    return () => {
      controller.destroy()
      controllerRef.current = null
    }
  }, [])

  useEffect(() => {
    controllerRef.current?.update(options)
  }, [options])

  return (
    <div ref={rootRef} className={className} style={style}>
      {children}
    </div>
  )
}
