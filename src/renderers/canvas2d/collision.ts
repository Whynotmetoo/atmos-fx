import type { CollisionTargetRect } from '../../dom/collisionTargets'

export type TopEdgeCollision = {
  x: number
  y: number
  target: CollisionTargetRect
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

    if (hitX >= target.x && hitX <= target.right && progress < nearestProgress) {
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
