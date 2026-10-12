/** @jest-environment node */
/**
 * Who may read a realm's map tiles. The realm row is memoised for 60 s; the answer for the viewer never is (a
 * staff member's "private" must not reach an anonymous viewer). A tile URL names the realm by id or by slug.
 */
const auth = jest.fn();
jest.mock("@clerk/nextjs/server", () => ({ auth: () => auth() }));
const realmFind = jest.fn();
const userFind = jest.fn();
jest.mock("~/server/db", () => ({
  db: {
    realm: { findUnique: (a: unknown) => realmFind(a) },
    user: { findUnique: (a: unknown) => userFind(a) },
  },
}));
jest.mock("~/lib/cache", () => ({
  ...jest.requireActual("~/lib/cache"),
  invalidateCache: jest.fn().mockResolvedValue(undefined),
}));

type Access = typeof import("~/server/modules/maps/realm-tile-access");
type Invalidation = typeof import("~/server/shared/map-invalidation");

interface Row {
  id: string;
  slug: string;
  status: string;
  ownerId: string;
}
let rows: Row[];

let access: Access;
let invalidation: Invalidation;

beforeEach(() => {
  jest.useFakeTimers({ now: new Date("2026-10-11T12:00:00Z") });
  rows = [
    { id: "r_eurth", slug: "eurth", status: "active", ownerId: "clerk_owner" },
    { id: "r_draft", slug: "draft-world", status: "draft", ownerId: "clerk_owner" },
  ];
  realmFind.mockReset();
  realmFind.mockImplementation(async ({ where }: { where: { id?: string; slug?: string } }) => {
    const row = rows.find((r) =>
      where.id !== undefined ? r.id === where.id : r.slug === where.slug
    );
    return row ? { id: row.id, status: row.status, ownerId: row.ownerId } : null;
  });
  auth.mockReset();
  auth.mockResolvedValue({ userId: null });
  userFind.mockReset();
  userFind.mockResolvedValue(null);
  jest.resetModules();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  access = require("~/server/modules/maps/realm-tile-access") as Access;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  invalidation = require("~/server/shared/map-invalidation") as Invalidation;
});
afterEach(() => jest.useRealTimers());

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

describe("resolveTileRealm", () => {
  it.each(["default", "ixnay", "ixworld"])(
    "resolves %s to Ixnay without reading a realm",
    async (name) => {
      expect(await access.resolveTileRealm(name)).toEqual({ id: "default", access: "public" });
      expect(realmFind).not.toHaveBeenCalled();
    }
  );

  it("resolves a realm id and a slug to the same realm", async () => {
    expect(await access.resolveTileRealm("r_eurth")).toEqual({ id: "r_eurth", access: "public" });
    expect(await access.resolveTileRealm("eurth")).toEqual({ id: "r_eurth", access: "public" });
  });

  it("is null for an unknown id or slug, and does not remember it", async () => {
    expect(await access.resolveTileRealm("nowhere")).toBeNull();
    expect(await access.resolveTileRealm("nowhere")).toBeNull();
    rows.push({ id: "r_new", slug: "nowhere", status: "active", ownerId: "clerk_owner" });
    expect(await access.resolveTileRealm("nowhere")).toEqual({ id: "r_new", access: "public" });
  });

  it("memoises the realm row for 60 s", async () => {
    await access.resolveTileRealm("r_eurth");
    await access.resolveTileRealm("r_eurth");
    expect(realmFind).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(59_000);
    await access.resolveTileRealm("r_eurth");
    expect(realmFind).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(2_000);
    await access.resolveTileRealm("r_eurth");
    expect(realmFind).toHaveBeenCalledTimes(2);
  });

  it("hides an unpublished realm from anyone who cannot moderate it", async () => {
    expect(await access.resolveTileRealm("r_draft")).toBeNull();
    expect(await access.resolveTileRealm("draft-world")).toBeNull();
  });

  it("gives an unpublished realm's owner private access", async () => {
    asOwner();
    expect(await access.resolveTileRealm("r_draft")).toEqual({ id: "r_draft", access: "private" });
  });

  it("never lets a staff member's answer reach an anonymous viewer through the memo", async () => {
    asOwner();
    expect(await access.resolveTileRealm("r_draft")).toEqual({ id: "r_draft", access: "private" });
    asAnonymous();
    expect(await access.resolveTileRealm("r_draft")).toBeNull();
    expect(await access.resolveTileRealm("draft-world")).toBeNull();
    asOwner();
    expect(await access.resolveTileRealm("r_draft")).toEqual({ id: "r_draft", access: "private" });
    // The realm row was read once per name; the viewer was asked every time
    expect(realmFind.mock.calls.filter(([a]) => a.where.id === "r_draft")).toHaveLength(1);
    expect(auth).toHaveBeenCalledTimes(4);
  });

  it("does not ask who is viewing for a published realm", async () => {
    await access.resolveTileRealm("r_eurth");
    expect(auth).not.toHaveBeenCalled();
  });

  it("reads the realm again after its map was invalidated", async () => {
    expect(await access.resolveTileRealm("r_draft")).toBeNull();
    rows[1]!.status = "active";
    expect(await access.resolveTileRealm("r_draft")).toBeNull();
    await invalidation.invalidateRealmMap(
      { $queryRaw: jest.fn().mockResolvedValue([{ mapVersion: 1 }]) },
      "r_draft"
    );
    expect(await access.resolveTileRealm("r_draft")).toEqual({ id: "r_draft", access: "public" });
  });

  it("keeps other realms' rows when one realm's map is invalidated, and drops all on a global change", async () => {
    await access.resolveTileRealm("r_eurth");
    await access.resolveTileRealm("r_draft");
    realmFind.mockClear();
    await invalidation.invalidateRealmMap(
      { $queryRaw: jest.fn().mockResolvedValue([{ mapVersion: 1 }]) },
      "r_draft"
    );
    await access.resolveTileRealm("r_eurth");
    expect(realmFind).not.toHaveBeenCalled();
    await invalidation.invalidateAllRealmMaps({ $executeRaw: jest.fn().mockResolvedValue(2) });
    await access.resolveTileRealm("r_eurth");
    expect(realmFind).toHaveBeenCalledTimes(1);
  });
});

describe("realmTileAccess", () => {
  it("answers for a realm id as it did before the memo (the raster art route uses it)", async () => {
    expect(await access.realmTileAccess("default")).toBe("public");
    expect(await access.realmTileAccess("r_eurth")).toBe("public");
    expect(await access.realmTileAccess("r_draft")).toBeNull();
    asOwner();
    expect(await access.realmTileAccess("r_draft")).toBe("private");
    expect(await access.realmTileAccess("r_gone")).toBeNull();
  });
});
