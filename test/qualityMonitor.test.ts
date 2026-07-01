import { describe, expect, it, vi } from 'vitest'
import { QualityMonitor } from '../src/core/qualityMonitor'

describe('QualityMonitor auto-scaling', () => {
  function feedFrames(
    monitor: QualityMonitor,
    count: number,
    isSlow: (index: number) => boolean,
    onStateChange: () => void = () => {},
    startTime = 1000,
  ) {
    let time = startTime
    for (let index = 0; index < count; index += 1) {
      const slow = isSlow(index)
      time += slow ? 30 : 16
      monitor.recordFrame(time, slow ? 15 : 2, onStateChange)
    }
    return time
  }

  function warmUp(monitor: QualityMonitor, onStateChange: () => void) {
    monitor.recordFrame(1000, 2, onStateChange)
  }

  it('starts auto quality at medium', () => {
    const monitor = new QualityMonitor()

    expect(monitor.getCurrentStep()).toBe(1)
    expect(monitor.getScalingState()).toEqual({
      dprCap: 2,
      qualityTierOverride: 'medium',
    })
  })

  it('does not degrade below the 30 percent slow-frame threshold', () => {
    const monitor = new QualityMonitor()
    const onStateChange = vi.fn()
    warmUp(monitor, onStateChange)

    feedFrames(monitor, 60, (index) => index % 4 === 0, onStateChange)

    expect(monitor.getCurrentStep()).toBe(1)
    expect(onStateChange).not.toHaveBeenCalled()
  })

  it('degrades when at least 30 percent of a 60-frame window is slow', () => {
    const monitor = new QualityMonitor()
    const onStateChange = vi.fn()
    warmUp(monitor, onStateChange)

    feedFrames(monitor, 60, (index) => index < 18, onStateChange)

    expect(monitor.getCurrentStep()).toBe(2)
    expect(monitor.getScalingState()).toEqual({
      dprCap: 2,
      qualityTierOverride: 'low',
    })
    expect(onStateChange).toHaveBeenCalledTimes(1)
  })

  it('degrades auto quality before reducing DPR', () => {
    const monitor = new QualityMonitor()
    const onStateChange = vi.fn()
    warmUp(monitor, onStateChange)

    let time = feedFrames(monitor, 60, () => true, onStateChange)
    expect(monitor.getScalingState()).toEqual({ dprCap: 2, qualityTierOverride: 'low' })

    time = feedFrames(monitor, 60, () => true, onStateChange, time)
    expect(monitor.getScalingState()).toEqual({ dprCap: 1.5, qualityTierOverride: 'low' })

    time = feedFrames(monitor, 60, () => true, onStateChange, time)
    expect(monitor.getScalingState()).toEqual({ dprCap: 1, qualityTierOverride: 'low' })

    feedFrames(monitor, 60, () => true, onStateChange, time)
    expect(monitor.getCurrentStep()).toBe(4)
  })

  it('promotes medium to high after 180 consecutive good frames', () => {
    const monitor = new QualityMonitor()
    const onStateChange = vi.fn()
    warmUp(monitor, onStateChange)

    let time = feedFrames(monitor, 179, () => false, onStateChange)
    expect(monitor.getCurrentStep()).toBe(1)

    feedFrames(monitor, 1, () => false, onStateChange, time)
    expect(monitor.getCurrentStep()).toBe(0)
    expect(monitor.getScalingState()).toEqual({ dprCap: 2 })
    expect(onStateChange).toHaveBeenCalledTimes(1)
  })

  it('recovers one degraded step per 180 consecutive good frames', () => {
    const monitor = new QualityMonitor()
    const onStateChange = vi.fn()
    warmUp(monitor, onStateChange)

    let time = feedFrames(monitor, 120, () => true, onStateChange)
    expect(monitor.getCurrentStep()).toBe(3)

    time = feedFrames(monitor, 180, () => false, onStateChange, time)
    expect(monitor.getCurrentStep()).toBe(2)

    feedFrames(monitor, 180, () => false, onStateChange, time)
    expect(monitor.getCurrentStep()).toBe(1)
  })

  it('keeps manual quality fixed and only reduces DPR', () => {
    const monitor = new QualityMonitor(false)
    const onStateChange = vi.fn()
    warmUp(monitor, onStateChange)

    let time = feedFrames(monitor, 60, () => true, onStateChange)
    expect(monitor.getScalingState()).toEqual({ dprCap: 1.5 })

    time = feedFrames(monitor, 60, () => true, onStateChange, time)
    expect(monitor.getScalingState()).toEqual({ dprCap: 1 })

    feedFrames(monitor, 60, () => true, onStateChange, time)
    expect(monitor.getCurrentStep()).toBe(2)
  })

  it('resets to the correct baseline when the quality mode changes', () => {
    const monitor = new QualityMonitor(false)

    monitor.setup(true)
    expect(monitor.getCurrentStep()).toBe(1)
    expect(monitor.getScalingState().qualityTierOverride).toBe('medium')

    monitor.setup(false)
    expect(monitor.getCurrentStep()).toBe(0)
    expect(monitor.getScalingState()).toEqual({ dprCap: 2 })
  })

  it('discards samples collected before a background pause', () => {
    const monitor = new QualityMonitor()
    const onStateChange = vi.fn()
    warmUp(monitor, onStateChange)

    let time = feedFrames(monitor, 30, () => true, onStateChange)
    time += 500
    monitor.recordFrame(time, 2, onStateChange)
    feedFrames(monitor, 30, () => true, onStateChange, time)

    expect(monitor.getCurrentStep()).toBe(1)
    expect(onStateChange).not.toHaveBeenCalled()
  })
})
