/**
 * @jest-environment node
 *
 * Building a realm's raster layer from a small generated globe: tiles land at the latitude the image shows them
 * (the high-latitude band included, where an image stretched without reprojection would be far off), the legend
 * is written, the grey copy is grey, a version is built once, and stale versions are pruned.
 */
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import {
  buildRealmRaster,
  pruneRasterVersions,
  rasterVersion,
} from "~/server/modules/maps/realm-rasters.build";
const W = 512;
const H = 256;
const RED = [220, 40, 40];
const GREEN = [40, 200, 60];
const BLUE = [30, 60, 220];

/** Northern hemisphere red with a green band from 60°N to 70°N, southern hemisphere blue. */
function colourAt(lat: number): number[] {
  if (lat >= 60 && lat < 70) return GREEN;
  return lat >= 0 ? RED : BLUE;
}

async function globe(width = W, height = H): Promise<Uint8Array> {
  const data = new Uint8Array(width * height * 3);
  for (let y = 0; y < height; y++) {
    const rgb = colourAt(90 - ((y + 0.5) / height) * 180);
    for (let x = 0; x < width; x++) data.set(rgb, (y * width + x) * 3);
  }
  return new Uint8Array(
    await sharp(data, { raw: { width, height, channels: 3 } })
      .png()
      .toBuffer()
  );
}

async function pixel(file: string, x: number, y: number): Promise<number[]> {
  const { data, info } = await sharp(file).raw().toBuffer({ resolveWithObject: true });
  const i = (y * info.width + x) * info.channels;
  return [...data.subarray(i, i + 3)];
}

const near = (actual: number[], expected: number[]) =>
  actual.every((v, i) => Math.abs(v - expected[i]!) <= 12);

let root: string;
beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), "raster-build-"));
  process.env.MAP_RASTER_DIR = root;
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
  delete process.env.MAP_RASTER_DIR;
});

describe("buildRealmRaster", () => {
  it("puts the 60–70°N band where Web Mercator has it, not where a stretched image would", async () => {
    const result = await buildRealmRaster({
      realmId: "r1",
      layerId: "geo",
      kind: "base",
      image: await globe(),
    });
    const north = path.join(result.dir, "1", "0", "0.webp");
    // 65°N is row 133 of z1's northern tile; a plain stretch of ±85° over the tile would put it at row 30
    expect(near(await pixel(north, 50, 133), GREEN)).toBe(true);
    expect(near(await pixel(north, 50, 30), RED)).toBe(true);
  });

  it("builds a version once and names it by its inputs", async () => {
    const image = await globe();
    const input = { realmId: "r1", layerId: "geo", kind: "overlay" as const, image };
    const first = await buildRealmRaster(input);
    const again = await buildRealmRaster(input);
    expect(again).toMatchObject({ version: first.version, built: false, tiles: 0 });
    expect(rasterVersion({ ...input, grey: true })).not.toBe(first.version);
    expect(rasterVersion({ ...input, kind: "base" })).not.toBe(first.version);
    expect(await buildRealmRaster({ ...input, force: true })).toMatchObject({ built: true });
  });
  it("refuses an image that is not a whole globe", async () => {
    await expect(
      buildRealmRaster({
        realmId: "r1",
        layerId: "geo",
        kind: "base",
        image: await globe(300, 256),
      })
    ).rejects.toThrow(/2:1/);
  });

  it("prunes every version but the ones kept", async () => {
    const a = await buildRealmRaster({
      realmId: "r1",
      layerId: "geo",
      kind: "base",
      image: await globe(),
    });
    const b = await buildRealmRaster({
      realmId: "r1",
      layerId: "geo",
      kind: "overlay",
      image: await globe(),
    });
    const c = await buildRealmRaster({
      realmId: "r1",
      layerId: "geo",
      kind: "base",
      image: await globe(),
      grey: true,
    });
    expect(await pruneRasterVersions("r1", "geo", [b.version, c.version])).toEqual([a.version]);
    expect(existsSync(a.dir)).toBe(false);
    expect(existsSync(c.dir)).toBe(true);
  });
});

/** A 512×256 globe, fully transparent except an opaque blob at 170°W–100°W, 40°N–70°N. */
async function blobGlobe(opaque = true): Promise<Uint8Array> {
  const data = new Uint8Array(W * H * 4);
  if (opaque) {
    for (let y = 28; y < 72; y++) {
      for (let x = 14; x < 114; x++) data.set([20, 20, 20, 160], (y * W + x) * 4);
    }
  }
  return new Uint8Array(
    await sharp(data, { raw: { width: W, height: H, channels: 4 } })
      .png()
      .toBuffer()
  );
}

describe("build options", () => {
  it("builds a layer whose every tile is transparent, and finds it built next time", async () => {
    const input = {
      realmId: "r1",
      layerId: "relief",
      kind: "overlay" as const,
      image: await blobGlobe(false),
      maxZoom: 1,
      skipTransparent: true,
    };
    const first = await buildRealmRaster(input);
    expect(first).toMatchObject({ built: true, tiles: 0, skipped: 5 });
    expect(existsSync(first.dir)).toBe(true);
    expect(await buildRealmRaster(input)).toMatchObject({ built: false });
  });
});
