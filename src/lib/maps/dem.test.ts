import { decodeTerrarium, demLevels, demPixelAt, demTile, encodeTerrarium } from "./dem";

const decodeAt = (tile: Uint8Array, r: number, c: number) => {
  const i = (r * 256 + c) * 3;
  return decodeTerrarium(tile[i]!, tile[i + 1]!, tile[i + 2]!);
};

it("round-trips heights through Terrarium within 1/256 m", () => {
  const px = new Uint8Array(3);
  for (const m of [-10994.5, -1, 0, 0.3, 812.75, 8848.86]) {
    encodeTerrarium(m, px, 0);
    expect(Math.abs(decodeTerrarium(px[0]!, px[1]!, px[2]!) - m)).toBeLessThan(1 / 256);
  }
});

it("halves a grid down to one tile, averaging", () => {
  const metres = new Float32Array(1024 * 512).fill(100);
  metres[0] = 500;
  const levels = demLevels({ width: 1024, height: 512, metres });
  expect(levels.map((l) => l.width)).toEqual([1024, 512, 256]);
  expect(levels[1]!.metres[0]).toBe(200);
  expect(() => demLevels({ width: 1000, height: 500, metres: new Float32Array(500000) })).toThrow();
});

it("samples a north-south ramp into Mercator tiles, upsampling past the grid", () => {
  const width = 512;
  const height = 256;
  const metres = new Float32Array(width * height);
  for (let y = 0; y < height; y++) metres.fill(1000 - y * 8, y * width, (y + 1) * width);
  const levels = demLevels({ width, height, metres });
  const z0 = demTile(levels, 0, 0, 0);
  expect(decodeAt(z0, 0, 10)).toBeGreaterThan(decodeAt(z0, 128, 10));
  expect(Math.abs(decodeAt(z0, 128, 10) - decodeAt(z0, 128, 200))).toBeLessThan(0.01);
  // z3 (2048 px) reads the 512 px grid: the equator row of the tile under it is ~1000 - 128·8
  const equator = demTile(levels, 3, 3, 4);
  expect(Math.abs(decodeAt(equator, 0, 0) - (1000 - 127.5 * 8))).toBeLessThan(10);
});

it("finds the z6 pixel holding a point", () => {
  expect(demPixelAt(-180, 0)).toMatchObject({ x: 0, y: 32, col: 0, row: 0 });
  expect(demPixelAt(179.999, -85.06)).toMatchObject({ x: 63, y: 63, col: 255, row: 255 });
});
