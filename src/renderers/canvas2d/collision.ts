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

  for (const target of targets) {
    if (previousY > target.y || nextY < target.y) {
      continue
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
