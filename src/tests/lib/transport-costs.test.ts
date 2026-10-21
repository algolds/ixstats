/**
 * Tests for transport cost calculation.
 * Locks the per-km cost factors and the maintenance rate so a future
 * change has to update both this file and the table intentionally.
 */

import {
  calculateRouteCosts,
  calculateIntermodalTransfer
} from "~/lib/economy/transport-costs";

describe("calculateRouteCosts", () => {
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
  it("covers sub-types for rail and road families", () => {
    // High-speed rail: 0.08
    expect(
      calculateRouteCosts({ routeType: "high_speed_rail", lengthKm: 100, terrainDifficulty: 0 })
        .costBillion
    ).toBe(8);
    // Freight rail: 0.035
    expect(
      calculateRouteCosts({ routeType: "freight_rail", lengthKm: 100, terrainDifficulty: 0 })
        .costBillion
    ).toBe(3.5);
    // Commuter rail: 0.03
    expect(
      calculateRouteCosts({ routeType: "commuter_rail", lengthKm: 100, terrainDifficulty: 0 })
        .costBillion
    ).toBe(3);
    // Motorway: 0.06
    expect(
      calculateRouteCosts({ routeType: "motorway", lengthKm: 100, terrainDifficulty: 0 })
        .costBillion
    ).toBe(6);
    // Trunk road: 0.025
    expect(
      calculateRouteCosts({ routeType: "trunk", lengthKm: 100, terrainDifficulty: 0 })
        .costBillion
    ).toBe(2.5);
    // Secondary road: 0.007
    expect(
      calculateRouteCosts({ routeType: "secondary", lengthKm: 100, terrainDifficulty: 0 })
        .costBillion
    ).toBe(0.7);
  });
});

describe("calculateIntermodalTransfer", () => {
  it("calculates maritime to rail transfer with port hub and dwell time", () => {
    const transfer = calculateIntermodalTransfer({
      fromType: "shipping_lane",
      toType: "freight_rail",
      volumeTons: 10_000,
    });
    expect(transfer.isCompatible).toBe(true);
    expect(transfer.hubTypeRequired).toBe("port");
    expect(transfer.transferDelayHours).toBe(12.0);
    expect(transfer.transferCostBillion).toBe(0.003);
    expect(transfer.description).toContain("Container Terminal");
  });

  it("scales transfer costs linearly with cargo tonnage", () => {
    const transfer20k = calculateIntermodalTransfer({
      fromType: "shipping_lane",
      toType: "freight_rail",
      volumeTons: 20_000,
    });
    expect(transfer20k.transferCostBillion).toBe(0.006);
  });
  it("correctly flags incompatible utility transfers", () => {
    const transfer = calculateIntermodalTransfer({
      fromType: "pipeline",
      toType: "freight_rail",
      volumeTons: 10_000,
    });
    expect(transfer.isCompatible).toBe(false);
    expect(transfer.description).toContain("Incompatible");

    const utilityP2P = calculateIntermodalTransfer({
      fromType: "pipeline",
      toType: "power_grid",
      volumeTons: 10_000,
    });
    expect(utilityP2P.isCompatible).toBe(true);
    expect(utilityP2P.description).toContain("Utility Grid Interconnect");
  });
});
