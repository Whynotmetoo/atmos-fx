import type { AtmosphereQuality } from './types'

export type QualityScalingState = {
  dprCap: number
  qualityTierOverride?: Exclude<AtmosphereQuality, 'auto'>
}

export class QualityMonitor {
  // Auto starts at medium (step 1), can promote to high (step 0), and
  // degrades through low quality before reducing DPR (steps 2-4).
  private currentStep: number
  private frameTimes: number[] = []
  private frameDurations: number[] = []
  private lastFrameTime?: number
  private consecutiveGoodFrames = 0
  private isAuto: boolean

  constructor(isAuto = true) {
    this.isAuto = isAuto
    this.currentStep = 0
  }

  setup(isAuto: boolean) {
    if (isAuto === this.isAuto) {
      return
    }

    this.isAuto = isAuto
    this.reset()
  }

  reset() {
    this.currentStep = 0
    this.frameTimes = []
    this.frameDurations = []
    this.lastFrameTime = undefined
    this.consecutiveGoodFrames = 0
  }

  recordFrame(startTime: number, duration: number, onStateChange: () => void) {
    if (this.lastFrameTime === undefined) {
      this.lastFrameTime = startTime
      return
    }

    const interval = startTime - this.lastFrameTime
    this.lastFrameTime = startTime

    // Skip tracking if the tab was suspended/backgrounded (interval > 100ms)
    // to avoid penalizing performance for browser throttling.
    if (interval > 100) {
      this.frameTimes = []
      this.frameDurations = []
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

    const maxStep = this.getMaxStep()

    // Robust check: require a FULL sliding window of 60 frames to trigger degradation.
    if (this.frameTimes.length >= 60) {
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
        if (this.currentStep < maxStep) {
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
    if (this.isAuto) {
      switch (this.currentStep) {
        case 0: return { dprCap: 2.0 }
        case 1: return { dprCap: 2.0, qualityTierOverride: 'medium' }
        case 2: return { dprCap: 2.0, qualityTierOverride: 'low' }
        case 3: return { dprCap: 1.5, qualityTierOverride: 'low' }
        default: return { dprCap: 1.0, qualityTierOverride: 'low' }
      }
    }

    switch (this.currentStep) {
      case 0: return { dprCap: 2.0 }
      case 1: return { dprCap: 1.5 }
      default: return { dprCap: 1.0 }
    }
  }

  getCurrentStep(): number {
    return this.currentStep
  }

  private getMaxStep(): number {
    return this.isAuto ? 4 : 2
  }
}
