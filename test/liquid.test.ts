import { afterEach, describe, expect, it, vi } from 'vitest'
import { normalizeAtmosphereOptions } from '../src/core/options'
import {
  createLiquidDripsController,
  getLiquidGatheringDuration,
  getLiquidWaveCenter,
  getWaveSampleProgresses,
  LIQUID_VISIBILITY_TOP_MARGIN_PX,
} from '../src/dom/liquid'

describe('liquid gathering', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  function getDropletCx(droplet: Element | null | undefined): string | null {
    const d = droplet?.getAttribute('d')
    if (!d) return null
    const pts = d.split(/[MCZ\s,]+/).filter(Boolean).map(parseFloat)
    return pts.length > 0 ? pts[0].toFixed(1) : null
  }

  function getDropletCy(droplet: Element | null | undefined): string | null {
    const d = droplet?.getAttribute('d')
    if (!d) return null
    const pts = d.split(/[MCZ\s,]+/).filter(Boolean).map(parseFloat)
    return pts.length > 1 ? pts[1].toFixed(1) : null
  }

  it('scales Gathering with card width and caps it at 5500ms', () => {
    expect(getLiquidGatheringDuration(150)).toBe(1670)
    expect(getLiquidGatheringDuration(300)).toBe(2090)
    expect(getLiquidGatheringDuration(600)).toBe(2930)
    expect(getLiquidGatheringDuration(2000)).toBe(5500)
  })

  it('brings unequal left and right wave spans to the gathering point together', () => {
    const expectedX = 240
    const leftStart = expectedX * 0.208
    const rightStart = 600 - (600 - expectedX) * 0.514
    const leftCenter = getLiquidWaveCenter(
      leftStart,
      expectedX,
      1,
    )
    const rightCenter = getLiquidWaveCenter(
      rightStart,
      expectedX,
      1,
    )

    expect(leftCenter).toBeCloseTo(expectedX)
    expect(rightCenter).toBeCloseTo(expectedX)
  })

  it('supports global and per-card gathering point configuration', () => {
    const root = document.createElement('div')
    const card = document.createElement('div')
    root.append(card)
    document.body.append(root)

    const liquid = createLiquidDripsController(root)
    const target = {
      element: card,
      x: 10,
      y: 10,
      width: 300,
      height: 80,
      right: 310,
      bottom: 90,
    }

    liquid.sync(
      normalizeAtmosphereOptions({ liquidGatheringPoint: 0.4 }),
      [target],
    )
    liquid.update(0)
    expect(getDropletCx(root.querySelector('.atmos-liquid-droplet'))).toBe('134.0')

    card.dataset.atmosLiquidGatheringPoint = '0.6'
    liquid.sync(
      normalizeAtmosphereOptions({ liquidGatheringPoint: 0.4 }),
      [target],
    )
    liquid.update(0)
    expect(getDropletCx(root.querySelector('.atmos-liquid-droplet'))).toBe('186.0')

    liquid.destroy()
    root.remove()
  })

  it('keeps the default random gathering point stable for a card', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    const root = document.createElement('div')
    const card = document.createElement('div')
    root.append(card)
    document.body.append(root)

    const liquid = createLiquidDripsController(root)
    const target = {
      element: card,
      x: 10,
      y: 10,
      width: 300,
      height: 80,
      right: 310,
      bottom: 90,
    }
    const options = normalizeAtmosphereOptions()

    liquid.sync(options, [target])
    liquid.update(0)
    const initialX = getDropletCx(root.querySelector('.atmos-liquid-droplet'))
    liquid.sync(options, [target])
    liquid.update(0)

    expect(initialX).toBe('158.7')
    expect(getDropletCx(root.querySelector('.atmos-liquid-droplet'))).toBe(initialX)

    liquid.destroy()
    root.remove()
  })

  it('dynamically inserts gathering point and boundaries into sample progresses', () => {
    const waveLeft = 10
    const waveRight = 290
    const waveSpan = waveRight - waveLeft
    const dripX = waveLeft + waveSpan * 0.4
    const scale = 0.88
    const gatheringDurationMs = 1500

    // During gathering (e.g. elapsedMs = 500)
    const progressesGathering = getWaveSampleProgresses(
      500,
      waveLeft,
      waveRight,
      dripX,
      scale,
      gatheringDurationMs,
    )

    // Should contain extra dynamic points (left/right centers) sorted properly
    expect(progressesGathering.length).toBeGreaterThan(17)
    const isSortedGathering = progressesGathering.every(
      (val, i, arr) => !i || arr[i - 1] <= val,
    )
    expect(isSortedGathering).toBe(true)
    expect(progressesGathering[0]).toBe(0.0)
    expect(progressesGathering[progressesGathering.length - 1]).toBe(1.0)

    // After gathering (e.g. elapsedMs = 1600)
    const progressesFinished = getWaveSampleProgresses(
      1600,
      waveLeft,
      waveRight,
      dripX,
      scale,
      gatheringDurationMs,
    )

    // At the end of gathering, leftCenter = rightCenter = dripX (0.4)
    // The list should contain 0.4, and boundaries (0.4 - pulseProg, 0.4 + pulseProg)
    const pulseWidth = 45 * scale
    const pulseProg = pulseWidth / waveSpan
    const expectedCrest = 0.4
    const expectedLeft = 0.4 - pulseProg
    const expectedRight = 0.4 + pulseProg

    expect(
      progressesFinished.some((p) => Math.abs(p - expectedCrest) < 0.001),
    ).toBe(true)
    expect(
      progressesFinished.some((p) => Math.abs(p - expectedLeft) < 0.001),
    ).toBe(true)
    expect(
      progressesFinished.some((p) => Math.abs(p - expectedRight) < 0.001),
    ).toBe(true)
  })

  it('skips dripping updates for off-screen cards', () => {
    let intersectionCallback: IntersectionObserverCallback | undefined
    let intersectionOptions: IntersectionObserverInit | undefined
    const observeSpy = vi.fn()
    const unobserveSpy = vi.fn()
    const disconnectSpy = vi.fn()

    class MockIntersectionObserver {
      observe = observeSpy
      unobserve = unobserveSpy
      disconnect = disconnectSpy

      constructor(
        callback: IntersectionObserverCallback,
        options?: IntersectionObserverInit,
      ) {
        intersectionCallback = callback
        intersectionOptions = options
      }
    }

    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver)

    const root = document.createElement('div')
    const card = document.createElement('div')
    root.append(card)
    document.body.append(root)

    const liquid = createLiquidDripsController(root)
    const target = {
      element: card,
      x: 10,
      y: 10,
      width: 300,
      height: 80,
      right: 310,
      bottom: 90,
    }

    liquid.sync(normalizeAtmosphereOptions({ preset: 'rain', liquidDripping: true }), [target])

    // Verify it is observed
    expect(observeSpy).toHaveBeenCalledWith(card)
    expect(intersectionOptions).toEqual({
      root: null,
      rootMargin: `${LIQUID_VISIBILITY_TOP_MARGIN_PX}px 0px 0px 0px`,
      threshold: 0,
    })

    // Under gathering phase at t=0.0
    liquid.update(0)
    // Progress to bulging phase so droplet values become active
    liquid.update(1.0)
    const initialCy = getDropletCy(root.querySelector('.atmos-liquid-droplet'))
    expect(initialCy).not.toBeNull()

    // Simulate offscreen (isIntersecting = false)
    intersectionCallback?.(
      [
        {
          isIntersecting: false,
          target: card,
        } as unknown as IntersectionObserverEntry,
      ],
      {} as IntersectionObserver,
    )

    // Call update, check if the cy remains unchanged (skipped)
    liquid.update(1.0)
    const afterOffscreenCy = getDropletCy(root.querySelector('.atmos-liquid-droplet'))
    expect(afterOffscreenCy).toBe(initialCy)

    // Simulate onscreen (isIntersecting = true)
    intersectionCallback?.(
      [
        {
          isIntersecting: true,
          target: card,
        } as unknown as IntersectionObserverEntry,
      ],
      {} as IntersectionObserver,
    )

    // Now update should run again and change the cy value
    liquid.update(1.5)
    const afterOnscreenCy = getDropletCy(root.querySelector('.atmos-liquid-droplet'))
    expect(afterOnscreenCy).not.toBe(initialCy)

    liquid.destroy()
    root.remove()
    vi.unstubAllGlobals()
  })
})
