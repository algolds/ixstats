/**
 * The studio's calibration readout: a draft world's land share, elevation profile and climate mix beside the
 * Ixnay and Eurth targets, so a preset can be tuned against the two hand-drawn maps.
 */

import {
  CLIMATE_REFERENCE,
  calibrationReadout,
  measureHypsometry,
} from "~/lib/worldgen/world-calibration";
import { WORLD_PRESETS } from "~/lib/worldgen/v2/config";
import type { WorldPreviewStats } from "~/lib/worldgen/world-stats";

/** Cells as the worker packs them: lng, lat, height in metres. */
const heights = (...h: number[]) => Float32Array.from(h.flatMap((m, i) => [i, 0, m]));

const stats = (over: Partial<WorldPreviewStats> = {}): WorldPreviewStats => ({
  landShare: 0.3,
  continents: 5,
  climateMix: {},
  slotCount: 0,
  baseline: null,
  ...over,
});

describe("measureHypsometry", () => {
  it("shares the land cells among the nine elevation zones, ignoring the sea", () => {
    // Zones by metres: 0-99 zone 0, 100-349 zone 1, 5000+ zone 8
    const zones = measureHypsometry(heights(10, 20, 150, 6000, -50, -4000));
    expect(zones).toHaveLength(9);
    expect(zones[0]).toBeCloseTo(50, 10);
    expect(zones[1]).toBeCloseTo(25, 10);
    expect(zones[8]).toBeCloseTo(25, 10);
    expect(zones.reduce((a, b) => a + b, 0)).toBeCloseTo(100, 10);
  });

  it("counts a cell at sea level as land", () => {
    expect(measureHypsometry(heights(0, -1))[0]).toBe(100);
  });

  it("reads all zeros for a world with no land", () => {
    expect(measureHypsometry(heights(-10, -20))).toEqual(new Array(9).fill(0));
    expect(measureHypsometry(new Float32Array())).toEqual(new Array(9).fill(0));
  });
});

describe("calibrationReadout", () => {
  const readout = calibrationReadout({
    stats: stats({ landShare: 0.25, climateMix: { A: 0.4, D: 0.6 } }),
    cells: heights(10, 10, 10, 200),
  });

  it("sets the land share beside both presets' land share, in percent", () => {
    expect(readout.landShare.draft).toBeCloseTo(25, 10);
    expect(readout.landShare.ixnay).toBeCloseTo(
      (1 - WORLD_PRESETS.ixnay.oceanPercentage) * 100,
      10
    );
    expect(readout.landShare.eurth).toBeCloseTo(
      (1 - WORLD_PRESETS.eurth.oceanPercentage) * 100,
      10
    );
  });

  it("has one hypsometry row per elevation zone, with the presets' curves normalised to 100", () => {
    expect(readout.hypsometry).toHaveLength(9);
    expect(readout.hypsometry[0]).toMatchObject({ label: "Coastal Lowlands" });
    expect(readout.hypsometry[0]!.draft).toBeCloseTo(75, 10);
    expect(readout.hypsometry[1]!.draft).toBeCloseTo(25, 10);
    for (const preset of ["ixnay", "eurth"] as const) {
      const total = readout.hypsometry.reduce((sum, row) => sum + row[preset]!, 0);
      expect(total).toBeCloseTo(100, 10);
    }
    const raw = WORLD_PRESETS.ixnay.hypsometry;
    const sum = raw.reduce((a, b) => a + b, 0);
    expect(readout.hypsometry[0]!.ixnay).toBeCloseTo((raw[0]! / sum) * 100, 10);
  });

  it("has one climate row per group, zero for a group the draft lacks", () => {
    expect(readout.climate.map((row) => row.label)).toEqual([
      "Tropical",
      "Dry",
      "Subtropical",
      "Temperate",
      "Boreal",
      "Polar",
      "Highland",
    ]);
    expect(readout.climate[0]!.draft).toBeCloseTo(40, 10);
    expect(readout.climate[1]!.draft).toBe(0);
    expect(readout.climate[3]!.draft).toBeCloseTo(60, 10);
    expect(readout.climate[0]).toMatchObject(CLIMATE_REFERENCE.A);
  });

  it("leaves a target blank where the reference map has no such class", () => {
    const highland = readout.climate[6]!;
    expect(highland.eurth).toBeNull();
    expect(highland.ixnay).not.toBeNull();
  });

  it("measures each preset's distance as the mean gap over the rows that have a target", () => {
    const rows = [...readout.hypsometry, ...readout.climate].filter((row) => row.ixnay !== null);
    const mean = rows.reduce((sum, row) => sum + Math.abs(row.draft - row.ixnay!), 0) / rows.length;
    expect(readout.distance.ixnay).toBeCloseTo(mean, 10);
    expect(readout.distance.eurth).toBeGreaterThan(0);
  });

  it("puts a draft made from a preset's own curve at distance zero on its hypsometry", () => {
    // 1000 cells spread over the Ixnay curve; the climate mix is the reference's too
    const curve = WORLD_PRESETS.ixnay.hypsometry;
    const metres = [50, 200, 400, 700, 1500, 2500, 3500, 4500, 6000];
    const cells = heights(
      ...curve.flatMap((share, zone) => new Array(Math.round(share * 10)).fill(metres[zone]!))
    );
    const mix = Object.fromEntries(
      Object.entries(CLIMATE_REFERENCE).map(([group, ref]) => [group, ref.ixnay! / 100])
    );
    const exact = calibrationReadout({ stats: stats({ climateMix: mix }), cells });
    expect(exact.distance.ixnay).toBeLessThan(0.2);
    expect(exact.distance.eurth).toBeGreaterThan(exact.distance.ixnay);
  });
});
