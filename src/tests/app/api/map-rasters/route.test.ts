/** @jest-environment node */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import sharp from "sharp";

const auth = jest.fn().mockResolvedValue({ userId: null });
jest.mock("@clerk/nextjs/server", () => ({ auth: () => auth() }));
const realmFind = jest.fn();
const userFind = jest.fn().mockResolvedValue(null);
jest.mock("~/server/db", () => ({
  db: {
    realm: { findUnique: (a: unknown) => realmFind(a) },
    user: { findUnique: (a: unknown) => userFind(a) },
  },
}));

import { GET as getTile } from "~/app/api/map-rasters/[realm]/[layer]/[version]/[z]/[x]/[y]/route";
import { GET as getLegend } from "~/app/api/map-rasters/[realm]/[layer]/[version]/legend/route";
import { transparentRasterTile } from "~/server/modules/maps/realm-rasters.serve";

const VERSION = "0123456789abcdef";
let root: string;

beforeAll(() => {
  root = mkdtempSync(path.join(tmpdir(), "map-rasters-"));
  process.env.MAP_RASTER_DIR = root;
  const dir = path.join(root, "r_eurth", "geography", VERSION);
  mkdirSync(path.join(dir, "2", "1"), { recursive: true });
  writeFileSync(path.join(dir, "2", "1", "3.webp"), Uint8Array.from([7, 8, 9]));
  writeFileSync(path.join(dir, "legend.webp"), Uint8Array.from([4, 5]));
  // A relief layer builds only the tiles with shading in them
  const relief = path.join(root, "r_eurth", "relief", VERSION);
  mkdirSync(path.join(relief, "2", "1"), { recursive: true });
  writeFileSync(path.join(relief, "2", "1", "3.webp"), Uint8Array.from([5, 6]));
  // A file next to the realm folders that no URL may reach
  writeFileSync(path.join(root, "secret.webp"), Uint8Array.from([1]));
});

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
  delete process.env.MAP_RASTER_DIR;
  jest.restoreAllMocks();
});

// The realm row is memoised for 60 s (realm-tile-access.ts) and each test sets its own, so every test starts a
// minute later than the last
let clock = Date.now();

beforeEach(() => {
  jest.clearAllMocks();
  clock += 61_000;
  jest.spyOn(Date, "now").mockReturnValue(clock);
  realmFind.mockResolvedValue({ id: "r_eurth", status: "active", ownerId: "clerk_owner" });
});

const tile = (realm: string, layer: string, version: string, z: string, x: string, y: string) =>
  getTile(
    new NextRequest(`http://localhost/api/map-rasters/${realm}/${layer}/${version}/${z}/${x}/${y}`),
    {
      params: Promise.resolve({ realm, layer, version, z, x, y }),
    }
  );

const legend = (realm: string, layer: string, version: string) =>
  getLegend(
    new NextRequest(`http://localhost/api/map-rasters/${realm}/${layer}/${version}/legend`),
    {
      params: Promise.resolve({ realm, layer, version }),
    }
  );

describe("GET /api/map-rasters", () => {
  it("serves a published realm's tile as WebP, cached for good (the URL names the version)", async () => {
    const res = await tile("r_eurth", "geography", VERSION, "2", "1", "3");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/webp");
    expect(res.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(Uint8Array.from([7, 8, 9]));
  });

  it("serves the layer's legend", async () => {
    const res = await legend("r_eurth", "geography", VERSION);
    expect(res.status).toBe(200);
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(Uint8Array.from([4, 5]));
  });

  it("404s on a tile that was not built", async () => {
    expect((await tile("r_eurth", "geography", VERSION, "2", "0", "0")).status).toBe(404);
    expect((await legend("r_eurth", "climate", VERSION)).status).toBe(404);
  });

  it.each([
    ["a realm with a dot", "..", "geography", VERSION, "0", "0", "0"],
    ["a layer that climbs out", "r_eurth", "..", VERSION, "0", "0", "0"],
    ["a version that is not a hash", "r_eurth", "geography", "../..", "0", "0", "0"],
    ["an empty coordinate", "r_eurth", "geography", VERSION, "", "0", "0"],
    ["a coordinate outside the pyramid", "r_eurth", "geography", VERSION, "2", "4", "0"],
    ["a zoom above the largest", "r_eurth", "geography", VERSION, "9", "0", "0"],
    ["a signed coordinate", "r_eurth", "geography", VERSION, "2", "+1", "3"],
  ])("404s on %s without looking up the realm", async (_n, realm, layer, version, z, x, y) => {
    expect((await tile(realm, layer, version, z, x, y)).status).toBe(404);
    expect(realmFind).not.toHaveBeenCalled();
  });

  it("hides a draft realm's art from anyone who cannot see the realm", async () => {
    realmFind.mockResolvedValue({ id: "r_eurth", status: "draft", ownerId: "clerk_owner" });
    expect((await tile("r_eurth", "geography", VERSION, "2", "1", "3")).status).toBe(404);
  });

  it("serves a draft realm's art to its owner, uncached", async () => {
    realmFind.mockResolvedValue({ id: "r_eurth", status: "draft", ownerId: "clerk_owner" });
    auth.mockResolvedValueOnce({ userId: "clerk_owner" });
    userFind.mockResolvedValueOnce({
      id: "u1",
      clerkUserId: "clerk_owner",
      role: { name: "user", level: 100 },
    });
    const res = await tile("r_eurth", "geography", VERSION, "2", "1", "3");
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
  });

  describe("a relief tile that was not built", () => {
    const alpha = async (res: Response) => {
      const { data, info } = await sharp(new Uint8Array(await res.arrayBuffer()))
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      return { size: [info.width, info.height], opaque: data.some((v, i) => i % 4 === 3 && v > 0) };
    };

    it("serves a built relief tile as it is", async () => {
      const res = await tile("r_eurth", "relief", VERSION, "2", "1", "3");
      expect(new Uint8Array(await res.arrayBuffer())).toEqual(Uint8Array.from([5, 6]));
    });

    it("is one transparent 256 px tile, cached for good like any other", async () => {
      const res = await tile("r_eurth", "relief", VERSION, "2", "0", "0");
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toBe("image/webp");
      expect(res.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
      expect(await alpha(res)).toEqual({ size: [256, 256], opaque: false });
    });

    it("is built once per process", async () => {
      expect(transparentRasterTile()).toBe(transparentRasterTile());
      const a = new Uint8Array(
        await (await tile("r_eurth", "relief", VERSION, "2", "0", "0")).arrayBuffer()
      );
      const b = new Uint8Array(
        await (await tile("r_eurth", "relief", VERSION, "3", "7", "7")).arrayBuffer()
      );
      expect(b).toEqual(a);
      expect(b).toEqual(await transparentRasterTile());
    });

    it("stays a 404 for a version that was never built, a legend, and a tile outside the pyramid", async () => {
      expect((await tile("r_eurth", "relief", "fedcba9876543210", "2", "0", "0")).status).toBe(404);
      expect((await legend("r_eurth", "relief", VERSION)).status).toBe(404);
      expect((await tile("r_eurth", "relief", VERSION, "2", "4", "0")).status).toBe(404);
    });

    it("is only answered up to the layer's zoom ceiling (z5), a 404 for a tile that cannot exist", async () => {
      expect((await tile("r_eurth", "relief", VERSION, "5", "31", "31")).status).toBe(200);
      expect((await tile("r_eurth", "relief", VERSION, "6", "0", "0")).status).toBe(404);
      expect((await tile("r_eurth", "relief", VERSION, "7", "100", "50")).status).toBe(404);
    });

    it("keeps the realm's access rules", async () => {
      realmFind.mockResolvedValue({ id: "r_eurth", status: "draft", ownerId: "clerk_owner" });
      expect((await tile("r_eurth", "relief", VERSION, "2", "0", "0")).status).toBe(404);
    });
  });
});
