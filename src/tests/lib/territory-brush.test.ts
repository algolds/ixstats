/**
 * Tests for territory-brush.ts (plan 012 production build).
 *
 * Fixture: two adjacent unit squares meeting at x=0.
 *
 *   S (source): x ∈ [-1, 0], y ∈ [0, 1]  (left square)
 *   T (target): x ∈ [0,  1], y ∈ [0, 1]  (right square)
 *
 * A brush stroke near x=0 (the shared border) should transfer a slice of S → T.
 *
 * calculateArea is used to assert direction of change.
 * Exact areas need not match — we just care about sign.
 */

import type { Polygon } from "geojson";
import { applyBrushStroke } from "~/lib/maps/territory-brush";
import { calculateArea } from "~/lib/maps/border-editor";

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

/** Left unit square: x ∈ [-1,0], y ∈ [0,1] — this is the SOURCE territory. */
const SOURCE: Polygon = {
  type: "Polygon",
  coordinates: [
    [
      [-1, 0],
      [0, 0],
      [0, 1],
      [-1, 1],
      [-1, 0],
    ],
  ],
};

/** Right unit square: x ∈ [0,1], y ∈ [0,1] — this is the TARGET territory. */
const TARGET: Polygon = {
  type: "Polygon",
  coordinates: [
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
      [0, 0],
    ],
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("applyBrushStroke", () => {
  const sourceAreaBefore = calculateArea(SOURCE);
  const targetAreaBefore = calculateArea(TARGET);

  test("transfers area from source to target when stroke overlaps shared border", () => {
    // Stroke runs along the shared border (x ≈ 0), biased slightly into source (x = -0.1).
    // radius 20 km at near-equator is ~0.18° — small enough to transfer a slice without
    // consuming the whole source.
    const strokePoints: [number, number][] = [
      [-0.1, 0.2],
      [-0.1, 0.8],
    ];
    const radiusKm = 20; // ~0.18° at equator

    const result = applyBrushStroke(strokePoints, radiusKm, SOURCE, TARGET);

    expect(result).not.toBeNull();

    const newSourceArea = calculateArea(result!.source);
    const newTargetArea = calculateArea(result!.target);

    // Source must have shrunk
    expect(newSourceArea).toBeLessThan(sourceAreaBefore);
    // Target must have grown
    expect(newTargetArea).toBeGreaterThan(targetAreaBefore);
    // Conservation: total area should be approximately the same (allow ±5% for floating point)
    const totalBefore = sourceAreaBefore + targetAreaBefore;
    const totalAfter = newSourceArea + newTargetArea;
    expect(totalAfter).toBeCloseTo(totalBefore, -2); // within ~1% (relative)
  });

  test("returns null when stroke does not overlap source at all", () => {
    // Stroke entirely inside the target (right) square — far from source.
    const strokePoints: [number, number][] = [
      [0.7, 0.3],
      [0.7, 0.7],
    ];
    const result = applyBrushStroke(strokePoints, 5, SOURCE, TARGET);
    expect(result).toBeNull();
  });
});
