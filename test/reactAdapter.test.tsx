import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AtmosFx, AtmosCard } from '../src/react'
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
      reactRoot.render(<AtmosFx ref={ref} preset="rain" pauseWhenHidden={false} />)
    })

    expect(ref).toHaveBeenCalledWith(expect.any(HTMLDivElement))
    expect(cleanup).not.toHaveBeenCalled()

    await act(async () => {
      reactRoot.unmount()
    })

    expect(cleanup).toHaveBeenCalledOnce()
  })

  it('plumbs liquid options to createAtmosphere', async () => {
    const spy = vi.spyOn(createAtmosphereModule, 'createAtmosphere')
    await act(async () => {
      reactRoot.render(
        <AtmosFx
          preset="rain"
          liquidDripping={false}
          liquidGatheringPoint={0.42}
        />,
      )
    })
    expect(spy).toHaveBeenCalledWith(expect.any(HTMLDivElement), expect.objectContaining({
      preset: 'rain',
      liquidDripping: false,
      liquidGatheringPoint: 0.42,
    }))
    await act(async () => {
      reactRoot.unmount()
    })
  })

  it('renders AtmosCard with data attributes', async () => {
    await act(async () => {
      reactRoot.render(
        <AtmosCard
          liquidDripping={false}
          liquidGatheringPoint={0.44}
          transMode="glass"
          className="my-card"
        >
          <span>content</span>
        </AtmosCard>
      )
    })
    const cardEl = host.querySelector('.my-card')
    expect(cardEl).not.toBeNull()
    expect(cardEl?.getAttribute('data-atmos-collision')).toBe('')
    expect(cardEl?.getAttribute('data-atmos-liquid-dripping')).toBe('false')
    expect(cardEl?.getAttribute('data-atmos-liquid-gathering-point')).toBe('0.44')
    expect(cardEl?.getAttribute('data-atmos-glass')).toBe('')
    expect(cardEl?.querySelector('span')?.textContent).toBe('content')

    await act(async () => {
      reactRoot.unmount()
    })
  })

  it('uses the default opacity for opacity cards', async () => {
    await act(async () => {
      reactRoot.render(<AtmosCard transMode="opacity">content</AtmosCard>)
    })

    expect(host.firstElementChild?.getAttribute('data-atmos-opacity')).toBe('0.1')

    await act(async () => {
      reactRoot.unmount()
    })
  })

  it('renders AtmosCard asChild and merges props onto child', async () => {
    const customRef = vi.fn()
    await act(async () => {
      reactRoot.render(
        <AtmosCard liquidDripping={true} liquidGatheringPoint={0.6} transMode="solid" asChild className="extra-class" style={{ color: 'red' }}>
          <button ref={customRef} className="base-class" style={{ background: 'blue' }}>
            click me
          </button>
        </AtmosCard>
      )
    })
    const buttonEl = host.querySelector('button')
    expect(buttonEl).not.toBeNull()
    expect(buttonEl?.getAttribute('data-atmos-collision')).toBe('')
    expect(buttonEl?.getAttribute('data-atmos-liquid-dripping')).toBe('true')
    expect(buttonEl?.getAttribute('data-atmos-liquid-gathering-point')).toBe('0.6')
    expect(buttonEl?.getAttribute('data-atmos-solid')).toBe('')
    expect(buttonEl?.className).toBe('base-class extra-class')
    expect(buttonEl?.style.color).toBe('red')
    expect(buttonEl?.style.background).toBe('blue')
    expect(customRef).toHaveBeenCalledWith(expect.any(HTMLButtonElement))

    await act(async () => {
      reactRoot.unmount()
    })
  })

  it('supports disabling style injection', async () => {
    const existing = document.getElementById('atmos-fx-styles')
    if (existing) {
      existing.remove()
    }

    await act(async () => {
      reactRoot.render(<AtmosFx injectStyles={false} />)
    })

    expect(document.getElementById('atmos-fx-styles')).toBeNull()

    await act(async () => {
      reactRoot.unmount()
    })
  })

  it('supports injecting styles with a nonce', async () => {
    const existing = document.getElementById('atmos-fx-styles')
    if (existing) {
      existing.remove()
    }

    await act(async () => {
      reactRoot.render(<AtmosFx injectStyles={true} styleNonce="test-nonce" />)
    })

    const styleEl = document.getElementById('atmos-fx-styles')
    expect(styleEl).not.toBeNull()
    expect(styleEl?.getAttribute('nonce')).toBe('test-nonce')
    expect(styleEl?.textContent).toContain(':where([data-atmos-glass]):not([data-atmos-solid])')
    expect(styleEl?.textContent).toContain(':where([data-atmos-opacity]):not([data-atmos-solid])')
    expect(styleEl?.textContent).not.toContain('data-atmos-transparency')

    await act(async () => {
      reactRoot.unmount()
    })
  })

  it('composes and runs callback ref cleanups for AtmosCard asChild', async () => {
    const parentCleanup = vi.fn()
    const parentRef = vi.fn((node: any) => {
      if (!node) return undefined
      return parentCleanup
    })

    const childCleanup = vi.fn()
    const childRef = vi.fn((node: any) => {
      if (!node) return undefined
      return childCleanup
    })

    await act(async () => {
      reactRoot.render(
        <AtmosCard asChild ref={parentRef}>
          <button ref={childRef}>Click me</button>
        </AtmosCard>
      )
    })

    expect(parentRef).toHaveBeenCalledWith(expect.any(HTMLButtonElement))
    expect(childRef).toHaveBeenCalledWith(expect.any(HTMLButtonElement))
    expect(parentCleanup).not.toHaveBeenCalled()
    expect(childCleanup).not.toHaveBeenCalled()

    await act(async () => {
      reactRoot.unmount()
    })

    expect(parentCleanup).toHaveBeenCalledOnce()
    expect(childCleanup).toHaveBeenCalledOnce()
  })

  it('composes event handlers and forwards wrapper props on AtmosCard asChild', async () => {
    const parentClick = vi.fn()
    const childClick = vi.fn()

    await act(async () => {
      reactRoot.render(
        <AtmosCard asChild onClick={parentClick} id="my-card-id" aria-label="custom-label">
          <button onClick={childClick}>Click me</button>
        </AtmosCard>
      )
    })

    const buttonEl = host.querySelector('button')
    expect(buttonEl).not.toBeNull()
    expect(buttonEl?.getAttribute('id')).toBe('my-card-id')
    expect(buttonEl?.getAttribute('aria-label')).toBe('custom-label')

    buttonEl?.click()
    expect(parentClick).toHaveBeenCalledOnce()
    expect(childClick).toHaveBeenCalledOnce()

    await act(async () => {
      reactRoot.unmount()
    })
  })

  it('resets options when props are removed/undefined', async () => {
    const updateSpy = vi.fn()
    vi.spyOn(createAtmosphereModule, 'createAtmosphere').mockReturnValue({
      start: vi.fn(),
      stop: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      resize: vi.fn(),
      update: updateSpy,
      destroy: vi.fn(),
    })

    await act(async () => {
      reactRoot.render(
        <AtmosFx
          preset="rain"
          liquidGatheringPoint={0.42}
        />,
      )
    })

    await act(async () => {
      reactRoot.render(
        <AtmosFx
          preset="rain"
          liquidGatheringPoint={undefined}
        />,
      )
    })

    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        liquidGatheringPoint: undefined,
      }),
    )

    await act(async () => {
      reactRoot.unmount()
    })
  })
})
