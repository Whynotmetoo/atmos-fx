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

describe('createAtmosphere', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    setDocumentHidden(false)
    setReducedMotion(false)

    Object.defineProperty(window, 'devicePixelRatio', {
      configurable: true,
      value: 2,
    })

    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 1)
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('creates and cleans up a canvas layer through lifecycle', () => {
    const root = createRoot()
    const controller = createAtmosphere(root, { preset: 'storm' })

    controller.start()

    const canvas = root.querySelector<HTMLCanvasElement>('[data-atoms-layer="weather"]')

    expect(canvas).not.toBeNull()
    expect(canvas?.width).toBe(640)
    expect(canvas?.height).toBe(360)
    expect(root.dataset.atomsFx).toBe('running')
    expect(root.dataset.atomsFxPreset).toBe('storm')
    expect(root.dataset.atomsParticle).toBe('rain')
    expect(root.dataset.atomsTransparency).toBe('glass')

    controller.stop()
    expect(root.dataset.atomsFx).toBe('stopped')

    controller.destroy()
    expect(root.querySelector('[data-atoms-layer="weather"]')).toBeNull()
    expect(root.dataset.atomsFx).toBeUndefined()
    expect(root.dataset.atomsFxPreset).toBeUndefined()
    expect(root.dataset.atomsParticle).toBeUndefined()
  })

  it('supports manual pause and resume', () => {
    const root = createRoot()
    const controller = createAtmosphere(root)

    controller.start()
    controller.pause()

    expect(root.dataset.atomsFx).toBe('paused')

    controller.resume()

    expect(root.dataset.atomsFx).toBe('running')
  })

  it('pauses while the document is hidden and resumes when visible', () => {
    const root = createRoot()
    const controller = createAtmosphere(root)

    controller.start()
    setDocumentHidden(true)
    document.dispatchEvent(new Event('visibilitychange'))

    expect(root.dataset.atomsFx).toBe('paused')

    setDocumentHidden(false)
    document.dispatchEvent(new Event('visibilitychange'))

    expect(root.dataset.atomsFx).toBe('running')
  })

  it('starts paused when reduced motion is requested', () => {
    setReducedMotion(true)

    const root = createRoot()
    const controller = createAtmosphere(root)

    controller.start()

    expect(root.dataset.atomsFx).toBe('paused')
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

    expect(root.dataset.atomsFx).toBe('paused')

    mediaQuery.matches = false
    handleChange(new Event('change'))

    expect(root.dataset.atomsFx).toBe('running')
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

    const canvas = root.querySelector<HTMLCanvasElement>('[data-atoms-layer="weather"]')

    expect(canvas?.width).toBe(400)
    expect(canvas?.height).toBe(200)
  })
})
