/**
 * The Calibration tab's single "distance" between a generated world and a realm: five equally weighted parts, each
 * 0 (the same) to 1 (nothing in common), shown as 0 to 100.
 */
import { calibrationDistance, relativeGap } from "~/lib/worldgen/calibration-distance";
import { TREWARTHA_GROUPS, type WorldMeasures } from "~/lib/worldgen/measure-world";

const climate = (over: Partial<Record<(typeof TREWARTHA_GROUPS)[number], number>> = {}) => ({
  A: 0,
  B: 0,
  C: 0,
  D: 0,
  E: 0,
  F: 0,
  H: 0,
  ...over,
});

const measures = (over: Partial<WorldMeasures> = {}): WorldMeasures => ({
  landShare: 0.3,
  hypsometry: [0.5, 0.25, 0.125, 0.0625, 0.03125, 0.015625, 0.0078125, 0.00390625, 0.00390625],
  climate: climate({ A: 0.25, C: 0.25, D: 0.5 }),
  unclassifiedShare: 0,
  nations: { count: 100, medianKm2: 300_000, p90Km2: 1_000_000 },
  coastlineKm: 600_000,
  ...over,
});

describe("worldgen/calibration-distance", () => {
  it("relativeGap is 0 for equal values, 1 for a value against zero, and symmetric", () => {
    expect(relativeGap(0, 0)).toBe(0);
    expect(relativeGap(5, 5)).toBe(0);
    expect(relativeGap(0, 7)).toBe(1);
    expect(relativeGap(2, 4)).toBeCloseTo(0.5, 12);
    expect(relativeGap(4, 2)).toBeCloseTo(0.5, 12);
  });

  it("is 0 for the same measures, with every part 0", () => {
    const { distance, parts } = calibrationDistance(measures(), measures());
    expect(distance).toBe(0);
    expect(Object.values(parts)).toEqual([0, 0, 0, 0, 0]);
  });

  it("is symmetric", () => {
    const a = measures();
    const b = measures({ landShare: 0.2, coastlineKm: 900_000 });
    expect(calibrationDistance(a, b).distance).toBeCloseTo(calibrationDistance(b, a).distance, 10);
  });

  it("scores land share as the gap relative to the larger share", () => {
    const { parts } = calibrationDistance(
      measures({ landShare: 0.2 }),
      measures({ landShare: 0.4 })
    );
    expect(parts.land).toBeCloseTo(0.5, 12);
    expect(parts.hypsometry).toBe(0);
  });

  it("scores hypsometry as half the summed differences, so moving all land one zone is 1", () => {
    const low = [1, 0, 0, 0, 0, 0, 0, 0, 0];
    const high = [0, 0, 0, 0, 0, 0, 0, 0, 1];
    expect(
      calibrationDistance(measures({ hypsometry: low }), measures({ hypsometry: high })).parts
        .hypsometry
    ).toBeCloseTo(1, 12);
    const half = [0.5, 0.5, 0, 0, 0, 0, 0, 0, 0];
    expect(
      calibrationDistance(measures({ hypsometry: low }), measures({ hypsometry: half })).parts
        .hypsometry
    ).toBeCloseTo(0.5, 12);
  });

  it("scores the climate mix as half the summed differences, and a missing mix as 1", () => {
    const a = measures({ climate: climate({ A: 1 }) });
    const b = measures({ climate: climate({ D: 1 }) });
    expect(calibrationDistance(a, b).parts.climate).toBeCloseTo(1, 12);
    const half = measures({ climate: climate({ A: 0.5, D: 0.5 }) });
    expect(calibrationDistance(a, half).parts.climate).toBeCloseTo(0.5, 12);
    const none = measures({ climate: climate() });
    expect(calibrationDistance(a, none).parts.climate).toBe(1);
    expect(calibrationDistance(none, none).parts.climate).toBe(0);
  });

  it("averages the gaps of the nation count, median and p90", () => {
    const world = measures({ nations: { count: 50, medianKm2: 300_000, p90Km2: 500_000 } });
    // count 50 vs 100: 0.5, median same: 0, p90 500k vs 1M: 0.5
    expect(calibrationDistance(world, measures()).parts.nations).toBeCloseTo(1 / 3, 12);
    const none = measures({ nations: { count: 0, medianKm2: 0, p90Km2: 0 } });
    expect(calibrationDistance(none, measures()).parts.nations).toBe(1);
  });

  it("scores the coastline as the relative gap", () => {
    const { parts } = calibrationDistance(
      measures({ coastlineKm: 300_000 }),
      measures({ coastlineKm: 600_000 })
    );
    expect(parts.coastline).toBeCloseTo(0.5, 12);
  });

  it("is 100 times the mean of the five parts, rounded to a whole number for display by the caller", () => {
    const world = measures({
      landShare: 0.2, // 0.5 against 0.4
      coastlineKm: 300_000, // 0.5
    });
    const real = measures({ landShare: 0.4 });
    const { distance, parts } = calibrationDistance(world, real);
    const mean =
      (parts.land +
        parts.hypsometry +
        parts.climate +
        (parts.nations ?? Number.NaN) +
        parts.coastline) /
      5;
    expect(distance).toBeCloseTo(100 * mean, 10);
    expect(distance).toBeCloseTo(20, 10);
  });

  it("leaves the nations out when asked: no nations part, and the mean of the other four", () => {
    const none = measures({ nations: { count: 0, medianKm2: 0, p90Km2: 0 } });
    const real = measures({ landShare: 0.6, coastlineKm: 300_000 });
    const full = calibrationDistance(none, real);
    expect(full.parts.nations).toBe(1);
    const skipped = calibrationDistance(none, real, { nations: false });
    expect(skipped.parts.nations).toBeNull();
    const { land, hypsometry, climate, coastline } = skipped.parts;
    expect(skipped.distance).toBeCloseTo(((land + hypsometry + climate + coastline) / 4) * 100, 10);
    expect(skipped.distance).toBeLessThan(full.distance);
  });
});
