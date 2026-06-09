import { describe, expect, it } from 'vitest'
import type { CollisionTargetRect } from '../src/dom/collisionTargets'
import { findTopEdgeCollision } from '../src/renderers/canvas2d/collision'

const target: CollisionTargetRect = {
  x: 40,
  y: 100,
  width: 120,
  height: 60,
  right: 160,
  bottom: 160,
}

describe('findTopEdgeCollision', () => {
  it('detects a downward crossing inside horizontal bounds', () => {
    expect(findTopEdgeCollision(70, 80, 90, 120, [target])).toEqual({
      x: 80,
      y: 100,
      target,
    })
  })

  it('ignores movement that misses the target bounds', () => {
    expect(findTopEdgeCollision(10, 80, 20, 120, [target])).toBeUndefined()
  })

  it('ignores particles that do not cross downward through the top edge', () => {
    expect(findTopEdgeCollision(70, 120, 90, 80, [target])).toBeUndefined()
    expect(findTopEdgeCollision(70, 40, 90, 80, [target])).toBeUndefined()
  })

  it('chooses the nearest crossed top edge along the particle path', () => {
    const lowerTarget: CollisionTargetRect = {
      x: 40,
      y: 140,
      width: 120,
      height: 60,
      right: 160,
      bottom: 200,
    }
    const upperTarget: CollisionTargetRect = {
      x: 40,
      y: 90,
      width: 120,
      height: 60,
      right: 160,
      bottom: 150,
    }

    expect(findTopEdgeCollision(80, 40, 80, 160, [lowerTarget, upperTarget])).toEqual({
      x: 80,
      y: 90,
      target: upperTarget,
    })
  })
})
