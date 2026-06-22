import type { AtmosphereQuality } from './types'

export type QualityScalingState = {
  dprCap: number
  qualityTierOverride?: Exclude<AtmosphereQuality, 'auto'>
}

export class QualityMonitor {
  private currentStep = 0 // 0 = normal, then degraded steps
  private frameTimes: number[] = []
  private frameDurations: number[] = []
  private lastFrameTime?: number
  private consecutiveGoodFrames = 0
  private enabled = true

  private isAuto = true
  private baseQuality: Exclude<AtmosphereQuality, 'auto'> = 'high'

  constructor(enabled: boolean = true) {
    this.enabled = enabled
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled
    if (!enabled) {
      this.reset()
    }
  }

  setup(isAuto: boolean, baseQuality: Exclude<AtmosphereQuality, 'auto'>) {
    this.isAuto = isAuto
    this.baseQuality = baseQuality
    
    // Clamp currentStep if maxStep has decreased
    const maxStep = this.getMaxStep()
    if (this.currentStep > maxStep) {
      this.currentStep = maxStep
      this.frameTimes = []
      this.frameDurations = []
      this.consecutiveGoodFrames = 0
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
    if (this.currentStep === 0 || !this.enabled) {
      return {
        dprCap: 2.0,
      }
    }

    if (this.isAuto) {
      if (this.baseQuality === 'high') {
        switch (this.currentStep) {
          case 1: return { dprCap: 2.0, qualityTierOverride: 'medium' }
          case 2: return { dprCap: 2.0, qualityTierOverride: 'low' }
          case 3: return { dprCap: 1.5, qualityTierOverride: 'low' }
          default: return { dprCap: 1.0, qualityTierOverride: 'low' }
        }
      } else if (this.baseQuality === 'medium') {
        switch (this.currentStep) {
          case 1: return { dprCap: 2.0, qualityTierOverride: 'low' }
          case 2: return { dprCap: 1.5, qualityTierOverride: 'low' }
          default: return { dprCap: 1.0, qualityTierOverride: 'low' }
        }
      } else {
        // baseQuality === 'low'
        switch (this.currentStep) {
          case 1: return { dprCap: 1.5, qualityTierOverride: 'low' }
          default: return { dprCap: 1.0, qualityTierOverride: 'low' }
        }
      }
    } else {
      // Manual quality
      switch (this.currentStep) {
        case 1: return { dprCap: 1.5 }
        default: return { dprCap: 1.0 }
      }
    }
  }

  getCurrentStep(): number {
    return this.currentStep
  }

  private getMaxStep(): number {
    if (this.isAuto) {
      if (this.baseQuality === 'high') return 4
      if (this.baseQuality === 'medium') return 3
      return 2
    }
    return 2
  }
}
