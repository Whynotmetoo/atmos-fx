import type { CollisionTargetRect } from '../../dom/collisionTargets'

export type TopEdgeCollision = {
  x: number
  y: number
  target: CollisionTargetRect
}

export type TargetCollision = {
  x: number
  y: number
  target: CollisionTargetRect
  type: 'top' | 'left' | 'right'
}

export function findTopEdgeCollision(
  previousX: number,
  previousY: number,
  nextX: number,
  nextY: number,
  targets: readonly CollisionTargetRect[],
): TopEdgeCollision | undefined {
  if (nextY <= previousY) {
    return undefined
  }

  let nearestCollision: TopEdgeCollision | undefined
  let nearestProgress = Number.POSITIVE_INFINITY

  let left = 0
  let right = targets.length - 1
  let startIndex = targets.length

  while (left <= right) {
    const mid = Math.floor((left + right) / 2)
    const target = targets[mid]!

    if (target.y >= previousY) {
      startIndex = mid
      right = mid - 1
    } else {
      left = mid + 1
    }
  }

  for (let i = startIndex; i < targets.length; i++) {
    const target = targets[i]!

    if (target.y > nextY) {
      break
    }

    const progress = (target.y - previousY) / (nextY - previousY)
    const hitX = previousX + (nextX - previousX) * progress
    const r = target.borderRadius ?? 0

    if (hitX >= target.x + r && hitX <= target.right - r && progress < nearestProgress) {
      nearestProgress = progress
      nearestCollision = {
        x: hitX,
        y: target.y,
        target,
      }
    }
  }

  return nearestCollision
}

export function findTargetCollision(
  previousX: number,
  previousY: number,
  nextX: number,
  nextY: number,
  targets: readonly CollisionTargetRect[],
): TargetCollision | undefined {
  let nearestCollision: TargetCollision | undefined
  let nearestProgress = Number.POSITIVE_INFINITY

  const minY = Math.min(previousY, nextY)
  const maxY = Math.max(previousY, nextY)
  const minX = Math.min(previousX, nextX)
  const maxX = Math.max(previousX, nextX)

  for (let i = 0; i < targets.length; i++) {
    const target = targets[i]!

    if (target.y > maxY) {
      break
    }

    if (
      target.bottom < minY ||
      target.x > maxX ||
      target.right < minX
    ) {
      continue
    }

    // 1. Top Edge Collision (moving downwards)
    if (nextY > previousY) {
      const progress = (target.y - previousY) / (nextY - previousY)
      if (progress >= 0 && progress <= 1 && progress < nearestProgress) {
        const hitX = previousX + (nextX - previousX) * progress
        const r = target.borderRadius ?? 0
        if (hitX >= target.x + r && hitX <= target.right - r) {
          nearestProgress = progress
          nearestCollision = {
            x: hitX,
            y: target.y,
            target,
            type: 'top',
          }
        }
      }
    }

    // 2. Left Edge Collision (moving rightwards hits target's left boundary)
    if (nextX > previousX) {
      const progress = (target.x - previousX) / (nextX - previousX)
      if (progress >= 0 && progress <= 1 && progress < nearestProgress) {
        const hitY = previousY + (nextY - previousY) * progress
        const r = target.borderRadius ?? 0
        if (hitY >= target.y + r && hitY <= target.bottom - r) {
          nearestProgress = progress
          nearestCollision = {
            x: target.x,
            y: hitY,
            target,
            type: 'left',
          }
        }
      }
    }

    // 3. Right Edge Collision (moving leftwards hits target's right boundary)
    if (nextX < previousX) {
      const progress = (target.right - previousX) / (nextX - previousX)
      if (progress >= 0 && progress <= 1 && progress < nearestProgress) {
        const hitY = previousY + (nextY - previousY) * progress
        const r = target.borderRadius ?? 0
        if (hitY >= target.y + r && hitY <= target.bottom - r) {
          nearestProgress = progress
          nearestCollision = {
            x: target.right,
            y: hitY,
            target,
            type: 'right',
          }
        }
      }
    }
  }

  return nearestCollision
}
