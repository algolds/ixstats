/** @jest-environment node */
import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";

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
const buildTile = jest.fn();
jest.mock("~/server/modules/maps/tile-render", () => ({
  buildTile: (...a: unknown[]) => buildTile(...a),
}));

import { GET } from "~/app/api/map-tiles/[realm]/[version]/[format]/[layer]/[z]/[x]/[y]/route";

const IMMUTABLE = "public, max-age=31536000, immutable";

interface Row {
  id: string;
  slug: string;
  status: string;
  ownerId: string;
  mapVersion: number;
}
const table: Row[] = [
  { id: "default", slug: "ixworld", status: "active", ownerId: "system", mapVersion: 3 },
  { id: "r_eurth", slug: "eurth", status: "active", ownerId: "clerk_owner", mapVersion: 2 },
  { id: "r_draft", slug: "draft-world", status: "draft", ownerId: "clerk_owner", mapVersion: 1 },
];

type Getter = (
  realm: string,
  version: string,
  layer: string,
  z: string,
  x: string,
  y: string,
  /** The URL's tile format segment; the build's own (`f1`) unless a test asks for another. */
  format?: string
) => Promise<Response>;

const getter =
  (handler: typeof GET): Getter =>
  (realm, version, layer, z, x, y, format = "f1") =>
    handler(
      new NextRequest(
        `http://localhost/api/map-tiles/${realm}/${version}/${format}/${layer}/${z}/${x}/${y}`
      ),
      { params: Promise.resolve({ realm, version, format, layer, z, x, y }) }
    );

const get = getter(GET);

/** The route loaded in a fresh module registry (empty memos), as a new process would have it. */
function freshGet(): Getter {
  jest.resetModules();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const route =
    require("~/app/api/map-tiles/[realm]/[version]/[format]/[layer]/[z]/[x]/[y]/route") as {
      GET: typeof GET;
    };
  return getter(route.GET);
}

let root: string;
beforeEach(() => {
  jest.clearAllMocks();
  root = mkdtempSync(path.join(tmpdir(), "map-tiles-route-"));
  process.env.MAP_TILE_DIR = root;
  realmFind.mockImplementation(
    async ({ where, select }: { where: { id?: string; slug?: string }; select: object }) => {
      const row = table.find((r) =>
        where.id !== undefined ? r.id === where.id : r.slug === where.slug
      );
      if (!row) return null;
      return "mapVersion" in select
        ? { mapVersion: row.mapVersion }
        : { id: row.id, status: row.status, ownerId: row.ownerId };
    }
  );
  buildTile.mockResolvedValue(new Uint8Array([1, 2, 3]));
  auth.mockResolvedValue({ userId: null });
  userFind.mockResolvedValue(null);
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
  delete process.env.MAP_TILE_DIR;
});
const body = async (res: Response) => new Uint8Array(await res.arrayBuffer());

describe("GET /api/map-tiles/<realm>/<version>/<format>/<layer>/<z>/<x>/<y>", () => {
  it("renders a tile once, writes it to the disk cache, and serves the next request without the renderer", async () => {
    const run = freshGet();
    await run("default", "3", "rivers", "2", "1", "3");
    expect(existsSync(path.join(root, "default", "f1", "3", "rivers", "2", "1", "3.pbf"))).toBe(
      true
    );
    const again = await run("default", "3", "rivers", "2", "1", "3");
    expect(await body(again)).toEqual(new Uint8Array([1, 2, 3]));
    expect(again.headers.get("cache-control")).toBe(IMMUTABLE);
    expect(buildTile).toHaveBeenCalledTimes(1);
  });
  it("answers the same tile for an Ixnay name, a realm id and a realm slug", async () => {
    const run = freshGet();
    for (const realm of ["default", "ixnay", "ixworld"]) {
      expect((await run(realm, "3", "lakes", "0", "0", "0")).status).toBe(200);
    }
    expect(buildTile.mock.calls.every(([, realm]) => realm === "default")).toBe(true);
    expect(buildTile).toHaveBeenCalledTimes(1);

    const byId = await run("r_eurth", "2", "lakes", "0", "0", "0");
    const bySlug = await run("eurth", "2", "lakes", "0", "0", "0");
    expect([byId.status, bySlug.status]).toEqual([200, 200]);
    expect(buildTile).toHaveBeenLastCalledWith(expect.anything(), "r_eurth", "lakes", 0, 0, 0);
    expect(buildTile).toHaveBeenCalledTimes(2);
  });

  it.each([
    ["unknown layer", "default", "3", "political", "1", "0", "0"],
    ["climate (drawn from GeoJSON)", "default", "3", "climate", "1", "0", "0"],
    ["fractional z", "default", "3", "rivers", "1.5", "0", "0"],
    ["negative x", "default", "3", "rivers", "2", "-1", "0"],
    ["x out of range", "default", "3", "rivers", "2", "4", "0"],
    ["z above 6", "default", "3", "rivers", "7", "0", "0"],
    ["a hex x", "default", "3", "rivers", "2", "0x1", "0"],
    ["a non-numeric version", "default", "latest", "rivers", "1", "0", "0"],
    ["a negative version", "default", "-1", "rivers", "1", "0", "0"],
    ["a fractional version", "default", "1.5", "rivers", "1", "0", "0"],
    ["an enormous version", "default", "99999999999999", "rivers", "1", "0", "0"],
    ["a version past a 32-bit integer", "default", "2147483648", "rivers", "1", "0", "0"],
  ])("404s on %s without querying", async (_n, realm, version, layer, z, x, y) => {
    const res = await get(realm, version, layer, z, x, y);
    expect(res.status).toBe(404);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(buildTile).not.toHaveBeenCalled();
    expect(realmFind).not.toHaveBeenCalled();
  });

  it.each([
    ["a number", "1"],
    ["a word", "latest"],
    ["an f with no number", "f"],
    ["a negative format", "f-1"],
    ["a fractional format", "f1.5"],
    ["an enormous format", "f9999999999"],
  ])("404s on %s for the format without querying", async (_n, format) => {
    const res = await get("default", "3", "rivers", "1", "0", "0", format);
    expect(res.status).toBe(404);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(buildTile).not.toHaveBeenCalled();
    expect(realmFind).not.toHaveBeenCalled();
  });

  it("answers a URL of another tile format with this build's tiles, but never as that URL's immutable copy", async () => {
    const run = freshGet();
    for (const format of ["f0", "f2"]) {
      const res = await run("default", "3", "rivers", "1", "0", "0", format);
      expect(res.status).toBe(200);
      expect(res.headers.get("cache-control")).toBe("private, no-store");
      expect(await body(res)).toEqual(new Uint8Array([1, 2, 3]));
    }
    // the tile itself is stored once, under this build's format, and is immutable at its own URL
    expect(readdirSync(path.join(root, "default"))).toEqual(["f1"]);
    expect(buildTile).toHaveBeenCalledTimes(1);
    expect((await run("default", "3", "rivers", "1", "0", "0")).headers.get("cache-control")).toBe(
      IMMUTABLE
    );
  });
  it("answers an out-of-date version from the current version's cache, uncacheable, rendering once", async () => {
    const run = freshGet();
    for (const version of ["1", "0", "1"]) {
      const res = await run("r_eurth", version, "lakes", "0", "0", "0");
      expect(res.status).toBe(200);
      expect(res.headers.get("cache-control")).toBe("private, no-store");
      expect(await body(res)).toEqual(new Uint8Array([1, 2, 3]));
    }
    expect(buildTile).toHaveBeenCalledTimes(1);
    expect(readdirSync(path.join(root, "r_eurth", "f1"))).toEqual(["2"]);
    expect(existsSync(path.join(root, "r_eurth", "f1", "2", "lakes", "0", "0", "0.pbf"))).toBe(
      true
    );
    // The current version's own URL is then a hit, and immutable
    const current = await run("r_eurth", "2", "lakes", "0", "0", "0");
    expect(current.headers.get("cache-control")).toBe(IMMUTABLE);
    expect(buildTile).toHaveBeenCalledTimes(1);
  });
  it("404s on a version the realm has not reached, writing nothing", async () => {
    const res = await get("r_eurth", "9", "lakes", "0", "0", "0");
    expect(res.status).toBe(404);
    expect(buildTile).not.toHaveBeenCalled();
    expect(readdirSync(root)).toEqual([]);
  });

  it("answers 500 when the tile query fails, uncached, and tries again next time", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    buildTile.mockRejectedValueOnce(new Error("db down"));
    const run = freshGet();
    const failed = await run("default", "3", "rivers", "0", "0", "0");
    expect(failed.status).toBe(500);
    expect(failed.headers.get("cache-control")).toBe("no-store");
    expect((await run("default", "3", "rivers", "0", "0", "0")).status).toBe(200);
  });
});
