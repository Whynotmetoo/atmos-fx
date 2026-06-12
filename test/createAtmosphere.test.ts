import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createAtmosphere } from '../src/core/createAtmosphere'

function createRoot() {
  const root = document.createElement('section')
  document.body.append(root)

  Object.defineProperty(root, 'clientWidth', {
    configurable: true,
    value: 320,
  })
  Object.defineProperty(root, 'clientHeight', {
    configurable: true,
    value: 180,
  })

  root.getBoundingClientRect = vi.fn(() => ({
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: 320,
    bottom: 180,
    width: 320,
    height: 180,
    toJSON: () => ({}),
  }))

  return root
}

function setDocumentHidden(hidden: boolean) {
  Object.defineProperty(document, 'hidden', {
    configurable: true,
    value: hidden,
  })
}

function setReducedMotion(matches: boolean) {
  const mediaQuery = {
    matches,
    media: '(prefers-reduced-motion: reduce)',
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }

  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn(() => mediaQuery),
  })

  return mediaQuery
}

function setLegacyReducedMotion(matches: boolean) {
  const mediaQuery = {
    matches,
    media: '(prefers-reduced-motion: reduce)',
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }

  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn(() => mediaQuery),
  })

  return mediaQuery
}

function createCanvasContext() {
  return {
    setTransform: vi.fn(),
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    lineCap: 'butt',
    lineWidth: 1,
    globalAlpha: 1,
    strokeStyle: '',
    fillStyle: '',
  } as unknown as CanvasRenderingContext2D
}

describe('createAtmosphere', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    setDocumentHidden(false)
    setReducedMotion(false)
    Object.defineProperty(window, 'ResizeObserver', {
      configurable: true,
      value: undefined,
    })

    Object.defineProperty(window, 'devicePixelRatio', {
      configurable: true,
      value: 2,
    })

    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 1)
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined)
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('creates and cleans up a canvas layer through lifecycle', () => {
    const root = createRoot()
    const controller = createAtmosphere(root, { preset: 'rain' })

    controller.start()

    const backgroundCanvas = root.querySelector<HTMLCanvasElement>(
      '[data-atmos-layer="weather-background"]',
    )
    const foregroundCanvas = root.querySelector<HTMLCanvasElement>(
      '[data-atmos-layer="weather-foreground"]',
    )

    expect(backgroundCanvas).not.toBeNull()
    expect(foregroundCanvas).not.toBeNull()
    expect(backgroundCanvas?.width).toBe(640)
    expect(backgroundCanvas?.height).toBe(360)
    expect(foregroundCanvas?.width).toBe(640)
    expect(foregroundCanvas?.height).toBe(360)
    expect(root.dataset.atmosFx).toBe('running')
    expect(root.dataset.atmosFxPreset).toBe('rain')
    expect(root.dataset.atmosParticle).toBe('rain')
    expect(root.dataset.atmosRenderer).toBe('canvas2d')
    expect(root.dataset.atmosTransparency).toBe('glass')

    controller.stop()
    expect(root.dataset.atmosFx).toBe('stopped')

    controller.destroy()
    expect(root.querySelector('[data-atmos-layer="weather-background"]')).toBeNull()
    expect(root.querySelector('[data-atmos-layer="weather-foreground"]')).toBeNull()
    expect(root.dataset.atmosFx).toBeUndefined()
    expect(root.dataset.atmosFxPreset).toBeUndefined()
    expect(root.dataset.atmosParticle).toBeUndefined()
    expect(root.dataset.atmosRenderer).toBeUndefined()
    expect(root.dataset.atmosTransparency).toBeUndefined()
  })

  it('syncs glass controls during lifecycle updates', () => {
    const root = createRoot()
    const solid = document.createElement('button')
    const translucent = document.createElement('div')
    solid.className = 'solid'
    translucent.dataset.atmosOpacity = '0.35'
    root.append(solid, translucent)

    const controller = createAtmosphere(root, {
      opaqueSelector: '.solid',
      contentOpacity: 0.55,
      surfaceOpacity: 0.22,
    })

    controller.start()

    expect(solid.dataset.atmosOpaque).toBe('managed')
    expect(translucent.style.getPropertyValue('--atmos-fx-opacity')).toBe('0.35')
    expect(root.style.getPropertyValue('--atmos-fx-content-opacity')).toBe('0.55')
    expect(root.style.getPropertyValue('--atmos-fx-surface-opacity')).toBe('0.22')

    controller.update({ transparency: 'opacity' })

    expect(root.dataset.atmosTransparency).toBe('opacity')

    controller.destroy()

    expect(solid.dataset.atmosOpaque).toBeUndefined()
    expect(translucent.style.getPropertyValue('--atmos-fx-opacity')).toBe('')
    expect(root.style.getPropertyValue('--atmos-fx-content-opacity')).toBe('')
    expect(root.style.getPropertyValue('--atmos-fx-surface-opacity')).toBe('')
  })

  it('creates, gates, and cleans up liquid dripping layer through lifecycle', () => {
    const root = createRoot()
    const card = document.createElement('div')
    card.setAttribute('data-atmos-collision', '')
    root.append(card)

    const controller = createAtmosphere(root, { preset: 'rain' })
    controller.start()

    const liquidSvg = root.querySelector<SVGElement>('[data-atmos-layer="liquid"]')
    expect(liquidSvg).not.toBeNull()
    expect(liquidSvg?.style.display).toBe('block')

    // Gate: disable when particle is snow
    controller.update({ preset: 'rain', particle: 'snow' })
    expect(liquidSvg?.style.display).toBe('none')

    // Gate: disable when liquidDripping is false
    controller.update({ preset: 'rain', particle: 'rain', liquidDripping: false })
    expect(liquidSvg?.style.display).toBe('none')

    // Enable again
    controller.update({ preset: 'rain', particle: 'rain', liquidDripping: true })
    expect(liquidSvg?.style.display).toBe('block')

    controller.destroy()
    expect(root.querySelector('[data-atmos-layer="liquid"]')).toBeNull()
  })

  it('clears rendered rain when stopped', () => {
    const context = createCanvasContext()
    vi.mocked(HTMLCanvasElement.prototype.getContext).mockImplementation((contextId) => {
      if (contextId === '2d') {
        return context
      }
      return null
    })

    const root = createRoot()
    const controller = createAtmosphere(root)

    controller.start()
    controller.stop()

    expect(context.clearRect).toHaveBeenCalledWith(0, 0, 320, 180)
    expect(root.dataset.atmosFx).toBe('stopped')
  })

  it('starts with the snow preset and switches renderer state through updates', () => {
    const root = createRoot()
    const controller = createAtmosphere(root, { preset: 'snow' })

    controller.start()

    expect(root.dataset.atmosFxPreset).toBe('snow')
    expect(root.dataset.atmosParticle).toBe('snow')

    controller.update({ preset: 'rain' })

    expect(root.dataset.atmosFxPreset).toBe('rain')
    expect(root.dataset.atmosParticle).toBe('rain')

    controller.destroy()
  })

  it('starts with the hail preset and exposes hail dataset state', () => {
    const root = createRoot()
    const controller = createAtmosphere(root, { preset: 'hail' })

    controller.start()

    expect(root.dataset.atmosFxPreset).toBe('hail')
    expect(root.dataset.atmosParticle).toBe('hail')

    controller.destroy()
  })

  it('keeps controller options isolated from caller object mutations', () => {
    const root = createRoot()
    const options = { preset: 'snow' as 'rain' | 'snow' }
    const controller = createAtmosphere(root, options)

    controller.start()
    options.preset = 'rain'
    controller.update({ density: 0.8 })

    expect(root.dataset.atmosFxPreset).toBe('snow')
    expect(root.dataset.atmosParticle).toBe('snow')

    controller.destroy()
  })

  it('supports manual pause and resume', () => {
    const root = createRoot()
    const controller = createAtmosphere(root)

    controller.start()
    controller.pause()

    expect(root.dataset.atmosFx).toBe('paused')

    controller.resume()

    expect(root.dataset.atmosFx).toBe('running')
  })

  it('does not resume a manual pause during option updates', () => {
    const root = createRoot()
    const controller = createAtmosphere(root)

    controller.start()
    controller.pause()
    controller.update({ density: 0.8 })

    expect(root.dataset.atmosFx).toBe('paused')
  })

  it('pauses while the document is hidden and resumes when visible', () => {
    const root = createRoot()
    const controller = createAtmosphere(root)

    controller.start()
    setDocumentHidden(true)
    document.dispatchEvent(new Event('visibilitychange'))

    expect(root.dataset.atmosFx).toBe('paused')

    setDocumentHidden(false)
    document.dispatchEvent(new Event('visibilitychange'))

    expect(root.dataset.atmosFx).toBe('running')
  })

  it('resumes when hidden-document auto-pause is disabled by update', () => {
    setDocumentHidden(true)

    const root = createRoot()
    const controller = createAtmosphere(root)

    controller.start()
    expect(root.dataset.atmosFx).toBe('paused')

    controller.update({ pauseWhenHidden: false })

    expect(root.dataset.atmosFx).toBe('running')
  })

  it('starts paused when reduced motion is requested', () => {
    setReducedMotion(true)

    const root = createRoot()
    const controller = createAtmosphere(root)

    controller.start()

    expect(root.dataset.atmosFx).toBe('paused')
  })

  it('resumes when reduced-motion auto-pause is disabled by update', () => {
    setReducedMotion(true)

    const root = createRoot()
    const controller = createAtmosphere(root)

    controller.start()
    expect(root.dataset.atmosFx).toBe('paused')

    controller.update({ respectReducedMotion: false })

    expect(root.dataset.atmosFx).toBe('running')
  })

  it('reacts to reduced motion preference changes', () => {
    const mediaQuery = setReducedMotion(false)
    const root = createRoot()
    const controller = createAtmosphere(root)

    controller.start()

    const handleChange = mediaQuery.addEventListener.mock.calls[0]?.[1]
    expect(handleChange).toBeTypeOf('function')

    mediaQuery.matches = true
    handleChange(new Event('change'))

    expect(root.dataset.atmosFx).toBe('paused')

    mediaQuery.matches = false
    handleChange(new Event('change'))

    expect(root.dataset.atmosFx).toBe('running')
  })

  it('supports legacy reduced-motion media query listeners', () => {
    const mediaQuery = setLegacyReducedMotion(false)
    const root = createRoot()
    const controller = createAtmosphere(root)

    controller.start()

    expect(mediaQuery.addListener).toHaveBeenCalledOnce()

    const handleChange = mediaQuery.addListener.mock.calls[0]?.[0]
    mediaQuery.matches = true
    handleChange()

    expect(root.dataset.atmosFx).toBe('paused')

    controller.destroy()

    expect(mediaQuery.removeListener).toHaveBeenCalledWith(handleChange)
  })

  it('resizes the canvas layer on demand', () => {
    const root = createRoot()
    const controller = createAtmosphere(root)

    controller.start()

    root.getBoundingClientRect = vi.fn(() => ({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 200,
      bottom: 100,
      width: 200,
      height: 100,
      toJSON: () => ({}),
    }))

    controller.resize()

    const backgroundCanvas = root.querySelector<HTMLCanvasElement>(
      '[data-atmos-layer="weather-background"]',
    )
    const foregroundCanvas = root.querySelector<HTMLCanvasElement>(
      '[data-atmos-layer="weather-foreground"]',
    )

    expect(backgroundCanvas?.width).toBe(400)
    expect(backgroundCanvas?.height).toBe(200)
    expect(foregroundCanvas?.width).toBe(400)
    expect(foregroundCanvas?.height).toBe(200)
  })

  it('resizes the canvas layer when the window changes size', () => {
    const root = createRoot()
    const controller = createAtmosphere(root)

    controller.start()

    root.getBoundingClientRect = vi.fn(() => ({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 180,
      bottom: 90,
      width: 180,
      height: 90,
      toJSON: () => ({}),
    }))

    window.dispatchEvent(new Event('resize'))

    const backgroundCanvas = root.querySelector<HTMLCanvasElement>(
      '[data-atmos-layer="weather-background"]',
    )
    const foregroundCanvas = root.querySelector<HTMLCanvasElement>(
      '[data-atmos-layer="weather-foreground"]',
    )

    expect(backgroundCanvas?.width).toBe(360)
    expect(backgroundCanvas?.height).toBe(180)
    expect(foregroundCanvas?.width).toBe(360)
    expect(foregroundCanvas?.height).toBe(180)
  })

  it('resizes the canvas layer when the root size changes', () => {
    let resizeCallback: ResizeObserverCallback | undefined

    class MockResizeObserver {
      observe = vi.fn()
      disconnect = vi.fn()

      constructor(callback: ResizeObserverCallback) {
        resizeCallback = callback
      }
    }

    Object.defineProperty(window, 'ResizeObserver', {
      configurable: true,
      value: MockResizeObserver,
    })

    const root = createRoot()
    const controller = createAtmosphere(root)

    controller.start()

    root.getBoundingClientRect = vi.fn(() => ({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 240,
      bottom: 160,
      width: 240,
      height: 160,
      toJSON: () => ({}),
    }))

    resizeCallback?.([], {} as ResizeObserver)

    const backgroundCanvas = root.querySelector<HTMLCanvasElement>(
      '[data-atmos-layer="weather-background"]',
    )
    const foregroundCanvas = root.querySelector<HTMLCanvasElement>(
      '[data-atmos-layer="weather-foreground"]',
    )

    expect(backgroundCanvas?.width).toBe(480)
    expect(backgroundCanvas?.height).toBe(320)
    expect(foregroundCanvas?.width).toBe(480)
    expect(foregroundCanvas?.height).toBe(320)
  })

  it('overrides inline static positioning while the canvas layer exists', () => {
    const root = createRoot()
    root.style.position = 'static'

    const controller = createAtmosphere(root)

    controller.start()

    expect(root.style.position).toBe('relative')

    controller.destroy()

    expect(root.style.position).toBe('static')
  })
})
