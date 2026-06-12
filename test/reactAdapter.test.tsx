import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Atmosphere, AtmosFx, AtmosCard } from '../src/react'
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

  it('plumbs mode prop as preset to createAtmosphere', async () => {
    const spy = vi.spyOn(createAtmosphereModule, 'createAtmosphere')
    await act(async () => {
      reactRoot.render(<AtmosFx mode="snow" />)
    })
    expect(spy).toHaveBeenCalledWith(expect.any(HTMLDivElement), expect.objectContaining({
      preset: 'snow',
    }))
    await act(async () => {
      reactRoot.unmount()
    })
  })

  it('renders AtmosCard with data attributes', async () => {
    await act(async () => {
      reactRoot.render(
        <AtmosCard liquidDripping={false} transMode="glass" className="my-card">
          <span>content</span>
        </AtmosCard>
      )
    })
    const cardEl = host.querySelector('.my-card')
    expect(cardEl).not.toBeNull()
    expect(cardEl?.getAttribute('data-atoms-collision')).toBe('')
    expect(cardEl?.getAttribute('data-atoms-liquid-dripping')).toBe('false')
    expect(cardEl?.getAttribute('data-atoms-glass')).toBe('')
    expect(cardEl?.querySelector('span')?.textContent).toBe('content')

    await act(async () => {
      reactRoot.unmount()
    })
  })

  it('renders AtmosCard asChild and merges props onto child', async () => {
    const customRef = vi.fn()
    await act(async () => {
      reactRoot.render(
        <AtmosCard liquidDripping={true} transMode="solid" asChild className="extra-class" style={{ color: 'red' }}>
          <button ref={customRef} className="base-class" style={{ background: 'blue' }}>
            click me
          </button>
        </AtmosCard>
      )
    })
    const buttonEl = host.querySelector('button')
    expect(buttonEl).not.toBeNull()
    expect(buttonEl?.getAttribute('data-atoms-collision')).toBe('')
    expect(buttonEl?.getAttribute('data-atoms-liquid-dripping')).toBe('true')
    expect(buttonEl?.getAttribute('data-atoms-opaque')).toBe('managed')
    expect(buttonEl?.className).toBe('base-class extra-class')
    expect(buttonEl?.style.color).toBe('red')
    expect(buttonEl?.style.background).toBe('blue')
    expect(customRef).toHaveBeenCalledWith(expect.any(HTMLButtonElement))

    await act(async () => {
      reactRoot.unmount()
    })
  })
})
