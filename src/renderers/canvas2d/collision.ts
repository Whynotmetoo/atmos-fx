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

  for (const target of targets) {
    if (previousY > target.y || nextY < target.y) {
      continue
    }

    const progress = (target.y - previousY) / (nextY - previousY)
    const hitX = previousX + (nextX - previousX) * progress

    if (hitX >= target.x && hitX <= target.right) {
      return {
        x: hitX,
        y: target.y,
        target,
      }
    }
  }

  return undefined
}
