/** @jest-environment node */
/**
 * A realm taken out of publication stops serving tiles publicly at once (Atlas R0 Review Focus 1): the admin update
 * that flips its status goes through invalidateRealmMap, which drops the tile route's 60 s realm-row memo, so the
 * next request sees the new status. The router, the invalidation helper and the tile route are the real ones; only
 * the database, Clerk and the tile renderer are faked.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";

const auth = jest.fn().mockResolvedValue({ userId: null });
jest.mock("@clerk/nextjs/server", () => ({ auth: () => auth() }));

interface Row {
  id: string;
  slug: string;
  status: string;
  ownerId: string;
  mapVersion: number;
}
const table: Row[] = [];
const userFind = jest.fn().mockResolvedValue(null);
const fakeDb = {
  realm: {
    findUnique: jest.fn(
      async ({ where, select }: { where: { id?: string; slug?: string }; select: object }) => {
        const row = table.find((r) =>
          where.id !== undefined ? r.id === where.id : r.slug === where.slug
        );
        if (!row) return null;
        return "mapVersion" in select
          ? { mapVersion: row.mapVersion }
          : { id: row.id, status: row.status, ownerId: row.ownerId };
      }
    ),
    update: jest.fn(async ({ where, data }: { where: { id: string }; data: Partial<Row> }) => {
      const row = table.find((r) => r.id === where.id);
      if (!row) throw new Error("no such realm");
      Object.assign(row, data);
      return row;
    }),
  },
  user: { findUnique: (a: unknown) => userFind(a) },
  auditLog: { create: jest.fn() },
  // invalidateRealmMap: UPDATE "realms" SET "mapVersion" = "mapVersion" + 1 WHERE "id" = $1 RETURNING "mapVersion"
  $queryRaw: jest.fn(async (_sql: TemplateStringsArray, realmId: string) => {
    const row = table.find((r) => r.id === realmId);
    if (row) row.mapVersion += 1;
    return row ? [{ mapVersion: row.mapVersion }] : [];
  }),
};
// Imports run before fakeDb is initialised, so the module hands out a proxy that reads it on use
jest.mock("~/server/db", () => ({
  db: new Proxy({}, { get: (_t, name: string) => (fakeDb as Record<string, unknown>)[name] }),
}));
const buildTile = jest.fn();
jest.mock("~/server/modules/maps/tile-render", () => ({
  buildTile: (...a: unknown[]) => buildTile(...a),
}));
jest.mock("~/lib/cache", () => ({
  ...jest.requireActual("~/lib/cache"),
  invalidateCache: jest.fn().mockResolvedValue(undefined),
}));

import { GET } from "~/app/api/map-tiles/[realm]/[version]/[format]/[layer]/[z]/[x]/[y]/route";
import { realmsRouter } from "~/server/api/routers/realms";
import { createMockRouterContext } from "~/tests/helpers/router-context";

const IMMUTABLE = "public, max-age=31536000, immutable";
const admin = { id: "db_admin", clerkUserId: "admin_1", role: { name: "admin", level: 10 } };

const tile = (realm: string, version: number) =>
  GET(new NextRequest(`http://localhost/api/map-tiles/${realm}/${version}/f1/lakes/0/0/0`), {
    params: Promise.resolve({
      realm,
      version: String(version),
      format: "f1",
      layer: "lakes",
      z: "0",
      x: "0",
      y: "0",
    }),
  });

const adminUpdate = (input: {
  id: string;
  status: "draft" | "generating" | "active" | "archived";
}) =>
  realmsRouter
    .createCaller(
      createMockRouterContext({
        db: fakeDb,
        auth: { userId: admin.clerkUserId },
        user: admin,
      }) as never
    )
    .adminUpdateRealm(input);

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

let root: string;
// The tile route memoises the realm row for 60 s; every test starts a minute after the last, so it begins unmemoised
let clock = Date.now();
beforeEach(() => {
  jest.clearAllMocks();
  clock += 61_000;
  jest.spyOn(Date, "now").mockReturnValue(clock);
  root = mkdtempSync(path.join(tmpdir(), "map-tiles-unpublish-"));
  process.env.MAP_TILE_DIR = root;
  table.length = 0;
  table.push({
    id: "r_live",
    slug: "live",
    status: "active",
    ownerId: "clerk_owner",
    mapVersion: 4,
  });
  buildTile.mockResolvedValue(new Uint8Array([1, 2, 3]));
  asAnonymous();
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
  delete process.env.MAP_TILE_DIR;
});
afterAll(() => jest.restoreAllMocks());

describe("unpublishing a realm", () => {
  it.each(["draft", "generating"] as const)(
    "makes its next tile request private and refused to a signed-out viewer when its status becomes %s",
    async (status) => {
      // Public and immutable while published; the realm row is now memoised by the tile route
      const before = await tile("r_live", 4);
      expect(before.status).toBe(200);
      expect(before.headers.get("cache-control")).toBe(IMMUTABLE);

      await adminUpdate({ id: "r_live", status });

      // The next request, with the old URL and with the new version's
      for (const version of [4, 5]) {
        const anonymous = await tile("r_live", version);
        expect(anonymous.status).toBe(404);
        expect(anonymous.headers.get("cache-control")).toBe("no-store");
      }
      asOwner();
      const owner = await tile("r_live", 5);
      expect(owner.status).toBe(200);
      expect(owner.headers.get("cache-control")).toBe("private, no-store");
    }
  );

  it("moves the realm to a new map version, so published URLs are not reused", async () => {
    await adminUpdate({ id: "r_live", status: "draft" });
    expect(table[0]!.mapVersion).toBe(5);
  });

  it("makes a draft realm public as soon as it is published", async () => {
    table[0]!.status = "draft";
    expect((await tile("r_live", 4)).status).toBe(404);
    await adminUpdate({ id: "r_live", status: "active" });
    const published = await tile("r_live", 5);
    expect(published.status).toBe(200);
    expect(published.headers.get("cache-control")).toBe(IMMUTABLE);
  });
});
