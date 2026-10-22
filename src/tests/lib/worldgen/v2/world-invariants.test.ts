/** @jest-environment node */
/**
 * What every world the generator makes must hold, checked on worlds from the realms' own presets (Earth-like, Eurth,
 * Ixnay) at a size jest can afford: a sound cell graph after each stage, the seven layers the map draws with the
 * properties it reads, valid polygons whose shared borders and coasts agree across layers, nation areas that match
 * their slots (across the antimeridian too), the presets' measured shape, the 2026-10 audit regressions and the
 * quality gate. One test per behaviour; each world is generated once.
 */
import type { Feature, LineString, MultiLineString, Position } from "geojson";
import { EARTH_RADIUS_KM, sphericalRingAreaSqKm } from "~/lib/maps/planet";
import { DEFAULT_PARAMS, WORLD_PRESETS } from "~/lib/worldgen/v2/config";
import { generateWorld } from "~/lib/worldgen/v2/index";
import { cellAreaKm2, createMesh } from "~/lib/worldgen/v2/mesh";
import { checkCoastlineComplexity, validateWorld } from "~/lib/worldgen/v2/quality-gate";
import { classifyCellBoundary } from "~/lib/worldgen/v2/tectonics";
import type { GeneratedWorld, WorldGenParams } from "~/lib/worldgen/v2/types";
import { pointInRing, polygonsOf, ringFault } from "~/tests/helpers/ring-geometry";

jest.setTimeout(60_000);

const made = new Map<string, GeneratedWorld>();
/** A world, generated once per recipe. */
function world(name: string, params: Partial<WorldGenParams>): GeneratedWorld {
  if (!made.has(name)) made.set(name, generateWorld({ ...DEFAULT_PARAMS, ...params }));
  return made.get(name)!;
}
const WORLDS: Array<[string, () => GeneratedWorld]> = [
  ["Earth-like, seed 42", () => world("earthlike", { seed: 42, cellCount: 6000, plateCount: 8 })],
  ["Eurth, seed 7", () => world("eurth", { ...WORLD_PRESETS.eurth, seed: 7, cellCount: 8000 })],
  ["Ixnay, seed 4", () => world("ixnay", { ...WORLD_PRESETS.ixnay, seed: 4, cellCount: 8000 })],
];
const lat = (w: GeneratedWorld, i: number) => w.graph!.cells.p[i * 2 + 1]!;
const lng = (w: GeneratedWorld, i: number) => w.graph!.cells.p[i * 2]!;
const range = (n: number) => Array.from({ length: n }, (_, i) => i);

/** One check per generation stage, over the stage's own output on the graph (`earthlikeOnly`: the default plates). */
const STAGES: Array<[string, (w: GeneratedWorld) => void, earthlikeOnly?: boolean]> = [
  [
    "the mesh covers the sphere, poles and antimeridian included",
    (w) => {
      const { cells } = w.graph!;
      const total = range(cells.n).reduce((sum, i) => sum + cellAreaKm2(w.graph!, i), 0);
      expect(Math.abs(total / (4 * Math.PI * EARTH_RADIUS_KM ** 2) - 1)).toBeLessThan(0.01);
      for (const i of range(cells.n).filter((c) => c % 97 === 0)) {
        const geodesic = sphericalRingAreaSqKm(cells.vertices[i]!, EARTH_RADIUS_KM);
        expect(Math.abs(cellAreaKm2(w.graph!, i) / geodesic - 1)).toBeLessThan(0.01);
      }
      expect(Math.max(...range(cells.n).map((i) => Math.abs(lat(w, i))))).toBeGreaterThan(85);
      const wraps = range(cells.n).some((i) =>
        cells.neighbors[i]!.some((nb) => Math.abs(lng(w, nb) - lng(w, i)) > 180)
      );
      expect(wraps).toBe(true);
    },
  ],
  [
    "tectonics puts every cell on one plate, with both kinds of plate and real boundaries",
    (w) => {
      const { cells, plates } = w.graph!;
      expect(plates).toHaveLength(w.params.plateCount);
      expect(
        range(cells.n).every((i) => cells.plate[i]! >= 1 && cells.plate[i]! <= plates.length)
      ).toBe(true);
      expect(plates.every((p) => p.cellCount > 0 && p.speed > 0)).toBe(true);
      const i = range(cells.n).find((c) =>
        cells.neighbors[c]!.some((nb) => cells.plate[nb] !== cells.plate[c])
      )!;
      const nb = cells.neighbors[i]!.find((n) => cells.plate[n] !== cells.plate[i])!;
      expect(["convergent", "divergent", "transform"]).toContain(
        classifyCellBoundary(w.graph!, i, nb)
      );
    },
  ],
  [
    "terrain makes land exactly where the height is above the sea, near the asked share, with mountains",
    (w) => {
      const { cells } = w.graph!;
      expect(range(cells.n).every((i) => cells.h[i]! >= 0 === (cells.isLand[i] === 1))).toBe(true);
      const land = range(cells.n).filter((i) => cells.isLand[i]);
      expect(Math.abs(land.length / cells.n - (1 - w.params.oceanPercentage))).toBeLessThan(0.1);
      expect(new Set(land.map((i) => cells.elevZone[i])).size).toBeGreaterThan(3);
      expect(land.every((i) => cells.elevZone[i]! >= 0 && cells.elevZone[i]! <= 8)).toBe(true);
      expect(range(cells.n).some((i) => cells.isMountainRidge[i])).toBe(true);
    },
  ],
  [
    "the default plates are both continental and oceanic, and the continental ones stand higher",
    (w) => {
      const { cells, plates } = w.graph!;
      expect(new Set(plates.map((p) => p.type))).toEqual(new Set(["continental", "oceanic"]));
      const mean = (type: string) => {
        const own = range(cells.n).filter((i) => plates[cells.plate[i]! - 1]?.type === type);
        return own.reduce((sum, i) => sum + cells.h[i]!, 0) / own.length;
      };
      expect(mean("continental")).toBeGreaterThan(mean("oceanic"));
    },
    true,
  ],
  [
    "coastlines give every cell a feature, sink single-cell specks and measure coastal distance",
    (w) => {
      const { cells, features } = w.graph!;
      expect(
        range(cells.n).every((i) => cells.feature[i]! > 0 && cells.feature[i]! <= features.length)
      ).toBe(true);
      expect(features.some((f) => f.type === "ocean")).toBe(true);
      expect(features.filter((f) => f.type === "island").every((f) => f.cellCount >= 2)).toBe(true);
      expect(features.every((f) => f.areaKm2 > 0)).toBe(true);
      expect(
        range(cells.n)
          .filter((i) => cells.isLand[i])
          .every((i) => cells.coastDist[i]! >= 0 && cells.coastDist[i]! < 65535)
      ).toBe(true);
    },
  ],
  [
    "hydro-climate is warm at the equator, never tropical near the poles nor ice-capped in tropical lowland, and its rivers run downhill",
    (w) => {
      const { cells, rivers } = w.graph!;
      const meanTemp = (keep: (i: number) => boolean) => {
        const own = range(cells.n).filter(keep);
        return own.reduce((sum, i) => sum + cells.temp[i]!, 0) / own.length;
      };
      expect(meanTemp((i) => Math.abs(lat(w, i)) < 15)).toBeGreaterThan(
        meanTemp((i) => Math.abs(lat(w, i)) > 65)
      );
      expect(
        range(cells.n).every(
          (i) => cells.prec[i]! > 0 && cells.aridity[i]! >= 0 && cells.aridity[i]! <= 1
        )
      ).toBe(true);
      expect(
        range(cells.n).every((i) => cells.windDir[i]! >= 0 && cells.windDir[i]! <= 2 * Math.PI)
      ).toBe(true);
      const land = range(cells.n).filter((i) => cells.isLand[i]);
      expect(new Set(land.map((i) => cells.biome[i])).size).toBeGreaterThan(3);
      expect(land.filter((i) => Math.abs(lat(w, i)) > 60).every((i) => cells.biome[i]! > 1)).toBe(
        true
      );
      expect(
        range(cells.n)
          .filter((i) => Math.abs(lat(w, i)) < 20 && cells.h[i]! < 1000)
          .every((i) => cells.biome[i] !== 10)
      ).toBe(true);
      expect(rivers.length).toBeGreaterThan(0);
      for (const river of rivers) {
        expect(river.lengthKm > 0 && river.flux > 0 && river.cells.length >= 3).toBe(true);
        for (let j = 0; j < river.cells.length - 1; j++) {
          expect(cells.h[river.cells[j + 1]!]!).toBeLessThanOrEqual(cells.h[river.cells[j]!]! + 10);
        }
      }
    },
  ],
  [
    "politics gives all land to named states whose areas are their cells' geodesic area, each with a capital",
    (w) => {
      const { cells, states, settlements } = w.graph!;
      expect(
        range(cells.n)
          .filter((i) => cells.isLand[i])
          .every((i) => cells.state[i]! > 0)
      ).toBe(true);
      const geodesic = new Map<number, number>();
      for (const i of range(cells.n).filter((c) => cells.state[c]! > 0)) {
        geodesic.set(
          cells.state[i]!,
          (geodesic.get(cells.state[i]!) ?? 0) + sphericalRingAreaSqKm(cells.vertices[i]!)
        );
      }
      for (const state of states) {
        expect(state.name).toBeTruthy();
        expect(state.color).toMatch(/^#[0-9a-fA-F]{6}$/);
        expect(state.capital).toBeGreaterThan(0);
        expect(Math.abs(state.areaKm2 / geodesic.get(state.id)! - 1)).toBeLessThan(0.01);
      }
      expect(settlements.some((s) => s.isCapital)).toBe(true);
    },
  ],
];

describe("every stage", () => {
  it.each(
    WORLDS.flatMap(([name, make], w) =>
      STAGES.filter(([, , earthlikeOnly]) => !earthlikeOnly || w === 0).map(([stage, check]) => ({
        name,
        stage,
        make,
        check,
      }))
    )
  )("$name: $stage", ({ make, check }) => check(make()));

  it("is deterministic: the same seed makes byte-identical layers", () => {
    const params = { ...DEFAULT_PARAMS, seed: 42, cellCount: 3000 };
    expect(JSON.stringify(generateWorld(params).layers)).toBe(
      JSON.stringify(generateWorld(params).layers)
    );
  });

  it("reports its stages in order", () => {
    const stages: string[] = [];
    generateWorld({ ...DEFAULT_PARAMS, seed: 43, cellCount: 3000 }, (stage) => {
      if (!stages.includes(stage)) stages.push(stage);
    });
    expect(stages).toEqual([
      "mesh",
      "tectonics",
      "terrain",
      "coastlines",
      "hydro-climate",
      "quality",
      "politics",
      "export",
    ]);
  });
});

describe("the exported layers", () => {
  it.each(WORLDS)(
    "%s: has the seven layers, with the properties the map's renderer reads",
    (_name, make) => {
      const { layers } = make();
      expect(Object.keys(layers).sort()).toEqual([
        "altitudes",
        "background",
        "climate",
        "icecaps",
        "lakes",
        "political",
        "rivers",
      ]);
      for (const { properties } of layers.political!.features) {
        expect(properties).toMatchObject({
          _id: expect.anything(),
          _displayName: expect.anything(),
          _fillColor: expect.stringMatching(/^#[0-9a-fA-F]{6}$/),
        });
        expect(properties!._areaSqKm).toBeGreaterThan(0);
        expect(typeof properties!._centroidLng).toBe("number");
        expect(properties).not.toHaveProperty("continent");
      }
      expect(layers.altitudes!.features.every((f) => /^zone_[0-8]$/.test(f.properties!.zone))).toBe(
        true
      );
      expect(
        layers.rivers!.features.every((f) => /^(Multi)?LineString$/.test(f.geometry.type))
      ).toBe(true);
      // Chaikin smoothing: no coast is left as a raw cell outline
      expect(
        layers.background!.features.every(
          (f) => f.geometry.type !== "Polygon" || f.geometry.coordinates[0]!.length > 6
        )
      ).toBe(true);
    }
  );

  it.each(WORLDS.slice(1))(
    "%s: draws no ring that crosses itself, and every hole inside its shell",
    (_name, make) => {
      for (const [layer, { features }] of Object.entries(make().layers)) {
        if (layer === "rivers") continue;
        for (const feature of features)
          expect({ layer, id: feature.id, fault: ringFault(feature.geometry) }).toEqual({
            layer,
            id: feature.id,
            fault: null,
          });
      }
    }
  );

  /** Points on the antimeridian and the polar cut (rounded to 1e-4, perturbed by up to 0.006). */
  const onMapEdge = (p: Position) => Math.abs(p[0]!) > 179.99 || Math.abs(p[1]!) > 84.97;
  const edgeKey = (a: Position, b: Position) => `${a[0]},${a[1]}>${b[0]},${b[1]}`;
  const pointKey = (p: Position) => `${p[0]},${p[1]}`;
  const ringPoints = (w: GeneratedWorld, layer: string, only?: number) =>
    w.layers[layer]!.features.filter((f) => only === undefined || f.id === only).flatMap(
      (f) => polygonsOf(f.geometry).flat(2) as unknown as Position[]
    );
  const edgesOf = (features: Feature[]) =>
    features.flatMap((f) =>
      polygonsOf(f.geometry).flatMap((polygon) =>
        polygon.flatMap((ring) =>
          ring.slice(1).map((b, i) => ({ id: Number(f.id), a: ring[i]!, b }))
        )
      )
    );

  it.each(WORLDS.slice(1))(
    "%s: shares every border with the neighbour on its other side, and draws a coast the same in every layer",
    (_name, make) => {
      const w = make();
      const owner = new Map(
        edgesOf(w.layers.political!.features).map((e) => [edgeKey(e.a, e.b), e.id])
      );
      const coast = new Set(edgesOf(w.layers.background!.features).map((e) => edgeKey(e.a, e.b)));
      let shared = 0;
      const stray: string[] = [];
      for (const { id, a, b } of edgesOf(w.layers.political!.features)) {
        const other = owner.get(edgeKey(b, a));
        if (other !== undefined && other !== id) shared++;
        else if (!coast.has(edgeKey(a, b)) && !(onMapEdge(a) && onMapEdge(b)))
          stray.push(`${id}: ${edgeKey(a, b)}`);
      }
      expect(shared).toBeGreaterThan(5000);
      expect(stray).toEqual([]);
      const inland = ringPoints(w, "background").filter((p) => !onMapEdge(p));
      for (const layer of ["political", "climate"]) {
        const points = new Set(ringPoints(w, layer).map(pointKey));
        expect(inland.filter((p) => !points.has(pointKey(p)))).toEqual([]);
      }
      const lowland = new Set(ringPoints(w, "altitudes", 1).map(pointKey));
      expect(inland.filter((p) => !lowland.has(pointKey(p)))).toEqual([]);
    }
  );

  it("measures every nation as much as its slot claims, the antimeridian's split in two on either side", () => {
    // Ixnay at seed 1 has nations across the antimeridian
    for (const w of [
      WORLDS[1]![1](),
      world("ixnay-seam", { ...WORLD_PRESETS.ixnay, seed: 1, cellCount: 8000 }),
    ]) {
      const { cells } = w.graph!;
      const byState = new Map<number, number[]>();
      for (const i of range(cells.n).filter((c) => cells.state[c]! > 0))
        byState.set(cells.state[i]!, [...(byState.get(cells.state[i]!) ?? []), i]);
      const onSeam = (own: number[]) =>
        own.some((i) => lng(w, i) < -170) && own.some((i) => lng(w, i) > 170);
      // slots with some mass, clear of the poles (rings are cut at 85°)
      const measurable = w.slots.filter((slot) => {
        const own = byState.get(Number(slot.key.slice(5)))!;
        return own.length >= 10 && own.every((i) => Math.abs(lat(w, i)) < 75);
      });
      expect(measurable.length).toBeGreaterThan(10);
      for (const slot of measurable) {
        const feature = w.layers.political!.features.find(
          (f) => f.properties?.slotKey === slot.key
        )!;
        const polygons = polygonsOf(feature.geometry);
        const area = polygons.reduce(
          (sum, [shell, ...holes]) =>
            sum +
            sphericalRingAreaSqKm(shell!) -
            holes.reduce((h, ring) => h + sphericalRingAreaSqKm(ring), 0),
          0
        );
        expect({ slot: slot.key, ratio: Math.abs(area / slot.areaKm2 - 1) < 0.03 }).toEqual({
          slot: slot.key,
          ratio: true,
        });
        if (!onSeam(byState.get(Number(slot.key.slice(5)))!)) continue;
        const reaches = (edge: number) =>
          polygons.some(([shell]) => shell!.some((p) => Math.abs(p[0]! - edge) < 0.05));
        expect([reaches(-180), reaches(180)]).toEqual([true, true]);
        for (const [shell, ...holes] of polygons)
          for (const [a, b] of holes)
            expect(pointInRing(shell!, (a![0]! + b![0]!) / 2, (a![1]! + b![1]!) / 2)).toBe(true);
      }
    }
  });

  // Regression (2026-10-21): exportRivers smoothed a river's cell centres as they were, so a river whose cells step
  // across the antimeridian (178.7 to -178.7) was drawn the long way, 357 degrees round the world, overshooting to
  // about ±204: 3 of the 9 rivers of Eurth at seed 4. A river is now unwrapped before smoothing and cut at ±180.
  it("draws no river step longer than a few degrees, cutting a river that crosses the antimeridian at ±180", () => {
    const eurth = world("eurth-rivers", {
      ...WORLD_PRESETS.eurth,
      countryCountRange: [12, 12],
      seed: 4,
      cellCount: 8000,
      plateCount: 8,
    });
    const linesOf = (geometry: LineString | MultiLineString) =>
      geometry.type === "LineString" ? [geometry.coordinates] : geometry.coordinates;
    const rivers = eurth.layers.rivers!.features.map((river) => ({
      id: river.id,
      lines: linesOf(river.geometry as LineString | MultiLineString),
    }));
    for (const { id, lines } of rivers) {
      const steps = lines.flatMap((line) =>
        line.slice(1).map((p, i) => Math.abs(p[0]! - line[i]![0]!))
      );
      const inRange = lines.flat().every((p) => Math.abs(p[0]!) <= 180);
      expect({ river: id, longest: Math.max(...steps) < 10, inRange }).toEqual({
        river: id,
        longest: true,
        inRange: true,
      });
    }
    const cut = rivers.filter(({ lines }) => lines.length > 1);
    expect(cut.length).toBeGreaterThan(0);
    for (const { lines } of cut)
      expect(lines.some((line) => line.some((p) => Math.abs(Math.abs(p[0]!) - 180) < 1e-9))).toBe(
        true
      );
  });
});

describe("the realms' presets and the 2026-10 audit", () => {
  /** Shares of the land: by area, in the polar caps, in each elevation zone and in each broad climate group. */
  function measure(w: GeneratedWorld) {
    const { cells, features } = w.graph!;
    let total = 0,
      land = 0,
      southCap = 0,
      southCapLand = 0,
      farNorth = 0;
    const zone = new Array<number>(9).fill(0);
    const biome = new Array<number>(12).fill(0);
    for (const i of range(cells.n)) {
      const a = cellAreaKm2(w.graph!, i);
      total += a;
      if (lat(w, i) < -82) {
        southCap += a;
        if (cells.isLand[i]) southCapLand += a;
      }
      if (!cells.isLand[i]) continue;
      land += a;
      zone[cells.elevZone[i]!]! += a;
      biome[cells.biome[i]!]! += a;
      if (lat(w, i) > 82) farNorth += a;
    }
    const group = (...ids: number[]) => (100 * ids.reduce((s, id) => s + biome[id]!, 0)) / land;
    return {
      landPct: (100 * land) / total,
      continents: features.filter((f) => f.type === "continent").length,
      southCapLandPct: (100 * southCapLand) / southCap,
      farNorthLandPct: (100 * farNorth) / land,
      zoneGap: Math.max(
        ...zone.map((z, i) => Math.abs((100 * z) / land - w.params.hypsometry[i]!))
      ),
      A: group(0, 1),
      B: group(2, 3),
      C: group(4, 5),
      EF: group(8, 9, 10),
      F: group(9, 10),
    };
  }

  it("reproduces Ixnay: its land share, continents, no polar land, its hypsometry and a warm, wet climate", () => {
    const m = measure(
      world("ixnay-fidelity", { ...WORLD_PRESETS.ixnay, seed: 42, cellCount: 20000 })
    );
    expect(m.landPct).toBeGreaterThan(21);
    expect(m.landPct).toBeLessThan(25.5);
    expect(m.continents).toBeGreaterThanOrEqual(WORLD_PRESETS.ixnay.continentCount - 1);
    expect(m.continents).toBeLessThanOrEqual(WORLD_PRESETS.ixnay.continentCount + 2);
    expect(m.southCapLandPct).toBeLessThan(2);
    expect(m.farNorthLandPct).toBeLessThan(0.5);
    expect(m.zoneGap).toBeLessThan(3);
    // reference A 37, B 16, C 25, D 18, E 2, F 1
    expect([m.A > 25, m.B < 26, m.C > 15, m.EF < 12]).toEqual([true, true, true, true]);
  });

  it("reproduces Eurth: its land share, a south-polar continent with an open north, its rugged hypsometry and polar ice", () => {
    const m = measure(
      world("eurth-fidelity", { ...WORLD_PRESETS.eurth, seed: 7, cellCount: 20000 })
    );
    expect(m.landPct).toBeGreaterThan(20);
    expect(m.landPct).toBeLessThan(25.5);
    expect(m.continents).toBeGreaterThanOrEqual(WORLD_PRESETS.eurth.continentCount - 1);
    expect(m.continents).toBeLessThanOrEqual(WORLD_PRESETS.eurth.continentCount + 3);
    expect(m.southCapLandPct).toBeGreaterThan(90);
    expect(m.farNorthLandPct).toBeLessThan(0.5);
    expect(m.zoneGap).toBeLessThan(3);
    // reference A 21, B 23, C 11, D 24, E 9, F 13 (polar ice sheet)
    expect([m.F > 8, m.A < 42, m.B > 12]).toEqual([true, true, true]);
  });

  it("grows the continents asked for, stops tributaries at their confluence, sizes countries comparably and can leave out ice caps", () => {
    const w = world("audit", { seed: 42, cellCount: 20000 });
    const { cells, rivers, states, features } = w.graph!;
    // 6 grown continents plus the default south-polar cap (was always one supercontinent)
    expect(features.filter((f) => f.type === "continent").length).toBeGreaterThanOrEqual(5);
    const owners = new Map<number, number>();
    for (const river of rivers) {
      for (const c of river.cells.slice(
        0,
        cells.river[river.mouth] === river.id ? undefined : -1
      )) {
        expect(owners.get(c)).toBeUndefined();
        owners.set(c, river.id);
      }
    }
    expect(rivers.some((r) => r.tributaries.length > 0)).toBe(true);
    // capitals were once clustered: the median country was 2 cells
    const sizes = states.map((s) => s.cellCount).sort((a, b) => a - b);
    expect(sizes[sizes.length >> 1]!).toBeGreaterThan(
      (cells.isLand.reduce((a, b) => a + b, 0) / states.length) * 0.3
    );
    expect(
      generateWorld({ ...DEFAULT_PARAMS, seed: 42, cellCount: 3000, hasIcecaps: false }).layers
        .icecaps!.features
    ).toHaveLength(0);
  });

  it("passes the quality gate on ten seeds, which only reports: a second pass scores the same and changes nothing", () => {
    const scores = [1, 42, 100, 256, 500, 777, 1000, 2025, 9999, 31415].map((seed) => {
      const w = generateWorld({ ...DEFAULT_PARAMS, seed, cellCount: 3000, plateCount: 8 });
      const params = { ...DEFAULT_PARAMS, seed, cellCount: 3000 };
      const report = validateWorld(w.graph!, params);
      expect({ seed, score: report.compositeScore >= 80, checks: report.checks.length }).toEqual({
        seed,
        score: true,
        checks: 9,
      });
      if (seed === 42) {
        const heights = Array.from(w.graph!.cells.h);
        expect(validateWorld(w.graph!, params).compositeScore).toBe(report.compositeScore);
        expect(Array.from(w.graph!.cells.h)).toEqual(heights);
      }
      return report.compositeScore;
    });
    expect(scores.reduce((a, b) => a + b, 0) / scores.length).toBeGreaterThanOrEqual(85);
    // the coastline rule: more than 50 coastal land cells
    const coastal = (n: number) => {
      const graph = createMesh(42, 3000, 2);
      graph.cells.isLand.fill(1);
      graph.cells.coastDist.fill(1);
      for (let i = 0; i < n; i++) graph.cells.coastDist[i] = 0;
      return checkCoastlineComplexity(graph, { ...DEFAULT_PARAMS, seed: 42, cellCount: 3000 })
        .passed;
    };
    expect([coastal(51), coastal(50)]).toEqual([true, false]);
  });
});
