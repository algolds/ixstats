import { renderMap } from "~/lib/worldgen/render-png";
import { worldGraph } from "~/tests/helpers/world-graph";

const SEA = [0xb3, 0xcd, 0xe0, 255];

describe("worldgen/render-png", () => {
  const graph = worldGraph();
  const flat = renderMap(graph, 2048, { politics: false, icecaps: false });
  const political = renderMap(graph, 2048, { politics: true, icecaps: false });

  const pixel = (image: { rgba: Uint8ClampedArray; width: number }, lng: number, lat: number) => {
    const x = Math.floor(((lng + 180) / 360) * image.width);
    const y = Math.floor(((90 - lat) / 180) * (image.width / 2));
    const i = (y * image.width + x) * 4;
    return [...image.rgba.slice(i, i + 4)];
  };
  it("is deterministic", () => {
    const again = renderMap(graph, 2048, { politics: false, icecaps: false });
    expect(Buffer.from(again.rgba).equals(Buffer.from(flat.rgba))).toBe(true);
  });

  it("puts a cell at its longitude and latitude (row 0 is 90N, column 0 is 180W)", () => {
    const { p, isLand, neighbors } = graph.cells;
    let deepSea = 0;
    let inland = 0;
    for (let c = 0; c < graph.cells.n && (deepSea < 150 || inland < 150); c++) {
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

  /** Makes `cell` an ice cap cell for the test and checks the render with and without ice caps. */
  function expectIce(cell: number) {
    const { cells } = graph;
    const was = cells.biome[cell]!;
    cells.biome[cell] = 10;
    try {
      const withIce = renderMap(graph, 2048, { politics: false, icecaps: true });
      const without = renderMap(graph, 2048, { politics: false, icecaps: false });
      const at = [cells.p[cell * 2]!, cells.p[cell * 2 + 1]!] as const;
      const bare = pixel(flat, ...at);
      // Off: nothing changes. On: the cell is the ice colour (#f0f4f8 at 70 %) over what was there
      expect(pixel(without, ...at)).toEqual(bare);
      const iced = pixel(withIce, ...at);
      const expected = [0xf0, 0xf4, 0xf8].map((ice, k) => 0.7 * ice + 0.3 * bare[k]!);
      iced
        .slice(0, 3)
        .forEach((value, k) => expect(Math.abs(value - expected[k]!)).toBeLessThan(2));
    } finally {
      cells.biome[cell] = was;
    }
  }

  const interior = (land: 0 | 1) => {
    const { cells } = graph;
    const cell = [...cells.isLand].findIndex(
      (value, c) =>
        value === land &&
        cells.biome[c] !== 10 &&
        cells.neighbors[c]!.every((n) => cells.isLand[n] === land)
    );
    expect(cell).toBeGreaterThanOrEqual(0);
    return cell;
  };

  it("draws ice cap cells in the ice colour when the world has ice caps, and not when it has none", () => {
    expectIce(interior(1));
  });
});
