import { describe, expect, it } from 'vitest'
import type { CollisionTargetRect } from '../src/dom/collisionTargets'
import { findTopEdgeCollision, findTargetCollision } from '../src/renderers/canvas2d/collision'

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

describe('findTargetCollision', () => {
  it('detects top edge collision (moving downward)', () => {
    expect(findTargetCollision(70, 80, 90, 120, [target])).toEqual({
      x: 80,
      y: 100,
      target,
      type: 'top',
    })
  })

  it('detects left edge collision (moving rightward)', () => {
    // Starts at x=20, y=120. Moves to x=60, y=140.
    // Crosses x=40 (target.x).
    // progress = (40 - 20) / (60 - 20) = 0.5.
    // hitY = 120 + 20 * 0.5 = 130.
    // Since 130 is in [100, 160] target Y bounds, it should collide on the left.
    expect(findTargetCollision(20, 120, 60, 140, [target])).toEqual({
      x: 40,
      y: 130,
      target,
      type: 'left',
    })
  })

  it('detects right edge collision (moving leftward)', () => {
    // Starts at x=180, y=110. Moves to x=140, y=130.
    // Crosses x=160 (target.right).
    // progress = (160 - 180) / (140 - 180) = 0.5.
    // hitY = 110 + 20 * 0.5 = 120.
    // Since 120 is in [100, 160] target Y bounds, it should collide on the right.
    expect(findTargetCollision(180, 110, 140, 130, [target])).toEqual({
      x: 160,
      y: 120,
      target,
      type: 'right',
    })
  })

  it('ignores collisions outside vertical boundaries of target side walls', () => {
    // Starts at x=20, y=80. Moves to x=60, y=90.
    // Crosses x=40 (target.x).
    // progress = 0.5. hitY = 85.
    // Since 85 is above target.y (100), it should not collide.
    expect(findTargetCollision(20, 80, 60, 90, [target])).toBeUndefined()
  })

  it('respects borderRadius to reduce collision boundaries on top and side edges', () => {
    const roundedTarget: CollisionTargetRect = {
      ...target,
      borderRadius: 10,
    }

    // Top edge check: x=40, right=160. Offset is 10, so active collision range is [50, 150].
    // Crossing at x=45 (within the 10px corner zone) -> should not collide.
    expect(findTopEdgeCollision(45, 80, 45, 120, [roundedTarget])).toBeUndefined()
    expect(findTargetCollision(45, 80, 45, 120, [roundedTarget])).toBeUndefined()

    // Crossing at x=70 (safe zone) -> should collide.
    expect(findTopEdgeCollision(70, 80, 70, 120, [roundedTarget])).toBeDefined()
    expect(findTargetCollision(70, 80, 70, 120, [roundedTarget])).toBeDefined()

    // Side edge check: y=100, bottom=160. Offset is 10, so active collision range is [110, 150].
    // Crossing at y=105 (within the 10px corner zone) -> should not collide.
    expect(findTargetCollision(20, 105, 60, 105, [roundedTarget])).toBeUndefined()

    // Crossing at y=130 (safe zone) -> should collide.
    expect(findTargetCollision(20, 130, 60, 130, [roundedTarget])).toBeDefined()
  })
})
