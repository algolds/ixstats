/**
 * Tests for transport cost calculation.
 * Locks the per-km cost factors and the maintenance rate so a future
 * change has to update both this file and the table intentionally.
 */

import {
  calculateRouteCosts,
  calculateIntermodalTransfer,
  getRouteFamily,
} from "~/lib/economy/transport-costs";

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

  it("rounds costBillion and maintenanceCost to 3 decimals", () => {
    const r = calculateRouteCosts({ routeType: "rail", lengthKm: 1, terrainDifficulty: 0.333 });
    // 1 * 0.04 * (1 + 0.4995) = 0.05998
    expect(r.costBillion).toBe(0.06); // 0.05998 rounded to 3 dp = 0.06
    expect(r.maintenanceCost).toBe(0.001); // 0.05998 * 0.02 = 0.0011996 -> 0.001
  });
});

describe("calculateIntermodalTransfer", () => {
  it("determines correct modal families", () => {
    expect(getRouteFamily("freight_rail")).toBe("rail");
    expect(getRouteFamily("high_speed_rail")).toBe("rail");
    expect(getRouteFamily("motorway")).toBe("road");
    expect(getRouteFamily("shipping_lane")).toBe("maritime");
    expect(getRouteFamily("canal")).toBe("maritime");
    expect(getRouteFamily("air_corridor")).toBe("air");
    expect(getRouteFamily("pipeline")).toBe("utility");
    expect(getRouteFamily("military_supply")).toBe("military");
  });

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

  it("handles rail to road transfer with station hub", () => {
    const transfer = calculateIntermodalTransfer({
      fromType: "freight_rail",
      toType: "motorway",
      volumeTons: 10_000,
    });
    expect(transfer.isCompatible).toBe(true);
    expect(transfer.hubTypeRequired).toBe("station");
    expect(transfer.transferDelayHours).toBe(4.0);
    expect(transfer.transferCostBillion).toBe(0.002);
  });

  it("handles air cargo transfer with airport hub", () => {
    const transfer = calculateIntermodalTransfer({
      fromType: "air_corridor",
      toType: "trunk",
      volumeTons: 5_000,
    });
    expect(transfer.isCompatible).toBe(true);
    expect(transfer.hubTypeRequired).toBe("airport");
    expect(transfer.transferDelayHours).toBe(6.0);
    expect(transfer.transferCostBillion).toBe(0.004); // half of 0.008
  });

  it("handles same-modality shunting and switching", () => {
    const railToRail = calculateIntermodalTransfer({
      fromType: "rail",
      toType: "freight_rail",
      volumeTons: 10_000,
    });
    expect(railToRail.isCompatible).toBe(true);
    expect(railToRail.hubTypeRequired).toBe("station");
    expect(railToRail.transferDelayHours).toBe(1.5);
    expect(railToRail.transferCostBillion).toBe(0.0002);

    const roadToRoad = calculateIntermodalTransfer({
      fromType: "motorway",
      toType: "road",
      volumeTons: 10_000,
    });
    expect(roadToRoad.isCompatible).toBe(true);
    expect(roadToRoad.hubTypeRequired).toBe("interchange");
    expect(roadToRoad.transferDelayHours).toBe(0.5);
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
