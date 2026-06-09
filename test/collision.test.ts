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
})
