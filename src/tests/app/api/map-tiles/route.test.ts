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
jest.mock("~/server/api/routers/geo/core/tiles", () => ({
  buildTile: (...a: unknown[]) => buildTile(...a),
}));

import { GET } from "~/app/api/map-tiles/[realm]/[version]/[layer]/[z]/[x]/[y]/route";

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
  y: string
) => Promise<Response>;

const getter =
  (handler: typeof GET): Getter =>
  (realm, version, layer, z, x, y) =>
    handler(
      new NextRequest(`http://localhost/api/map-tiles/${realm}/${version}/${layer}/${z}/${x}/${y}`),
      { params: Promise.resolve({ realm, version, layer, z, x, y }) }
    );

const get = getter(GET);

/** The route loaded in a fresh module registry (empty memos), as a new process would have it. */
function freshGet(): Getter {
  jest.resetModules();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const route = require("~/app/api/map-tiles/[realm]/[version]/[layer]/[z]/[x]/[y]/route") as {
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

const asOwner = () => {
  auth.mockResolvedValue({ userId: "clerk_owner" });
  userFind.mockResolvedValue({
    id: "u1",
    clerkUserId: "clerk_owner",
    role: { name: "user", level: 100 },
  });
};
const asAnonymous = () => {
  auth.mockResolvedValue({ userId: null });
  userFind.mockResolvedValue(null);
};

const body = async (res: Response) => new Uint8Array(await res.arrayBuffer());

describe("GET /api/map-tiles/<realm>/<version>/<layer>/<z>/<x>/<y>", () => {
  it("serves an Ixnay tile as immutable, from the current version", async () => {
    const res = await get("default", "3", "rivers", "2", "1", "3");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/x-protobuf");
    expect(res.headers.get("cache-control")).toBe(IMMUTABLE);
    expect(await body(res)).toEqual(new Uint8Array([1, 2, 3]));
    expect(buildTile).toHaveBeenCalledWith(expect.anything(), "default", "rivers", 2, 1, 3);
  });

  it("renders a tile once, writes it to the disk cache, and serves the next request without the renderer", async () => {
    const run = freshGet();
    await run("default", "3", "rivers", "2", "1", "3");
    expect(existsSync(path.join(root, "default", "3", "rivers", "2", "1", "3.pbf"))).toBe(true);
    const again = await run("default", "3", "rivers", "2", "1", "3");
    expect(await body(again)).toEqual(new Uint8Array([1, 2, 3]));
    expect(again.headers.get("cache-control")).toBe(IMMUTABLE);
    expect(buildTile).toHaveBeenCalledTimes(1);
  });

  it("serves a tile another process cached from disk, without the renderer", async () => {
    await freshGet()("default", "3", "lakes", "1", "0", "1");
    buildTile.mockClear();
    const res = await freshGet()("default", "3", "lakes", "1", "0", "1");
    expect(res.status).toBe(200);
    expect(buildTile).not.toHaveBeenCalled();
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
  ])("404s on %s without querying", async (_n, realm, version, layer, z, x, y) => {
    const res = await get(realm, version, layer, z, x, y);
    expect(res.status).toBe(404);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(buildTile).not.toHaveBeenCalled();
    expect(realmFind).not.toHaveBeenCalled();
  });

  it("404s on an unknown realm, uncached", async () => {
    const res = await get("r_nope", "0", "lakes", "0", "0", "0");
    expect(res.status).toBe(404);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(readdirSync(root)).toEqual([]);
  });

  it("serves a published realm's tiles as immutable", async () => {
    const res = await get("r_eurth", "2", "lakes", "0", "0", "0");
    expect(res.headers.get("cache-control")).toBe(IMMUTABLE);
  });

  it("hides a draft realm from anyone who cannot moderate it, without rendering or caching", async () => {
    const res = await get("r_draft", "1", "lakes", "0", "0", "0");
    expect(res.status).toBe(404);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(buildTile).not.toHaveBeenCalled();
    expect(readdirSync(root)).toEqual([]);
  });

  it("serves a draft realm to its owner, never cacheable by a shared cache", async () => {
    asOwner();
    const res = await get("r_draft", "1", "lakes", "0", "0", "0");
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
  });

  it("does not serve a draft realm's cached tile to an anonymous viewer after its owner loaded it", async () => {
    const run = freshGet();
    asOwner();
    expect((await run("r_draft", "1", "lakes", "0", "0", "0")).status).toBe(200);
    expect(existsSync(path.join(root, "r_draft", "1", "lakes", "0", "0", "0.pbf"))).toBe(true);

    asAnonymous();
    for (const name of ["r_draft", "draft-world"]) {
      const res = await run(name, "1", "lakes", "0", "0", "0");
      expect(res.status).toBe(404);
      expect(res.headers.get("cache-control")).toBe("no-store");
      expect((await body(res)).length).toBe(0);
    }
    // The owner still gets the cached tile, still private
    asOwner();
    const again = await run("r_draft", "1", "lakes", "0", "0", "0");
    expect(again.headers.get("cache-control")).toBe("private, no-store");
    expect(buildTile).toHaveBeenCalledTimes(1);
  });

  it("serves an empty tile as an empty body, cached like any other (a realm with no features)", async () => {
    buildTile.mockResolvedValue(new Uint8Array());
    const run = freshGet();
    const first = await run("default", "3", "altitudes", "3", "7", "7");
    expect(first.status).toBe(200);
    expect(first.headers.get("cache-control")).toBe(IMMUTABLE);
    expect((await body(first)).length).toBe(0);
    const again = await run("default", "3", "altitudes", "3", "7", "7");
    expect(again.status).toBe(200);
    expect((await body(again)).length).toBe(0);
    expect(buildTile).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["1", "1"],
    ["3", "7"],
    ["3", "0"],
  ])(
    "renders z%s x%s, a tile on the antimeridian's edge, like any other (the tile SQL splits what crosses it)",
    async (z, x) => {
      const res = await get("default", "3", "altitudes", z, x, "1");
      expect(res.status).toBe(200);
      expect(buildTile).toHaveBeenLastCalledWith(
        expect.anything(),
        "default",
        "altitudes",
        Number(z),
        Number(x),
        1
      );
    }
  );

  it("answers an out-of-date version from the current version's cache, uncacheable, rendering once", async () => {
    const run = freshGet();
    for (const version of ["1", "0", "1"]) {
      const res = await run("r_eurth", version, "lakes", "0", "0", "0");
      expect(res.status).toBe(200);
      expect(res.headers.get("cache-control")).toBe("private, no-store");
      expect(await body(res)).toEqual(new Uint8Array([1, 2, 3]));
    }
    expect(buildTile).toHaveBeenCalledTimes(1);
    expect(readdirSync(path.join(root, "r_eurth"))).toEqual(["2"]);
    expect(existsSync(path.join(root, "r_eurth", "2", "lakes", "0", "0", "0.pbf"))).toBe(true);
    // The current version's own URL is then a hit, and immutable
    const current = await run("r_eurth", "2", "lakes", "0", "0", "0");
    expect(current.headers.get("cache-control")).toBe(IMMUTABLE);
    expect(buildTile).toHaveBeenCalledTimes(1);
  });

  it("makes only ID-addressed URLs immutable: a slug can be renamed or reassigned", async () => {
    const run = freshGet();
    const byId = await run("r_eurth", "2", "lakes", "0", "0", "0");
    const bySlug = await run("eurth", "2", "lakes", "0", "0", "0");
    expect(byId.headers.get("cache-control")).toBe(IMMUTABLE);
    expect(bySlug.headers.get("cache-control")).toBe("public, max-age=300");
    expect(bySlug.status).toBe(200);
    expect(await body(bySlug)).toEqual(await body(byId));
  });

  it.each([
    ["the Ixnay realm id", "default", IMMUTABLE],
    ["Ixnay's slug", "ixworld", "public, max-age=300"],
    ["Ixnay's name", "ixnay", "public, max-age=300"],
  ])("serves Ixnay by %s with its own cache header", async (_name, realm, cacheControl) => {
    const res = await get(realm, "3", "lakes", "0", "0", "0");
    expect(res.headers.get("cache-control")).toBe(cacheControl);
  });

  it("keeps a slug-addressed unpublished realm private and uncached", async () => {
    asOwner();
    const res = await get("draft-world", "1", "lakes", "0", "0", "0");
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    asAnonymous();
    expect((await get("draft-world", "1", "lakes", "0", "0", "0")).status).toBe(404);
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
