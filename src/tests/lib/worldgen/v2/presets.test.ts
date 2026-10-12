/**
 * UPG v2 — Realm preset fidelity
 *
 * The ixnay and eurth presets must reproduce the shape statistics measured on the two realms'
 * hand-drawn maps (see WORLD_PRESETS in config.ts): land share, continent count, polar land,
 * hypsometry and the broad climate mix. Plus regressions for bugs fixed in the 2026-10 audit.
 */

import { generateWorld } from "~/lib/worldgen/v2/index";
import { WORLD_PRESETS, DEFAULT_PARAMS } from "~/lib/worldgen/v2/config";
import { cellAreaKm2 } from "~/lib/worldgen/v2/mesh";
import type { GeneratedWorld } from "~/lib/worldgen/v2/types";

const SEEDS = [7, 42];

/** Climate groups by TREWARTHA_BIOMES id. */
const GROUPS: Record<string, number[]> = {
  A: [0, 1],
  B: [2, 3],
  C: [4, 5],
  D: [6, 7],
  E: [8],
  F: [9, 10],
};

function measure(world: GeneratedWorld) {
  const { cells, features } = world.graph!;
  let total = 0;
  let land = 0;
  let southCapLand = 0;
  let southCap = 0;
  let farNorthLand = 0;
  const zone = new Array(9).fill(0);
  const biome = new Array(12).fill(0);
  for (let i = 0; i < cells.n; i++) {
    const a = cellAreaKm2(world.graph!, i);
    const lat = cells.p[i * 2 + 1]!;
    total += a;
    if (lat < -82) {
      southCap += a;
      if (cells.isLand[i]) southCapLand += a;
    }
    if (!cells.isLand[i]) continue;
    land += a;
    zone[cells.elevZone[i]!] += a;
    biome[cells.biome[i]!] += a;
    if (lat > 82) farNorthLand += a;
  }
  const group = (ids: number[]) => (100 * ids.reduce((s, id) => s + biome[id], 0)) / land;
  return {
    landPct: (100 * land) / total,
    continents: features.filter((f) => f.type === "continent").length,
    southCapLandPct: (100 * southCapLand) / southCap,
    farNorthLandPct: (100 * farNorthLand) / land,
    zonePct: zone.map((z) => (100 * z) / land),
    climate: Object.fromEntries(Object.entries(GROUPS).map(([k, ids]) => [k, group(ids)])),
  };
}

describe("v2/presets — Ixnay", () => {
  const preset = WORLD_PRESETS.ixnay;
  const worlds = SEEDS.map((seed) => measure(generateWorld({ ...preset, seed })));

  it.each(SEEDS.map((s, i) => [s, i]))(
    "seed %i: land share and continents match Ixnay",
    (_s, i) => {
      const m = worlds[i]!;
      expect(m.landPct).toBeGreaterThan(21);
      expect(m.landPct).toBeLessThan(25.5);
      expect(m.continents).toBeGreaterThanOrEqual(preset.continentCount - 1);
      expect(m.continents).toBeLessThanOrEqual(preset.continentCount + 2);
    }
  );

  it.each(SEEDS.map((s, i) => [s, i]))("seed %i: no polar land", (_s, i) => {
    // Continents stop at 80°; only a coastline sliver may poke past 82°
    expect(worlds[i]!.southCapLandPct).toBeLessThan(2);
    expect(worlds[i]!.farNorthLandPct).toBeLessThan(0.5);
  });

  it.each(SEEDS.map((s, i) => [s, i]))("seed %i: hypsometry follows the target curve", (_s, i) => {
    const target = preset.hypsometry;
    worlds[i]!.zonePct.forEach((pct, z) => expect(Math.abs(pct - target[z]!)).toBeLessThan(3));
  });

  it.each(SEEDS.map((s, i) => [s, i]))("seed %i: warm, wet climate mix", (_s, i) => {
    const { climate } = worlds[i]!;
    // Reference: A 37, B 16, C 25, D 18, E 2, F 1
    expect(climate.A).toBeGreaterThan(25);
    expect(climate.B).toBeLessThan(26);
    expect(climate.C).toBeGreaterThan(15);
    expect(climate.E! + climate.F!).toBeLessThan(12);
  });
});

describe("v2/presets — Eurth", () => {
  const preset = WORLD_PRESETS.eurth;
  const worlds = SEEDS.map((seed) => measure(generateWorld({ ...preset, seed })));

  it.each(SEEDS.map((s, i) => [s, i]))(
    "seed %i: land share and continents match Eurth",
    (_s, i) => {
      const m = worlds[i]!;
      expect(m.landPct).toBeGreaterThan(20);
      expect(m.landPct).toBeLessThan(25.5);
      // Grown continents plus the south-polar continent
      expect(m.continents).toBeGreaterThanOrEqual(preset.continentCount - 1);
      expect(m.continents).toBeLessThanOrEqual(preset.continentCount + 3);
    }
  );

  it.each(SEEDS.map((s, i) => [s, i]))(
    "seed %i: south-polar continent, open north pole",
    (_s, i) => {
      expect(worlds[i]!.southCapLandPct).toBeGreaterThan(90);
      expect(worlds[i]!.farNorthLandPct).toBeLessThan(0.5);
    }
  );

  it.each(SEEDS.map((s, i) => [s, i]))(
    "seed %i: rugged hypsometry follows the target curve",
    (_s, i) => {
      const target = preset.hypsometry;
      worlds[i]!.zonePct.forEach((pct, z) => expect(Math.abs(pct - target[z]!)).toBeLessThan(3));
    }
  );

  it.each(SEEDS.map((s, i) => [s, i]))("seed %i: polar ice and a broad climate mix", (_s, i) => {
    const { climate } = worlds[i]!;
    // Reference: A 21, B 23, C 11, D 24, E 9, F 13 (polar ice sheet)
    expect(climate.F).toBeGreaterThan(8);
    expect(climate.A).toBeLessThan(42);
    expect(climate.B).toBeGreaterThan(12);
  });
});

describe("v2 — audit regressions", () => {
  const world = generateWorld({ ...DEFAULT_PARAMS, seed: 42, cellCount: 20000 });
  const { cells, rivers, states } = world.graph!;

  it("continentCount drives the number of continents (was always one supercontinent)", () => {
    const continents = world.graph!.features.filter((f) => f.type === "continent").length;
    // 6 grown continents + the default south-polar cap
    expect(continents).toBeGreaterThanOrEqual(5);
  });

  it("the mesh covers the poles and wraps the antimeridian", () => {
    let maxLat = 0;
    let wrapLinks = 0;
    for (let i = 0; i < cells.n; i++) {
      maxLat = Math.max(maxLat, Math.abs(cells.p[i * 2 + 1]!));
      for (const nb of cells.neighbors[i]!) {
        if (Math.abs(cells.p[nb * 2]! - cells.p[i * 2]!) > 180) wrapLinks++;
      }
    }
    expect(maxLat).toBeGreaterThan(88);
    expect(wrapLinks).toBeGreaterThan(0);
  });

  it("tributaries stop at their confluence instead of duplicating the trunk", () => {
    const owners = new Map<number, number>();
    for (const river of rivers) {
      // every cell but a tributary's last (the confluence) belongs to this river alone
      const own = river.cells.slice(0, cells.river[river.mouth] === river.id ? undefined : -1);
      for (const c of own) {
        expect(owners.get(c)).toBeUndefined();
        owners.set(c, river.id);
      }
    }
    expect(rivers.some((r) => r.tributaries.length > 0)).toBe(true);
  });

  it("countries are comparably sized (capitals were clustered: median 2 cells)", () => {
    const sizes = states.map((s) => s.cellCount).sort((a, b) => a - b);
    const landCells = cells.isLand.reduce((a, b) => a + b, 0);
    expect(sizes[sizes.length >> 1]!).toBeGreaterThan((landCells / states.length) * 0.3);
  });

  it("hasIcecaps: false exports no ice caps", () => {
    const noIce = generateWorld({
      ...DEFAULT_PARAMS,
      seed: 42,
      cellCount: 3000,
      hasIcecaps: false,
    });
    expect(noIce.layers.icecaps!.features).toHaveLength(0);
  });
});
