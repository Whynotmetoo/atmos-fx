import { afterEach, describe, expect, it, vi } from 'vitest'
import { normalizeAtmosphereOptions } from '../src/core/options'
import {
  createLiquidDripsController,
  getLiquidGatheringDuration,
  getLiquidWaveCenter,
} from '../src/dom/liquid'

describe('liquid gathering', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('scales Gathering with card width and caps it at 4000ms', () => {
    expect(getLiquidGatheringDuration(150)).toBe(1200)
    expect(getLiquidGatheringDuration(300)).toBe(1500)
    expect(getLiquidGatheringDuration(600)).toBe(2100)
    expect(getLiquidGatheringDuration(2000)).toBe(4000)
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
    expect(root.querySelector('ellipse')?.getAttribute('cx')).toBe('134.0')

    card.dataset.atmosLiquidGatheringPoint = '0.6'
    liquid.sync(
      normalizeAtmosphereOptions({ liquidGatheringPoint: 0.4 }),
      [target],
    )
    liquid.update(0)
    expect(root.querySelector('ellipse')?.getAttribute('cx')).toBe('186.0')

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
    const initialX = root.querySelector('ellipse')?.getAttribute('cx')
    liquid.sync(options, [target])
    liquid.update(0)

    expect(initialX).toBe('158.7')
    expect(root.querySelector('ellipse')?.getAttribute('cx')).toBe(initialX)

    liquid.destroy()
    root.remove()
  })
})
