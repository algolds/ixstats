/**
 * The PNG render: an equirectangular image laid out as the relief is, with its layers, and fast enough at 8192 px.
 */

import { TIMING_BUDGET_SCALE } from "~/tests/helpers/timing-budget";
import { generateWorldStaged, StageCache } from "~/lib/worldgen/v2";
import { OCEAN_COLOR } from "~/lib/worldgen/diagnostics";
import { renderMap } from "~/lib/worldgen/render-png";
import { worldGraph } from "~/tests/helpers/world-graph";

const SEA = [0xb3, 0xcd, 0xe0, 255];

describe("worldgen/render-png", () => {
  const graph = worldGraph();
  const flat = renderMap(graph, 2048, { politics: false });
  const political = renderMap(graph, 2048, { politics: true });

  const pixel = (image: { rgba: Uint8ClampedArray; width: number }, lng: number, lat: number) => {
    const x = Math.floor(((lng + 180) / 360) * image.width);
    const y = Math.floor(((90 - lat) / 180) * (image.width / 2));
    const i = (y * image.width + x) * 4;
    return [...image.rgba.slice(i, i + 4)];
  };

  it("is as wide as asked and half as tall, with straight opaque RGBA", () => {
    expect(OCEAN_COLOR).toBe("#b3cde0");
    expect(flat.width).toBe(2048);
    expect(flat.height).toBe(1024);
    expect(flat.rgba).toHaveLength(2048 * 1024 * 4);
    let opaque = 0;
    for (let i = 3; i < flat.rgba.length; i += 4) if (flat.rgba[i] === 255) opaque++;
    expect(opaque).toBe(2048 * 1024);
  });

  it("is deterministic", () => {
    const again = renderMap(graph, 2048, { politics: false });
    expect(Buffer.from(again.rgba).equals(Buffer.from(flat.rgba))).toBe(true);
  });

  it("puts a cell at its longitude and latitude (row 0 is 90N, column 0 is 180W)", () => {
    const { p, isLand, neighbors } = graph.cells;
    let deepSea = 0;
    let inland = 0;
    for (let c = 0; c < graph.cells.n && deepSea + inland < 300; c++) {
      const at = pixel(flat, p[c * 2]!, p[c * 2 + 1]!);
      const around = neighbors[c]!;
      if (isLand[c] === 0 && around.every((n) => isLand[n] === 0)) {
        expect(at).toEqual(SEA);
        deepSea++;
      } else if (isLand[c] === 1 && around.every((n) => isLand[n] === 1)) {
        expect(at).not.toEqual(SEA);
        inland++;
      }
    }
    expect(deepSea).toBeGreaterThan(50);
    expect(inland).toBeGreaterThan(50);
  });

  it("shades relief over the land, and leaves the sea flat", () => {
    const { isLand, neighbors, p } = graph.cells;
    const colours = new Set<string>();
    for (let c = 0; c < graph.cells.n; c++) {
      if (isLand[c] === 1 && neighbors[c]!.every((n) => isLand[n] === 1)) {
        colours.add(pixel(flat, p[c * 2]!, p[c * 2 + 1]!).join());
      }
    }
    // Bands and shading give the land many colours
    expect(colours.size).toBeGreaterThan(20);
  });

  it("adds political fills and borders only when asked", () => {
    expect(Buffer.from(political.rgba).equals(Buffer.from(flat.rgba))).toBe(false);
    // A land cell of a nation is tinted with its colour
    const { cells, states } = graph;
    const state = [...states].sort((a, b) => b.cellCount - a.cellCount)[0]!;
    const cell = [...cells.state].findIndex(
      (s, c) => s === state.id && cells.neighbors[c]!.every((n) => cells.state[n] === state.id)
    );
    expect(cell).toBeGreaterThanOrEqual(0);
    const [r, g, b] = [1, 3, 5].map((k) => Number.parseInt(state.color.slice(k, k + 2), 16));
    const at = pixel(political, cells.p[cell * 2]!, cells.p[cell * 2 + 1]!);
    const plain = pixel(flat, cells.p[cell * 2]!, cells.p[cell * 2 + 1]!);
    expect(Math.abs(at[0]! - r!) + Math.abs(at[1]! - g!) + Math.abs(at[2]! - b!)).toBeLessThan(
      Math.abs(plain[0]! - r!) + Math.abs(plain[1]! - g!) + Math.abs(plain[2]! - b!)
    );
  });

  it("draws rivers over the land, in the river colour", () => {
    const river = graph.rivers.find((r) => r.cells.length > 4)!;
    const mid = river.cells[Math.floor(river.cells.length / 2)]!;
    const at = pixel(flat, graph.cells.p[mid * 2]!, graph.cells.p[mid * 2 + 1]!);
    // 0x52 0x95 0xc4 at 92 % over the band colour
    expect(at[2]!).toBeGreaterThan(at[0]!);
  });

  it("covers 8192 px within the budget, and the pure compose of a default world stays under 2 s", () => {
    const world = generateWorldStaged({}, undefined, { cache: new StageCache() }).graph;
    const started = performance.now();
    const image = renderMap(world, 8192, { politics: true });
    const took = performance.now() - started;
    expect(image.width).toBe(8192);
    expect(image.height).toBe(4096);
    expect(image.rgba).toHaveLength(8192 * 4096 * 4);
    // 2 s in bun (measured about 0.7 s); jest transforms and instruments, so the scale applies
    expect(took).toBeLessThan(2000 * TIMING_BUDGET_SCALE * 2);
  }, 60_000);
});
