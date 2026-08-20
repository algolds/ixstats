/**
 * Tests for transport cost calculation.
 * Locks the per-km cost factors and the maintenance rate so a future
 * change has to update both this file and the table intentionally.
 */

import { calculateRouteCosts } from "~/lib/economy/transport-costs";

describe("calculateRouteCosts", () => {
  it("applies the rail cost factor (0.04) at zero terrain difficulty", () => {
    const r = calculateRouteCosts({ routeType: "rail", lengthKm: 100, terrainDifficulty: 0 });
    expect(r.costBillion).toBe(4); // 100 * 0.04 * 1 = 4
    expect(r.maintenanceCost).toBe(0.08); // 4 * 0.02
  });

  it("applies terrain-difficulty multiplier (1 + d * 1.5)", () => {
    const r = calculateRouteCosts({ routeType: "highway", lengthKm: 100, terrainDifficulty: 0.5 });
    // 100 * 0.05 * (1 + 0.75) = 8.75
    expect(r.costBillion).toBe(8.75);
  });

  it("falls back to the road default (0.01) for unknown types", () => {
    const known = calculateRouteCosts({ routeType: "road", lengthKm: 100, terrainDifficulty: 0 });
    const unknown = calculateRouteCosts({
      routeType: "nonsense",
      lengthKm: 100,
      terrainDifficulty: 0,
    });
    expect(unknown.costBillion).toBe(known.costBillion);
  });

  it("covers the new types added in Plan 046", () => {
    expect(
      calculateRouteCosts({ routeType: "pipeline", lengthKm: 100, terrainDifficulty: 0 })
        .costBillion
    ).toBe(3); // 100 * 0.03
    expect(
      calculateRouteCosts({ routeType: "power_grid", lengthKm: 100, terrainDifficulty: 0 })
        .costBillion
    ).toBe(2); // 100 * 0.02
    expect(
      calculateRouteCosts({ routeType: "fiber", lengthKm: 100, terrainDifficulty: 0 }).costBillion
    ).toBe(0.5); // 100 * 0.005
    expect(
      calculateRouteCosts({ routeType: "military_supply", lengthKm: 100, terrainDifficulty: 0 })
        .costBillion
    ).toBe(2); // 100 * 0.02
    expect(
      calculateRouteCosts({ routeType: "military_naval", lengthKm: 100, terrainDifficulty: 0 })
        .costBillion
    ).toBe(0.5); // 100 * 0.005
  });

  it("rounds costBillion and maintenanceCost to 3 decimals", () => {
    const r = calculateRouteCosts({ routeType: "rail", lengthKm: 1, terrainDifficulty: 0.333 });
    // 1 * 0.04 * (1 + 0.4995) = 0.05998
    expect(r.costBillion).toBe(0.06); // 0.05998 rounded to 3 dp = 0.06
    expect(r.maintenanceCost).toBe(0.001); // 0.05998 * 0.02 = 0.0011996 -> 0.001
  });
});
