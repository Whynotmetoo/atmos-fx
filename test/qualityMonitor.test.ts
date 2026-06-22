import { describe, expect, it, vi } from 'vitest'
import { QualityMonitor } from '../src/core/qualityMonitor'

describe('QualityMonitor Auto-Scaling', () => {
  // Helper function to feed frames safely.
  // Assumes that monitor.recordFrame has been called once already to set lastFrameTime baseline.
  function feedFrames(
    monitor: QualityMonitor,
    count: number,
    isSlow: (index: number) => boolean,
    onStateChange: () => void = () => {},
    startTime = 1000
  ) {
    let time = startTime
    for (let i = 0; i < count; i++) {
      const slow = isSlow(i)
      const interval = slow ? 30 : 16
      const duration = slow ? 15 : 2
      time += interval
      monitor.recordFrame(time, duration, onStateChange)
    }
    return time
  }

  it('starts at step 0 with default scaling parameters', () => {
    const monitor = new QualityMonitor()
    expect(monitor.getCurrentStep()).toBe(0)
    
    const state = monitor.getScalingState()
    expect(state.dprCap).toBe(2.0)
    expect(state.qualityTierOverride).toBeUndefined()
  })

  it('does not degrade if slow frames ratio is under 30%', () => {
    const monitor = new QualityMonitor()
    monitor.setup(true, 'high')
    const onStateChange = vi.fn()

    let time = 1000
    // Warm up
    monitor.recordFrame(time, 2, onStateChange)

    // 60 frames: every 4th frame is slow (ratio = 15/60 = 25% < 30%)
    feedFrames(monitor, 60, (i) => i % 4 === 0, onStateChange, time)

    expect(monitor.getCurrentStep()).toBe(0)
    expect(onStateChange).not.toHaveBeenCalled()
  })

  it('degrades to step 1 when >= 30% of frames are slow', () => {
    const monitor = new QualityMonitor()
    monitor.setup(true, 'high')
    const onStateChange = vi.fn()

    let time = 1000
    // Warm up
    monitor.recordFrame(time, 2, onStateChange)

    // 60 frames: 20 slow (33.3% >= 30%)
    feedFrames(monitor, 60, (i) => i < 20, onStateChange, time)

    expect(monitor.getCurrentStep()).toBe(1)
    expect(onStateChange).toHaveBeenCalledTimes(1)

    const state = monitor.getScalingState()
    expect(state.dprCap).toBe(2.0)
    expect(state.qualityTierOverride).toBe('medium')
  })

  it('progresses steps correctly for auto + high quality', () => {
    const monitor = new QualityMonitor()
    monitor.setup(true, 'high')
    const onStateChange = vi.fn()

    let time = 1000
    // Warm up
    monitor.recordFrame(time, 2, onStateChange)

    // Step 0: DPR 2.0, quality 'high' (initial)
    let state = monitor.getScalingState()
    expect(state.dprCap).toBe(2.0)
    expect(state.qualityTierOverride).toBeUndefined()

    // Degrade to Step 1: DPR 2.0, quality 'medium'
    time = feedFrames(monitor, 60, () => true, onStateChange, time)
    expect(monitor.getCurrentStep()).toBe(1)
    state = monitor.getScalingState()
    expect(state.dprCap).toBe(2.0)
    expect(state.qualityTierOverride).toBe('medium')

    // Degrade to Step 2: DPR 2.0, quality 'low'
    time = feedFrames(monitor, 60, () => true, onStateChange, time)
    expect(monitor.getCurrentStep()).toBe(2)
    state = monitor.getScalingState()
    expect(state.dprCap).toBe(2.0)
    expect(state.qualityTierOverride).toBe('low')

    // Degrade to Step 3: DPR 1.5, quality 'low'
    time = feedFrames(monitor, 60, () => true, onStateChange, time)
    expect(monitor.getCurrentStep()).toBe(3)
    state = monitor.getScalingState()
    expect(state.dprCap).toBe(1.5)
    expect(state.qualityTierOverride).toBe('low')

    // Degrade to Step 4: DPR 1.0, quality 'low'
    time = feedFrames(monitor, 60, () => true, onStateChange, time)
    expect(monitor.getCurrentStep()).toBe(4)
    state = monitor.getScalingState()
    expect(state.dprCap).toBe(1.0)
    expect(state.qualityTierOverride).toBe('low')

    // Try to degrade past maxStep (4) - should stay at 4
    time = feedFrames(monitor, 60, () => true, onStateChange, time)
    expect(monitor.getCurrentStep()).toBe(4)
  })

  it('progresses steps correctly for auto + medium quality', () => {
    const monitor = new QualityMonitor()
    monitor.setup(true, 'medium')
    const onStateChange = vi.fn()

    let time = 1000
    // Warm up
    monitor.recordFrame(time, 2, onStateChange)

    // Step 0: DPR 2.0, quality 'medium' (initial)
    let state = monitor.getScalingState()
    expect(state.dprCap).toBe(2.0)
    expect(state.qualityTierOverride).toBeUndefined()

    // Degrade to Step 1: DPR 2.0, quality 'low'
    time = feedFrames(monitor, 60, () => true, onStateChange, time)
    expect(monitor.getCurrentStep()).toBe(1)
    state = monitor.getScalingState()
    expect(state.dprCap).toBe(2.0)
    expect(state.qualityTierOverride).toBe('low')

    // Degrade to Step 2: DPR 1.5, quality 'low'
    time = feedFrames(monitor, 60, () => true, onStateChange, time)
    expect(monitor.getCurrentStep()).toBe(2)
    state = monitor.getScalingState()
    expect(state.dprCap).toBe(1.5)
    expect(state.qualityTierOverride).toBe('low')

    // Degrade to Step 3: DPR 1.0, quality 'low'
    time = feedFrames(monitor, 60, () => true, onStateChange, time)
    expect(monitor.getCurrentStep()).toBe(3)
    state = monitor.getScalingState()
    expect(state.dprCap).toBe(1.0)
    expect(state.qualityTierOverride).toBe('low')

    // Stay at maxStep (3)
    time = feedFrames(monitor, 60, () => true, onStateChange, time)
    expect(monitor.getCurrentStep()).toBe(3)
  })

  it('progresses steps correctly for auto + low quality', () => {
    const monitor = new QualityMonitor()
    monitor.setup(true, 'low')
    const onStateChange = vi.fn()

    let time = 1000
    // Warm up
    monitor.recordFrame(time, 2, onStateChange)

    // Step 0: DPR 2.0, quality 'low'
    let state = monitor.getScalingState()
    expect(state.dprCap).toBe(2.0)
    expect(state.qualityTierOverride).toBeUndefined()

    // Degrade to Step 1: DPR 1.5, quality 'low'
    time = feedFrames(monitor, 60, () => true, onStateChange, time)
    expect(monitor.getCurrentStep()).toBe(1)
    state = monitor.getScalingState()
    expect(state.dprCap).toBe(1.5)
    expect(state.qualityTierOverride).toBe('low')

    // Degrade to Step 2: DPR 1.0, quality 'low'
    time = feedFrames(monitor, 60, () => true, onStateChange, time)
    expect(monitor.getCurrentStep()).toBe(2)
    state = monitor.getScalingState()
    expect(state.dprCap).toBe(1.0)
    expect(state.qualityTierOverride).toBe('low')

    // Stay at maxStep (2)
    time = feedFrames(monitor, 60, () => true, onStateChange, time)
    expect(monitor.getCurrentStep()).toBe(2)
  })

  it('progresses steps correctly for manual quality mode', () => {
    const monitor = new QualityMonitor()
    monitor.setup(false, 'high') // manual mode
    const onStateChange = vi.fn()

    let time = 1000
    // Warm up
    monitor.recordFrame(time, 2, onStateChange)

    // Step 0: DPR 2.0, no quality override
    let state = monitor.getScalingState()
    expect(state.dprCap).toBe(2.0)
    expect(state.qualityTierOverride).toBeUndefined()

    // Degrade to Step 1: DPR 1.5
    time = feedFrames(monitor, 60, () => true, onStateChange, time)
    expect(monitor.getCurrentStep()).toBe(1)
    state = monitor.getScalingState()
    expect(state.dprCap).toBe(1.5)
    expect(state.qualityTierOverride).toBeUndefined()

    // Degrade to Step 2: DPR 1.0
    time = feedFrames(monitor, 60, () => true, onStateChange, time)
    expect(monitor.getCurrentStep()).toBe(2)
    state = monitor.getScalingState()
    expect(state.dprCap).toBe(1.0)
    expect(state.qualityTierOverride).toBeUndefined()

    // Stay at maxStep (2)
    time = feedFrames(monitor, 60, () => true, onStateChange, time)
    expect(monitor.getCurrentStep()).toBe(2)
  })

  it('recovers after 180 consecutive good frames', () => {
    const monitor = new QualityMonitor()
    monitor.setup(true, 'high')
    const onStateChange = vi.fn()

    let time = 1000
    // Warm up
    monitor.recordFrame(time, 2, onStateChange)

    // Degrade to step 1 (60 slow frames)
    time = feedFrames(monitor, 60, () => true, onStateChange, time)
    expect(monitor.getCurrentStep()).toBe(1)
    onStateChange.mockClear()

    // Record 179 consecutive good frames (should not recover yet)
    time = feedFrames(monitor, 179, () => false, onStateChange, time)
    expect(monitor.getCurrentStep()).toBe(1)
    expect(onStateChange).not.toHaveBeenCalled()

    // 180th consecutive good frame recovers step to 0
    time = feedFrames(monitor, 1, () => false, onStateChange, time)
    expect(monitor.getCurrentStep()).toBe(0)
    expect(onStateChange).toHaveBeenCalledTimes(1)
  })

  it('discards intervals > 100ms representing background pauses', () => {
    const monitor = new QualityMonitor()
    monitor.setup(true, 'high')
    const onStateChange = vi.fn()

    let time = 1000
    // Warm up
    monitor.recordFrame(time, 2, onStateChange)

    // Record 29 slow frames
    time = feedFrames(monitor, 29, () => true, onStateChange, time)

    // Record a 500ms suspend interval (should not count as slow, should reset stats)
    time += 500
    monitor.recordFrame(time, 2, onStateChange)

    // Record 30 more slow frames (normally total would be 59, but the split resets consecutive Good / frameTimes counts since we start anew)
    // Note that after suspension, the next frame will be treated as warm up for the new sequence.
    // So the first frame in feedFrames after the 500ms suspend will be warm up, and then 29 slow frames.
    // Total window after suspension will be 29 frames, which is < 60, so it won't degrade.
    time = feedFrames(monitor, 30, () => true, onStateChange, time)

    // Quality should not degrade since window has not accumulated 60 frames after reset
    expect(monitor.getCurrentStep()).toBe(0)
    expect(onStateChange).not.toHaveBeenCalled()
  })

  it('does nothing when disabled', () => {
    const monitor = new QualityMonitor(false)
    monitor.setup(true, 'high')
    const onStateChange = vi.fn()

    let time = 1000
    // Warm up
    monitor.recordFrame(time, 2, onStateChange)

    feedFrames(monitor, 100, () => true, onStateChange, time)

    expect(monitor.getCurrentStep()).toBe(0)
    expect(onStateChange).not.toHaveBeenCalled()
  })
})
