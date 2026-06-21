import type { AtmosphereQuality } from './types'

export type QualityScalingState = {
  dprCap: number
  densityMultiplier: number
  disableHighCostFeatures: boolean
  qualityTierOverride?: Exclude<AtmosphereQuality, 'auto'>
}

export class QualityMonitor {
  private currentStep = 0 // 0 = normal, 1 = moderate, 2 = severe degradation
  private frameTimes: number[] = []
  private frameDurations: number[] = []
  private lastFrameTime?: number
  private consecutiveGoodFrames = 0
  private enabled = true

  constructor(enabled: boolean = true) {
    this.enabled = enabled
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled
    if (!enabled) {
      this.reset()
    }
  }

  reset() {
    this.currentStep = 0
    this.frameTimes = []
    this.frameDurations = []
    this.lastFrameTime = undefined
    this.consecutiveGoodFrames = 0
  }

  recordFrame(startTime: number, duration: number, onStateChange: () => void) {
    if (!this.enabled) {
      return
    }

    if (this.lastFrameTime === undefined) {
      this.lastFrameTime = startTime
      return
    }

    const interval = startTime - this.lastFrameTime
    this.lastFrameTime = startTime

    // Skip tracking if the tab was suspended/backgrounded (interval > 100ms)
    // to avoid penalizing performance for browser throttling.
    if (interval > 100) {
      this.consecutiveGoodFrames = 0
      return
    }

    // A frame is "slow" if the frame interval is > 25ms (under 40fps)
    // OR if the active drawing duration alone exceeds 12ms.
    const isSlow = interval > 25 || duration > 12

    this.frameTimes.push(interval)
    this.frameDurations.push(duration)
    if (this.frameTimes.length > 60) {
      this.frameTimes.shift()
      this.frameDurations.shift()
    }

    if (isSlow) {
      this.consecutiveGoodFrames = 0
    } else {
      this.consecutiveGoodFrames += 1
    }

    // Check for degradation trigger (at least 30 frames needed to sample)
    if (this.frameTimes.length >= 30) {
      let slowCount = 0
      for (let i = 0; i < this.frameTimes.length; i++) {
        const fInterval = this.frameTimes[i]
        const fDuration = this.frameDurations[i]
        if (fInterval > 25 || fDuration > 12) {
          slowCount++
        }
      }

      const slowRatio = slowCount / this.frameTimes.length
      if (slowRatio >= 0.30) {
        // Degrade quality step
        if (this.currentStep < 2) {
          this.currentStep++
          this.frameTimes = []
          this.frameDurations = []
          this.consecutiveGoodFrames = 0
          onStateChange()
          return
        }
      }
    }

    // Check for recovery trigger
    // Require 180 consecutive fast frames (approx. 3s at 60fps) to recover 1 step.
    if (this.currentStep > 0 && this.consecutiveGoodFrames >= 180) {
      this.currentStep--
      this.consecutiveGoodFrames = 0
      this.frameTimes = []
      this.frameDurations = []
      onStateChange()
    }
  }

  getScalingState(): QualityScalingState {
    if (this.currentStep === 0 || !this.enabled) {
      return {
        dprCap: 2.0,
        densityMultiplier: 1.0,
        disableHighCostFeatures: false,
      }
    }

    if (this.currentStep === 1) {
      return {
        dprCap: 1.5,
        densityMultiplier: 0.7,
        disableHighCostFeatures: false,
        qualityTierOverride: 'medium',
      }
    }

    // Step 2: Severe degradation
    return {
      dprCap: 1.0,
      densityMultiplier: 0.4,
      disableHighCostFeatures: true,
      qualityTierOverride: 'low',
    }
  }

  getCurrentStep(): number {
    return this.currentStep
  }
}
