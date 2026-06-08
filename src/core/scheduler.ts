type FrameCallback = (time: number) => void

export type AnimationScheduler = {
  start(): void
  stop(): void
  isRunning(): boolean
}

export function createAnimationScheduler(onFrame: FrameCallback): AnimationScheduler {
  let frameId: number | undefined
  let running = false

  const requestFrame = (callback: FrameRequestCallback): number => {
    if (typeof window !== 'undefined' && window.requestAnimationFrame) {
      return window.requestAnimationFrame(callback)
    }

    return globalThis.setTimeout(() => callback(performance.now()), 16)
  }

  const cancelFrame = (id: number) => {
    if (typeof window !== 'undefined' && window.cancelAnimationFrame) {
      window.cancelAnimationFrame(id)
      return
    }

    globalThis.clearTimeout(id)
  }

  const tick: FrameRequestCallback = (time) => {
    if (!running) {
      return
    }

    onFrame(time)
    frameId = requestFrame(tick)
  }

  return {
    start() {
      if (running) {
        return
      }

      running = true
      frameId = requestFrame(tick)
    },
    stop() {
      running = false

      if (frameId !== undefined) {
        cancelFrame(frameId)
        frameId = undefined
      }
    },
    isRunning() {
      return running
    },
  }
}
