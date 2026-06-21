import { describe, expect, it, vi } from 'vitest'
import { QualityMonitor } from '../src/core/qualityMonitor'

describe('QualityMonitor Auto-Scaling', () => {
  it('starts at step 0 with default scaling parameters', () => {
    const monitor = new QualityMonitor()
    expect(monitor.getCurrentStep()).toBe(0)
    
    const state = monitor.getScalingState()
    expect(state.dprCap).toBe(2.0)
    expect(state.densityMultiplier).toBe(1.0)
    expect(state.disableHighCostFeatures).toBe(false)
    expect(state.qualityTierOverride).toBeUndefined()
  })

  it('does not degrade if slow frames ratio is under 30%', () => {
    const monitor = new QualityMonitor()
    const onStateChange = vi.fn()

    let time = 1000
    // Record 60 frames: every 4th frame is slow (ratio = 25% < 30%)
    for (let i = 0; i < 60; i++) {
      const isSlow = i % 4 === 0
      const interval = isSlow ? 30 : 16
      const duration = 2
      time += interval
      monitor.recordFrame(time, duration, onStateChange)
    }

    expect(monitor.getCurrentStep()).toBe(0)
    expect(onStateChange).not.toHaveBeenCalled()
  })

  it('degrades to step 1 when >= 30% of frames are slow', () => {
    const monitor = new QualityMonitor()
    const onStateChange = vi.fn()

    let time = 1000
    // Record 60 frames: 20 slow (30ms interval, 2ms duration = slow), 40 fast (16ms)
    // Slow ratio = 20/60 = 33.3% (>= 30%)
    for (let i = 0; i < 60; i++) {
      const isSlow = i < 20
      const interval = isSlow ? 30 : 16
      const duration = 2
      time += interval
      monitor.recordFrame(time, duration, onStateChange)
    }

    expect(monitor.getCurrentStep()).toBe(1)
    expect(onStateChange).toHaveBeenCalledTimes(1)

    const state = monitor.getScalingState()
    expect(state.dprCap).toBe(1.5)
    expect(state.densityMultiplier).toBe(0.7)
    expect(state.disableHighCostFeatures).toBe(false)
    expect(state.qualityTierOverride).toBe('medium')
  })

  it('degrades to step 2 under persistent load', () => {
    const monitor = new QualityMonitor()
    const onStateChange = vi.fn()

    let time = 1000
    // First round of degradation to step 1
    for (let i = 0; i < 60; i++) {
      const isSlow = i < 20
      time += isSlow ? 30 : 16
      monitor.recordFrame(time, 2, onStateChange)
    }
    expect(monitor.getCurrentStep()).toBe(1)

    // Second round of degradation to step 2
    for (let i = 0; i < 60; i++) {
      const isSlow = i < 20
      time += isSlow ? 30 : 16
      monitor.recordFrame(time, 2, onStateChange)
    }
    expect(monitor.getCurrentStep()).toBe(2)
    expect(onStateChange).toHaveBeenCalledTimes(2)

    const state = monitor.getScalingState()
    expect(state.dprCap).toBe(1.0)
    expect(state.densityMultiplier).toBe(0.4)
    expect(state.disableHighCostFeatures).toBe(true)
    expect(state.qualityTierOverride).toBe('low')
  })

  it('recovers after 180 consecutive good frames', () => {
    const monitor = new QualityMonitor()
    const onStateChange = vi.fn()

    let time = 1000
    // Degrade to step 1
    for (let i = 0; i < 60; i++) {
      const isSlow = i < 20
      time += isSlow ? 30 : 16
      monitor.recordFrame(time, 2, onStateChange)
    }
    expect(monitor.getCurrentStep()).toBe(1)
    onStateChange.mockClear()

    // 29 good frames have already accumulated at the end of the degradation loop
    // (i = 31 to 59 are fast and consecutive).
    // So we need 180 - 29 = 151 good frames to recover.
    // 150 fast frames should not recover yet (total 179 consecutive good frames)
    for (let i = 0; i < 150; i++) {
      time += 16
      monitor.recordFrame(time, 2, onStateChange)
    }
    expect(monitor.getCurrentStep()).toBe(1)
    expect(onStateChange).not.toHaveBeenCalled()

    // 151st fast frame triggers recovery to step 0 (total 180 consecutive good frames)
    time += 16
    monitor.recordFrame(time, 2, onStateChange)
    expect(monitor.getCurrentStep()).toBe(0)
    expect(onStateChange).toHaveBeenCalledTimes(1)
  })

  it('discards intervals > 100ms representing background pauses', () => {
    const monitor = new QualityMonitor()
    const onStateChange = vi.fn()

    let time = 1000
    // Record 29 slow frames
    for (let i = 0; i < 29; i++) {
      time += 30
      monitor.recordFrame(time, 2, onStateChange)
    }

    // Record a 500ms suspend interval (should not count as slow, should reset stats)
    time += 500
    monitor.recordFrame(time, 2, onStateChange)

    // Record the 30th frame (total window now would have been 30 frames, but 500ms split it)
    time += 30
    monitor.recordFrame(time, 2, onStateChange)

    // Quality should not degrade since the window was interrupted/reset
    expect(monitor.getCurrentStep()).toBe(0)
    expect(onStateChange).not.toHaveBeenCalled()
  })

  it('does nothing when disabled', () => {
    const monitor = new QualityMonitor(false)
    const onStateChange = vi.fn()

    let time = 1000
    // Try to degrade by sending slow frames
    for (let i = 0; i < 100; i++) {
      time += 30
      monitor.recordFrame(time, 2, onStateChange)
    }

    expect(monitor.getCurrentStep()).toBe(0)
    expect(onStateChange).not.toHaveBeenCalled()
  })
})
