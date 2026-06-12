import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Atmosphere } from '../src/react'
import * as createAtmosphereModule from '../src/core/createAtmosphere'

function setDocumentHidden(hidden: boolean) {
  Object.defineProperty(document, 'hidden', {
    configurable: true,
    value: hidden,
  })
}

function setReducedMotion(matches: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn(() => ({
      matches,
      media: '(prefers-reduced-motion: reduce)',
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}

describe('Atmosphere React adapter', () => {
  let host: HTMLDivElement
  let reactRoot: Root

  beforeEach(() => {
    document.body.innerHTML = ''
    host = document.createElement('div')
    document.body.append(host)
    reactRoot = createRoot(host)
    setDocumentHidden(false)
    setReducedMotion(false)

    Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', {
      configurable: true,
      value: true,
    })

    Object.defineProperty(window, 'ResizeObserver', {
      configurable: true,
      value: undefined,
    })

    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 1)
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined)
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  })

  afterEach(() => {
    reactRoot.unmount()
    vi.restoreAllMocks()
  })

  it('honors cleanup returned from forwarded callback refs', async () => {
    const cleanup = vi.fn()
    const ref = vi.fn((node: HTMLDivElement | null) => {
      if (!node) {
        return undefined
      }

      return cleanup
    })

    await act(async () => {
      reactRoot.render(<Atmosphere ref={ref} preset="rain" pauseWhenHidden={false} />)
    })

    expect(ref).toHaveBeenCalledWith(expect.any(HTMLDivElement))
    expect(cleanup).not.toHaveBeenCalled()

    await act(async () => {
      reactRoot.unmount()
    })

    expect(cleanup).toHaveBeenCalledOnce()
  })

  it('plumbs liquidDripping prop to createAtmosphere', async () => {
    const spy = vi.spyOn(createAtmosphereModule, 'createAtmosphere')
    await act(async () => {
      reactRoot.render(<Atmosphere preset="rain" liquidDripping={false} />)
    })
    expect(spy).toHaveBeenCalledWith(expect.any(HTMLDivElement), expect.objectContaining({
      preset: 'rain',
      liquidDripping: false,
    }))
    await act(async () => {
      reactRoot.unmount()
    })
  })
})
