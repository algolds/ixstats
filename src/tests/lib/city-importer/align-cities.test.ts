import { describe, it, expect } from "@jest/globals";
import { deriveCityAffine, applyCityAffine } from "~/lib/city-importer/align-cities";
import type { SvgProvinceRef, DbSubdivisionRef, SvgCityPoint } from "~/lib/city-importer/align-cities";

describe("deriveCityAffine", () => {
  it("recovers a known affine transform from matched province centroids", () => {
    // Known affine transformation parameters:
    // Scale X by 2, Scale Y by -2 (Y-flip), Translate X by 100, Translate Y by 50
    // x' = 2x + 100
    // y' = -2y + 50
    const svgProvinces: SvgProvinceRef[] = [
      { name: "Alpha", svgX: 10, svgY: 20 },
      { name: "Beta", svgX: 30, svgY: 40 },
      { name: "Gamma", svgX: 50, svgY: 10 },
    ];

    const dbSubdivisions: DbSubdivisionRef[] = [
      { name: "Alpha", centroid: [120, 10] },
      { name: "Beta", centroid: [160, -30] },
      { name: "Gamma", centroid: [200, 30] },
    ];

    const result = deriveCityAffine(svgProvinces, dbSubdivisions);
    expect(result.matrix).not.toBeNull();
    expect(result.matchCount).toBe(3);
    expect(result.rmse).toBeLessThan(1e-7);

    const matrix = result.matrix!;
    expect(matrix.a).toBeCloseTo(2);
    expect(matrix.b).toBeCloseTo(0);
    expect(matrix.c).toBeCloseTo(0);
    expect(matrix.d).toBeCloseTo(-2);
    expect(matrix.tx).toBeCloseTo(100);
    expect(matrix.ty).toBeCloseTo(50);

    // Apply recovered matrix to a city point and check target [lng, lat]
    const testPoints: SvgCityPoint[] = [
      { svgX: 25, svgY: 25, name: "Capital City", isCapital: true },
    ];

    const aligned = applyCityAffine(testPoints, matrix);
    expect(aligned).toHaveLength(1);
    expect(aligned[0]!.name).toBe("Capital City");
    expect(aligned[0]!.lng).toBeCloseTo(2 * 25 + 100); // 150
    expect(aligned[0]!.lat).toBeCloseTo(-2 * 25 + 50); // 0
    expect(aligned[0]!.isCapital).toBe(true);
  });

  it("handles case-insensitive and whitespace-flexible matching", () => {
    const svgProvinces: SvgProvinceRef[] = [
      { name: "  alpha  ", svgX: 10, svgY: 20 },
      { name: "BETA", svgX: 30, svgY: 40 },
      { name: "gamma", svgX: 50, svgY: 10 },
    ];

    const dbSubdivisions: DbSubdivisionRef[] = [
      { name: "Alpha", centroid: [120, 10] },
      { name: "beta", centroid: [160, -30] },
      { name: "GAMMA ", centroid: [200, 30] },
    ];

    const result = deriveCityAffine(svgProvinces, dbSubdivisions);
    expect(result.matrix).not.toBeNull();
    expect(result.matchCount).toBe(3);
  });

  it("returns matrix = null when there are fewer than 3 matched pairs", () => {
    const svgProvinces: SvgProvinceRef[] = [
      { name: "Alpha", svgX: 10, svgY: 20 },
      { name: "Beta", svgX: 30, svgY: 40 },
    ];

    const dbSubdivisions: DbSubdivisionRef[] = [
      { name: "Alpha", centroid: [120, 10] },
      { name: "Beta", centroid: [160, -30] },
      { name: "Gamma", centroid: [200, 30] },
    ];

    const result = deriveCityAffine(svgProvinces, dbSubdivisions);
    expect(result.matrix).toBeNull();
    expect(result.matchCount).toBe(2);
    expect(result.rmse).toBe(Infinity);
    expect(result.unmatchedSvgProvinces).toEqual([]);
  });
});
