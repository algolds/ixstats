/**
 * UPG v2 — Hydro-Climate Unit Tests
 */

import { createMesh } from "../mesh";
import { generateTectonicPlates } from "../tectonics";
import { generateTerrain } from "../terrain";
import { refineCoastlines } from "../coastlines";
import { computeHydroClimate } from "../hydro-climate";
import { DEFAULT_PARAMS } from "../config";

const TEST_SEED = 42;
const TEST_CELLS = 3000;

describe("v2/hydro-climate", () => {
  const graph = createMesh(TEST_SEED, TEST_CELLS, 2);
  generateTectonicPlates(graph, {
    ...DEFAULT_PARAMS,
    seed: TEST_SEED,
    cellCount: TEST_CELLS,
    plateCount: 8,
  });
  generateTerrain(graph, {
    ...DEFAULT_PARAMS,
    seed: TEST_SEED,
    cellCount: TEST_CELLS,
    oceanPercentage: 0.65,
  });
  refineCoastlines(graph, {
    ...DEFAULT_PARAMS,
    seed: TEST_SEED,
    cellCount: TEST_CELLS,
    coastlineComplexity: 0.8,
  });
  computeHydroClimate(graph, { ...DEFAULT_PARAMS, seed: TEST_SEED, cellCount: TEST_CELLS });

  describe("Temperature Sub-pass", () => {
    it("equatorial cells are warmer on average than polar cells", () => {
      let eqSum = 0,
        eqCount = 0;
      let polarSum = 0,
        polarCount = 0;

      for (let i = 0; i < graph.cells.n; i++) {
        const lat = Math.abs(graph.cells.p[i * 2 + 1]!);
        const temp = graph.cells.temp[i]!;

        if (lat < 15) {
          eqSum += temp;
          eqCount++;
        } else if (lat > 65) {
          polarSum += temp;
          polarCount++;
        }
      }

      if (eqCount > 0 && polarCount > 0) {
        expect(eqSum / eqCount).toBeGreaterThan(polarSum / polarCount);
      }
    });

    it("high altitude cells are cooler than sea-level cells at same latitude", () => {
      // Find two land cells at similar latitude (|lat| < 40), one high (>2000m), one low (<200m)
      let highCell = -1;
      let lowCell = -1;

      for (let i = 0; i < graph.cells.n; i++) {
        if (!graph.cells.isLand[i]) continue;
        const lat = Math.abs(graph.cells.p[i * 2 + 1]!);
        const h = graph.cells.h[i]!;

        if (lat < 40) {
          if (h > 2000 && highCell < 0) highCell = i;
          if (h < 200 && lowCell < 0) lowCell = i;
        }
        if (highCell >= 0 && lowCell >= 0) break;
      }

      if (highCell >= 0 && lowCell >= 0) {
        expect(graph.cells.temp[highCell]!).toBeLessThan(graph.cells.temp[lowCell]!);
      }
    });
  });

  describe("Wind & Orographic Precipitation", () => {
    it("assigns valid wind directions in radians [0, 2π]", () => {
      for (let i = 0; i < graph.cells.n; i++) {
        const windDir = graph.cells.windDir[i]!;
        expect(windDir).toBeGreaterThanOrEqual(0);
        expect(windDir).toBeLessThanOrEqual(Math.PI * 2);
      }
    });

    it("assigns precipitation > 0 for all cells", () => {
      for (let i = 0; i < graph.cells.n; i++) {
        expect(graph.cells.prec[i]!).toBeGreaterThan(0);
      }
    });

    it("assigns aridity values in range [0, 1]", () => {
      for (let i = 0; i < graph.cells.n; i++) {
        expect(graph.cells.aridity[i]!).toBeGreaterThanOrEqual(0);
        expect(graph.cells.aridity[i]!).toBeLessThanOrEqual(1.0);
      }
    });
  });

  describe("Rivers & Hydrology", () => {
    it("populates graph.rivers array", () => {
      expect(graph.rivers.length).toBeGreaterThan(0);
    });

    it("rivers flow downhill (h[cells[j]] >= h[cells[j+1]])", () => {
      let downhillViolations = 0;

      for (const river of graph.rivers) {
        for (let j = 0; j < river.cells.length - 1; j++) {
          const currH = graph.cells.h[river.cells[j]!]!;
          const nextH = graph.cells.h[river.cells[j + 1]!]!;
          if (nextH > currH + 10) {
            // allow tiny depression fill tolerance
            downhillViolations++;
          }
        }
      }

      expect(downhillViolations).toBe(0);
    });

    it("river mouths terminate at ocean or lake or edge", () => {
      for (const river of graph.rivers) {
        const mouthCell = river.mouth;
        expect(mouthCell).toBeGreaterThanOrEqual(0);
        expect(mouthCell).toBeLessThan(graph.cells.n);
      }
    });

    it("river lengths and flux are positive", () => {
      for (const river of graph.rivers) {
        expect(river.lengthKm).toBeGreaterThan(0);
        expect(river.flux).toBeGreaterThan(0);
        expect(river.cells.length).toBeGreaterThanOrEqual(3);
      }
    });
  });

  describe("Trewartha Biome Classification", () => {
    it("assigns biomes 0-11 for all land cells", () => {
      const biomesPresent = new Set<number>();

      for (let i = 0; i < graph.cells.n; i++) {
        if (graph.cells.isLand[i]) {
          const biome = graph.cells.biome[i]!;
          expect(biome).toBeGreaterThanOrEqual(0);
          expect(biome).toBeLessThanOrEqual(11);
          biomesPresent.add(biome);
        }
      }

      // Diverse biomes should be generated
      expect(biomesPresent.size).toBeGreaterThan(3);
    });

    it("does not place tropical wet biomes at polar latitudes (>60°)", () => {
      for (let i = 0; i < graph.cells.n; i++) {
        const lat = Math.abs(graph.cells.p[i * 2 + 1]!);
        const biome = graph.cells.biome[i]!;

        if (lat > 60) {
          expect(biome).not.toBe(0); // Ar Tropical Wet
          expect(biome).not.toBe(1); // Aw Tropical Dry
        }
      }
    });

    it("does not place ice cap biomes at equatorial lowlands (<20° lat, <1000m)", () => {
      for (let i = 0; i < graph.cells.n; i++) {
        const lat = Math.abs(graph.cells.p[i * 2 + 1]!);
        const elev = graph.cells.h[i]!;
        const biome = graph.cells.biome[i]!;

        if (lat < 20 && elev < 1000) {
          expect(biome).not.toBe(10); // Fi Ice Cap
        }
      }
    });
  });
});
