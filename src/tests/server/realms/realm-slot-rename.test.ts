/** @jest-environment node */
/**
 * Renaming a generated nation slot's region in the Properties inspector renames the slot's nation with it, in the
 * same transaction: a slot IS its country. Only a slot nobody holds follows its region; a player's nation, and any
 * country the world generator did not make, keeps its own name. A name another nation of the realm carries is a
 * CONFLICT and nothing changes.
 */
// `jest` is the injected global on purpose: @swc/jest only hoists jest.mock() on the global.
jest.mock("~/env", () => ({ env: { DATABASE_URL: "file:./test.db", NODE_ENV: "test" } }));
jest.mock("~/server/db", () => ({ db: {} }));
jest.mock("~/server/shared/map-invalidation", () => ({
  ...jest.requireActual("~/server/shared/map-invalidation"),
  invalidateRealmMap: jest.fn().mockResolvedValue(1),
}));
jest.mock("~/lib/cache", () => ({
  ...jest.requireActual("~/lib/cache"),
  invalidateCache: jest.fn().mockResolvedValue(undefined),
}));

import { Prisma } from "@prisma/client";
import { createCallerFactory } from "~/server/api/trpc";
import { geoEditorLinkageAssignmentRouter } from "~/server/api/routers/geo/editor/linkage/assignment";
import { invalidateCache } from "~/lib/cache";
import { invalidateRealmMap } from "~/server/shared/map-invalidation";
import { clearTrpcMemoryCache } from "~/lib/cache/trpc-cache";
import { createMockRouterContext } from "~/tests/helpers/router-context";

const EURTH = "r_eurth";
const FOUNDER = "clerk_founder";
const MAP_OFFICER = "clerk_mapper";
const ADMIN = "clerk_admin";

type ModelMock = Record<string, jest.Mock>;
type Db = Record<string, ModelMock> & { $queryRaw: jest.Mock };

const REALM = { id: EURTH, slug: "eurth", ownerId: FOUNDER, status: "active" };
const OFFICERS = [{ userId: MAP_OFFICER, powers: ["map"] }];

const FEATURE = { id: "ml1", featureId: "slot_27", countryId: "c_slot", displayName: "Algir" };
const SLOT: {
  id: string;
  name: string;
  realmId: string;
  worldgen: boolean;
  ownerUserId: string | null;
  realm: { slug: string };
} = {
  id: "c_slot",
  name: "Algir",
  realmId: EURTH,
  worldgen: true,
  ownerUserId: null,
  realm: { slug: "eurth" },
};

function modelMock(): ModelMock {
  return {
    findMany: jest.fn().mockResolvedValue([]),
    findFirst: jest.fn().mockResolvedValue(null),
    findUnique: jest.fn().mockResolvedValue(null),
    update: jest.fn().mockResolvedValue({}),
    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
  };
}

/** Every model answers empty; `$transaction(fn)` runs fn against the same db; the feature is the slot's region. */
function slotDb(country: Partial<typeof SLOT> | null = {}): Db {
  const models = new Map<string, ModelMock>();
  const queryRaw = jest.fn().mockResolvedValue([{ id: SLOT.id }]);
  const db = new Proxy({} as Db, {
    get: (_t, name) => {
      const key = String(name);
      if (key === "$transaction") return (fn: (tx: Db) => unknown) => fn(db);
      if (key === "$queryRaw") return queryRaw;
      if (!models.has(key)) models.set(key, modelMock());
      return models.get(key);
    },
  });
  db.realm!.findUnique!.mockResolvedValue({ ...REALM, officers: OFFICERS });
  db.mapLayer!.findFirst!.mockResolvedValue(FEATURE);
  // By id: the slot (the lookup behind the rename); by slug: free (the slug search)
  db.country!.findUnique!.mockImplementation(async ({ where }: { where: { id?: string } }) =>
    where.id && country ? { ...SLOT, ...country } : null
  );
  return db;
}

function save(db: Db, who: string, input: { displayName?: string; countryId?: string } = {}) {
  const ctx = createMockRouterContext({
    db,
    auth: { userId: who },
    user: {
      id: `db_${who}`,
      clerkUserId: who,
      role: who === ADMIN ? { name: "admin", level: 10 } : { name: "member", level: 100 },
      country: null,
    },
    rateLimitIdentifier: `${who}_${Math.random()}`,
  }) as never;
  return createCallerFactory(geoEditorLinkageAssignmentRouter)(ctx).updateFeatureProperties({
    featureId: "slot_27",
    displayName: "Algir Renamed",
    realm: "eurth",
    ...input,
  });
}

const uniqueViolation = (target: string[]) =>
  new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "test",
    meta: { target },
  });

const finalCountryWrite = (db: Db) => db.country!.update!.mock.calls.at(-1)?.[0];

beforeEach(() => {
  jest.clearAllMocks();
  clearTrpcMemoryCache();
});

describe("renaming a generated slot's region", () => {
  it("renames the unowned slot's nation and regenerates its slug", async () => {
    const db = slotDb();
    await save(db, MAP_OFFICER);
    expect(finalCountryWrite(db)).toEqual({
      where: { id: "c_slot" },
      data: { name: "Algir Renamed", slug: "algir-renamed" },
    });
    expect(db.mapLayer!.update!.mock.calls[0][0].data).toEqual({ displayName: "Algir Renamed" });
  });

  it("renames the nation before the region, and locks the slot first", async () => {
    const db = slotDb();
    await save(db, MAP_OFFICER);
    const [rename] = db.country!.update!.mock.invocationCallOrder;
    expect(rename).toBeLessThan(db.mapLayer!.update!.mock.invocationCallOrder[0]!);
    expect(db.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(rename!);
    expect(String(db.$queryRaw.mock.calls[0]![0])).toContain("FOR UPDATE");
  });

  it("is the same for the realm's founder and a site admin, whose own rename does not write it twice", async () => {
    for (const who of [FOUNDER, ADMIN]) {
      const db = slotDb();
      await save(db, who);
      expect(finalCountryWrite(db).data).toEqual({ name: "Algir Renamed", slug: "algir-renamed" });
      const withName = db.country!.update!.mock.calls.filter(([a]) => "name" in a.data);
      expect(withName).toHaveLength(1);
    }
  });

  it("trims the name", async () => {
    const db = slotDb();
    await save(db, MAP_OFFICER, { displayName: "  Algir Renamed  " });
    expect(finalCountryWrite(db).data).toEqual({ name: "Algir Renamed", slug: "algir-renamed" });
  });

  it("takes the next free slug when the new name's is taken, after letting go of its own", async () => {
    const db = slotDb();
    const taken = new Set(["algir-renamed"]);
    db.country!.findUnique!.mockImplementation(
      async ({ where }: { where: { id?: string; slug?: string } }) => {
        if (where.id) return SLOT;
        return where.slug && taken.has(where.slug) ? { id: "other" } : null;
      }
    );
    await save(db, MAP_OFFICER);
    expect(finalCountryWrite(db).data.slug).toBe("algir-renamed-eurth");
    // The slot lets go of its own slug first, so it never counts as taking the new one
    expect(db.country!.update!.mock.calls[0]![0]).toEqual({
      where: { id: "c_slot" },
      data: { slug: null },
    });
  });

  it("drops the cached nation reads and moves the map version", async () => {
    const db = slotDb();
    await save(db, MAP_OFFICER);
    expect(invalidateCache).toHaveBeenCalledWith(["countries."]);
    expect(invalidateRealmMap).toHaveBeenCalledWith(db, EURTH);
  });

  it("leaves the nation alone when the region keeps its name", async () => {
    const db = slotDb();
    await save(db, MAP_OFFICER, { displayName: "Algir" });
    expect(db.country!.update).not.toHaveBeenCalled();
    expect(invalidateCache).not.toHaveBeenCalled();
  });

  it("keeps the slug when the nation already carries the new name", async () => {
    const db = slotDb({ name: "Algir Renamed" });
    await save(db, MAP_OFFICER);
    expect(db.country!.update).not.toHaveBeenCalled();
    expect(db.mapLayer!.update).toHaveBeenCalledTimes(1);
  });
});

describe("a name another nation of the realm carries", () => {
  it("is a CONFLICT, and nothing changes", async () => {
    const db = slotDb();
    db.country!.findFirst!.mockResolvedValue({ id: "c_other" });
    await expect(save(db, MAP_OFFICER)).rejects.toMatchObject({
      code: "CONFLICT",
      message: "Another nation of this realm is already called Algir Renamed",
    });
    expect(db.country!.update).not.toHaveBeenCalled();
    expect(db.mapLayer!.update).not.toHaveBeenCalled();
    expect(invalidateCache).not.toHaveBeenCalled();
  });

  it("is looked up in the slot's realm, other nations only", async () => {
    const db = slotDb();
    await save(db, MAP_OFFICER);
    expect(db.country!.findFirst!.mock.calls[0]![0].where).toEqual({
      realmId: EURTH,
      name: "Algir Renamed",
      NOT: { id: "c_slot" },
    });
  });

  it("is also a CONFLICT when a concurrent save takes the name first, before the region is touched", async () => {
    const db = slotDb();
    db.country!.update!.mockResolvedValueOnce({}).mockRejectedValue(
      uniqueViolation(["realmId", "name"])
    );
    await expect(save(db, MAP_OFFICER)).rejects.toMatchObject({
      code: "CONFLICT",
      message: "Another nation of this realm is already called Algir Renamed",
    });
    expect(db.mapLayer!.update).not.toHaveBeenCalled();
  });

  it("asks for a retry when a concurrent save takes the new slug", async () => {
    const db = slotDb();
    db.country!.update!.mockResolvedValueOnce({}).mockRejectedValue(uniqueViolation(["slug"]));
    await expect(save(db, MAP_OFFICER)).rejects.toMatchObject({
      code: "CONFLICT",
      message: expect.stringContaining("try again"),
    });
    expect(db.mapLayer!.update).not.toHaveBeenCalled();
  });

  it("refuses an empty name for the nation", async () => {
    const db = slotDb();
    await expect(save(db, MAP_OFFICER, { displayName: "   " })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(db.country!.update).not.toHaveBeenCalled();
    expect(db.mapLayer!.update).not.toHaveBeenCalled();
  });

  it("lets any other failure through untouched", async () => {
    const db = slotDb();
    db.country!.update!.mockResolvedValueOnce({}).mockRejectedValue(new Error("connection lost"));
    await expect(save(db, MAP_OFFICER)).rejects.toThrow("connection lost");
    expect(db.mapLayer!.update).not.toHaveBeenCalled();
  });
});

describe("a country that is not an unowned generated slot", () => {
  it("keeps its name when a player holds it, and the region is still renamed", async () => {
    const db = slotDb({ ownerUserId: "user_1" });
    await save(db, MAP_OFFICER);
    expect(db.country!.update).not.toHaveBeenCalled();
    expect(db.mapLayer!.update!.mock.calls[0][0].data).toEqual({ displayName: "Algir Renamed" });
  });

  it("keeps its name when the world generator did not make it", async () => {
    const db = slotDb({ worldgen: false });
    await save(db, MAP_OFFICER);
    expect(db.country!.update).not.toHaveBeenCalled();
    expect(db.mapLayer!.update).toHaveBeenCalledTimes(1);
  });

  it("keeps its name when it belongs to another realm", async () => {
    const db = slotDb({ realmId: "r_other" });
    await save(db, MAP_OFFICER);
    expect(db.country!.update).not.toHaveBeenCalled();
  });

  it("keeps its name when the region has no nation", async () => {
    const db = slotDb();
    db.mapLayer!.findFirst!.mockResolvedValue({ ...FEATURE, countryId: null });
    await save(db, MAP_OFFICER);
    expect(db.country!.update).not.toHaveBeenCalled();
    expect(db.mapLayer!.update).toHaveBeenCalledTimes(1);
  });

  it("is renamed by a site admin as it always was, held by a player or not", async () => {
    for (const country of [{ ownerUserId: "user_1" }, { worldgen: false }]) {
      const db = slotDb(country);
      await save(db, ADMIN);
      expect(finalCountryWrite(db)).toEqual({
        where: { id: "c_slot" },
        data: { name: "Algir Renamed", slug: "algir-renamed" },
      });
    }
  });
});
