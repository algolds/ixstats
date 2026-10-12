/**
 * The Studio's diagnostic layers: deterministic, the right size, wrapping at the antimeridian, laid out as the
 * relief is, and warped to Web Mercator with the relief preview's step.
 */

import {
  DIAGNOSTIC_KINDS,
  DIAGNOSTIC_WIDTH,
  drawDiagnostic,
  nationSeeds,
  renderDiagnostic,
  type DiagnosticKind,
} from "~/lib/worldgen/diagnostics";
import { mercatorLatitude } from "~/lib/maps/raster-tiles";
import { MERCATOR_MAX_LAT } from "~/lib/maps/realm-map-settings";
import { scalarsFromCells } from "~/lib/worldgen/relief";
import { worldGraph } from "~/tests/helpers/world-graph";

const WIDTH = 512;

/** Sum of the channel differences between two pixels of an RGBA buffer. */
const distance = (data: ArrayLike<number>, a: number, b: number): number =>
  Math.abs(data[a * 4]! - data[b * 4]!) +
  Math.abs(data[a * 4 + 1]! - data[b * 4 + 1]!) +
  Math.abs(data[a * 4 + 2]! - data[b * 4 + 2]!);

describe("worldgen/diagnostics", () => {
  const graph = worldGraph();

  it.each(DIAGNOSTIC_KINDS)("%s is deterministic and the right size", (kind) => {
    const first = drawDiagnostic(graph, kind, WIDTH);
    const again = drawDiagnostic(graph, kind, WIDTH);
    expect(first.raster.width).toBe(WIDTH);
    expect(first.raster.height).toBe(WIDTH / 2);
    expect(first.raster.data).toHaveLength(WIDTH * (WIDTH / 2) * 4);
    expect(Buffer.from(first.raster.data).equals(Buffer.from(again.raster.data))).toBe(true);
    expect(first.legend).toEqual(again.legend);
    // Not blank
    expect(first.raster.data.some((v) => v !== 0)).toBe(true);
  });

  it.each(["height", "temperature", "rainfall"] as const)(
    "%s wraps at the antimeridian: the last column meets the first as neighbours do",
    (kind) => {
      const { raster } = drawDiagnostic(graph, kind, WIDTH);
      const { data, width, height } = raster;
      let seam = 0;
      let inside = 0;
      for (let y = 0; y < height; y++) {
        seam += distance(data, y * width, y * width + width - 1);
        inside += distance(data, y * width + 200, y * width + 201);
      }
      // A gap at the seam would show as a column of background against filled ones
      expect(seam / height).toBeLessThan((inside / height) * 4 + 12);
    }
  );

  it("draws cell edges over the seam: a line in the first or last column", () => {
    const { raster } = drawDiagnostic(graph, "cells", WIDTH);
    const { data, width, height } = raster;
    let edge = 0;
    for (let y = 0; y < height; y++) {
      if (data[y * width * 4 + 3]! > 0 || data[(y * width + width - 1) * 4 + 3]! > 0) edge++;
    }
    expect(edge).toBeGreaterThan(height / 4);
  });

  it("scalars keep values below zero and fill both sides of the seam", () => {
    // A constant -5 everywhere: any pixel at 0 is a gap, and a clamped one would read 0 too
    const spots: [number, number][] = [
      [-175, 10],
      [175, 10],
      [0, 50],
      [0, -30],
      [-90, -10],
      [90, 10],
    ];
    const cells = Float32Array.from(spots.flatMap(([lng, lat]) => [lng, lat, -5]));
    const { metres, width } = scalarsFromCells(cells, 64);
    const row = Math.floor(((90 - 10) / 180) * (width / 2));
    expect(metres[row * width]).toBeCloseTo(-5, 3);
    expect(metres[row * width + width - 1]).toBeCloseTo(-5, 3);
  });

  it("draws temperature below freezing in the cold end of the ramp", () => {
    const { raster, legend } = drawDiagnostic(graph, "temperature", WIDTH);
    expect(legend.domain[0]).toBeLessThan(0);
    // The south polar row is cold: bluer than red
    const pole = (raster.height - 2) * raster.width * 4 + 100 * 4;
    expect(raster.data[pole + 2]!).toBeGreaterThan(raster.data[pole]!);
  });

  it("lays pixels out as the relief does: row 0 is 90N, column 0 is 180W, centres", () => {
    const { raster } = drawDiagnostic(graph, "height", WIDTH);
    const { p, isLand, neighbors } = graph.cells;
    const pixelOf = (c: number) => {
      const x = Math.floor(((p[c * 2]! + 180) / 360) * WIDTH);
      const y = Math.floor(((90 - p[c * 2 + 1]!) / 180) * (WIDTH / 2));
      return (y * WIDTH + x) * 4;
    };
    const sea = [0xb3, 0xcd, 0xe0];
    let deepSea = 0;
    let inland = 0;
    for (let c = 0; c < graph.cells.n && deepSea + inland < 400; c++) {
      const i = pixelOf(c);
      const around = neighbors[c]!;
      const colour = [raster.data[i]!, raster.data[i + 1]!, raster.data[i + 2]!];
      if (isLand[c] === 0 && around.every((n) => isLand[n] === 0)) {
        expect(colour).toEqual(sea);
        deepSea++;
      } else if (isLand[c] === 1 && around.every((n) => isLand[n] === 1)) {
        expect(colour).not.toEqual(sea);
        inland++;
      }
    }
    expect(deepSea).toBeGreaterThan(50);
    expect(inland).toBeGreaterThan(50);
  });

  describe("on the map", () => {
    const warped = renderDiagnostic(graph, "height");
    const flat = drawDiagnostic(graph, "height", DIAGNOSTIC_WIDTH).raster;

    it("is a Web Mercator world, 2048 px square, with the legend as data", () => {
      expect(warped.width).toBe(2048);
      expect(warped.height).toBe(2048);
      expect(warped.rgba).toHaveLength(2048 * 2048 * 4);
      expect(warped.legend.kind).toBe("height");
      expect(warped.legend.stops.length).toBeGreaterThan(5);
    });

    it("spans the relief's pinned corners: the top row is at +-MERCATOR_MAX_LAT", () => {
      expect(mercatorLatitude(0, 2048)).toBeCloseTo(MERCATOR_MAX_LAT, 1);
      expect(mercatorLatitude(2048, 2048)).toBeCloseTo(-MERCATOR_MAX_LAT, 1);
    });

    it("takes each Mercator row from the equirectangular row at its latitude", () => {
      for (const y of [100, 700, 1024, 1500, 1900]) {
        const lat = mercatorLatitude(y + 0.5, 2048);
        const source = ((90 - lat) / 180) * flat.height - 0.5;
        const top = Math.floor(source);
        for (const x of [37, 600, 1500]) {
          for (let channel = 0; channel < 3; channel++) {
            const a = flat.data[(top * flat.width + x) * 4 + channel]!;
            const b = flat.data[((top + 1) * flat.width + x) * 4 + channel]!;
            const got = warped.rgba[(y * 2048 + x) * 4 + channel]!;
            expect(got).toBeGreaterThanOrEqual(Math.min(a, b) - 1);
            expect(got).toBeLessThanOrEqual(Math.max(a, b) + 1);
          }
        }
      }
    });
  });

  it("flags the values the fixed temperature and rainfall domains clip, and only those", () => {
    const temperature = drawDiagnostic(graph, "temperature", 128).legend;
    expect(temperature.clipped).toEqual({ low: true, high: true });
    expect(temperature.stops[0]!.label).toBe("-30 or colder");
    expect(temperature.stops[temperature.stops.length - 1]!.label).toBe("38 or hotter");

    // Rainfall cannot go below zero, so only the wet end is flagged
    const rainfall = drawDiagnostic(graph, "rainfall", 128).legend;
    expect(rainfall.clipped).toEqual({ low: false, high: true });
    expect(rainfall.stops[0]!.label).toBeUndefined();
    expect(rainfall.stops[rainfall.stops.length - 1]!.label).toBe("4500 or wetter");

    for (const kind of ["height", "flow", "cells"] as const) {
      expect(drawDiagnostic(graph, kind, 128).legend.clipped).toEqual({ low: false, high: false });
    }
  });

  it.each(DIAGNOSTIC_KINDS)("%s has a legend of colour stops", (kind: DiagnosticKind) => {
    const { legend } = drawDiagnostic(graph, kind, 128);
    expect(legend.kind).toBe(kind);
    expect(legend.title.length).toBeGreaterThan(0);
    expect(legend.stops.length).toBeGreaterThan(0);
    for (const stop of legend.stops) expect(stop.color).toMatch(/^#[0-9a-f]{6}$/i);
    const values = legend.stops.map((s) => s.value);
    expect(values).toEqual([...values].sort((a, b) => a - b));
    if (legend.scale !== "bands") {
      expect(legend.domain[0]).toBeLessThan(legend.domain[1]);
    }
  });

  describe("nation seeds", () => {
    it("is a GeoJSON point at each nation's capital settlement", () => {
      const seeds = nationSeeds(graph);
      expect(seeds.type).toBe("FeatureCollection");
      expect(seeds.features).toHaveLength(graph.states.length);
      expect(graph.states.length).toBeGreaterThan(2);
      for (const feature of seeds.features) {
        const state = graph.states.find((s) => s.id === feature.id)!;
        const capital = graph.settlements.find((s) => s.id === state.capital)!;
        expect(feature.geometry.coordinates).toEqual([capital.lng, capital.lat]);
        expect(feature.properties).toMatchObject({ name: state.name, color: state.color });
      }
    });
  });
});
