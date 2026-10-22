/** @jest-environment node */
/**
 * The World tab's server side: whether a realm's world is locked by claims, and the two slot tools of the
 * Properties inspector (Claimable, Delete slot). Every procedure is for the realm's map editors only, never
 * Ixnay, never an archived realm; a slot with a player or a claim row is never deleted.
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

jest.mock("~/lib/auth", () => ({ isSystemOwner: () => false }));

import { createCallerFactory } from "~/server/api/trpc";
import { realmMapRouter } from "~/server/api/routers/realms/map";
import { DEFAULT_REALM_ID } from "~/server/modules/realms";
import { invalidateRealmMap } from "~/server/shared/map-invalidation";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { Prisma } from "@prisma/client";
import { geoEditorLinkageAssignmentRouter } from "~/server/api/routers/geo/editor/linkage/assignment";
import { invalidateCache } from "~/lib/cache";
import { clearTrpcMemoryCache } from "~/lib/cache/trpc-cache";
import { listBuilderRealms } from "~/server/modules/realms";

const EURTH = "r_eurth";
const OTHER = "r_other";
const FOUNDER = "clerk_founder";
const MAP_OFFICER = "clerk_mapper";
const BOARD_OFFICER = "clerk_board";
const CLAIMS_OFFICER = "clerk_claims";
const PLAYER = "clerk_player";
const ADMIN = "clerk_admin";

type ModelMock = Record<string, jest.Mock>;
type Db = Record<string, ModelMock> & { $queryRaw: jest.Mock };

const REALMS: Record<string, { id: string; slug: string; ownerId: string; status: string }> = {
  eurth: { id: EURTH, slug: "eurth", ownerId: FOUNDER, status: "active" },
  other: { id: OTHER, slug: "other", ownerId: "clerk_someone_else", status: "active" },
  ixnay: { id: DEFAULT_REALM_ID, slug: "ixnay", ownerId: "system", status: "active" },
};
const OFFICERS: Record<string, Array<{ userId: string; powers: string[] }>> = {
  [EURTH]: [
    { userId: MAP_OFFICER, powers: ["map"] },
    { userId: BOARD_OFFICER, powers: ["board"] },
    { userId: CLAIMS_OFFICER, powers: ["map", "claims"] },
  ],
  [OTHER]: [],
  [DEFAULT_REALM_ID]: [],
};

const SLOT = { id: "c_slot", realmId: EURTH, worldgen: true, claimable: true, ownerUserId: null };

function modelMock(): ModelMock {
  return {
    findMany: jest.fn().mockResolvedValue([]),
    findFirst: jest.fn().mockResolvedValue(null),
    findUnique: jest.fn().mockResolvedValue(null),
    count: jest.fn().mockResolvedValue(0),
    update: jest.fn().mockResolvedValue({}),
    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    delete: jest.fn().mockResolvedValue({}),
  };
}

function realmDb(status: Record<string, string> = {}): Db {
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
  db.realm!.findUnique!.mockImplementation(
    async ({ where }: { where: { slug?: string; id?: string } }) => {
      const realm = where.slug
        ? REALMS[where.slug]
        : Object.values(REALMS).find((r) => r.id === where.id);
      if (!realm) return null;
      return { ...realm, status: status[realm.id] ?? realm.status, officers: OFFICERS[realm.id] };
    }
  );
  db.country!.findUnique!.mockResolvedValue(SLOT);
  return db;
}

function caller(db: Db, clerkUserId: string | null) {
  const ctx = createMockRouterContext({
    db,
    auth: clerkUserId ? { userId: clerkUserId } : null,
    user: clerkUserId
      ? {
          id: `db_${clerkUserId}`,
          clerkUserId,
          role:
            clerkUserId === ADMIN ? { name: "admin", level: 10 } : { name: "member", level: 100 },
          country: null,
        }
      : null,
    rateLimitIdentifier: `${clerkUserId}_${Math.random()}`,
  }) as never;
  return createCallerFactory(realmMapRouter)(ctx);
}

beforeEach(() => jest.clearAllMocks());
afterEach(() => jest.restoreAllMocks());

describe("realms.map.worldStatus", () => {
  const claimCounts = (db: Db, pending: number, approved: number) =>
    db.realmClaim!.count!.mockImplementation(
      async ({ where }: { where: { status: string } }) =>
        ({ pending, approved })[where.status as "pending" | "approved"] ?? 0
    );

  it("counts the pending and approved claims and locks the world while there are any", async () => {
    const db = realmDb();
    claimCounts(db, 2, 1);
    await expect(caller(db, FOUNDER).worldStatus({ realm: "eurth" })).resolves.toEqual({
      realmId: EURTH,
      status: "active",
      pendingClaims: 2,
      approvedClaims: 1,
      locked: true,
      lockReason: "claims",
      canReviewClaims: true,
      reliefFailed: false,
    });
    const where = db.realmClaim!.count!.mock.calls.map(([arg]) => arg.where);
    expect(where).toEqual(
      expect.arrayContaining([
        { realmId: EURTH, status: "pending" },
        { realmId: EURTH, status: "approved" },
      ])
    );
  });
  it("locks an archived realm, for a site admin too, whatever its claims", async () => {
    const db = realmDb({ [EURTH]: "archived" });
    claimCounts(db, 0, 0);
    await expect(caller(db, ADMIN).worldStatus({ realm: "eurth" })).resolves.toMatchObject({
      status: "archived",
      locked: true,
      lockReason: "archived",
    });
  });
});

describe("realms.map.worldSlot", () => {
  it("says nothing of a country in another realm", async () => {
    const db = realmDb();
    db.country!.findUnique!.mockResolvedValue({ ...SLOT, realmId: OTHER });
    await expect(
      caller(db, FOUNDER).worldSlot({ realm: "eurth", countryId: SLOT.id })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("realms.map.setSlotClaimable", () => {
  const input = { realm: "eurth", countryId: SLOT.id, claimable: false };

  it("writes Country.claimable for an unowned generated slot, in one conditional write", async () => {
    const db = realmDb();
    await expect(caller(db, FOUNDER).setSlotClaimable(input)).resolves.toEqual({
      claimable: false,
    });
    expect(db.country!.updateMany).toHaveBeenCalledWith({
      where: { id: SLOT.id, realmId: EURTH, worldgen: true, ownerUserId: null },
      data: { claimable: false },
    });
    expect(db.country!.update).not.toHaveBeenCalled();
  });
  it("refuses to reserve a slot a player holds: it is no scenery", async () => {
    const db = realmDb();
    db.country!.updateMany!.mockResolvedValue({ count: 0 });
    db.country!.findUnique!.mockResolvedValue({ ...SLOT, ownerUserId: "db_player" });
    await expect(caller(db, FOUNDER).setSlotClaimable(input)).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });

  it("refuses anyone without the map power, Ixnay and archived realms, writing nothing", async () => {
    for (const [who, realm, status] of [
      [PLAYER, "eurth", {}],
      [BOARD_OFFICER, "eurth", {}],
      [FOUNDER, "other", {}],
      [ADMIN, "ixnay", {}],
      [ADMIN, "eurth", { [EURTH]: "archived" }],
      [FOUNDER, "eurth", { [EURTH]: "archived" }],
    ] as const) {
      const db = realmDb(status);
      await expect(caller(db, who).setSlotClaimable({ ...input, realm })).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
      expect(db.country!.updateMany).not.toHaveBeenCalled();
    }
  });
});

describe("realms.map.deleteSlot", () => {
  const input = { realm: "eurth", countryId: SLOT.id };
  it("locks the slot's row before it looks for claims, so a claim filed meanwhile can't be cascaded away", async () => {
    const db = realmDb();
    const order: string[] = [];
    db.$queryRaw.mockImplementation(async (strings: TemplateStringsArray) => {
      order.push(strings.join("?"));
      return [{ id: SLOT.id }];
    });
    db.realmClaim!.count!.mockImplementation(async () => {
      order.push("count claims");
      return 0;
    });
    db.country!.delete!.mockImplementation(async () => {
      order.push("delete");
      return {};
    });
    await caller(db, FOUNDER).deleteSlot(input);
    expect(order[0]).toMatch(/FOR UPDATE/);
    expect(order.slice(1)).toEqual(["count claims", "delete"]);
  });
  it("refuses a slot with a claim row of any status, because the claim would go with it", async () => {
    const db = realmDb();
    db.realmClaim!.count!.mockResolvedValue(1);
    await expect(caller(db, FOUNDER).deleteSlot(input)).rejects.toMatchObject({
      code: "CONFLICT",
    });
    expect(db.country!.delete).not.toHaveBeenCalled();
    expect(invalidateRealmMap).not.toHaveBeenCalled();
  });
});

/**
 * Renaming a generated nation slot's region in the Properties inspector renames the slot's nation with it, in the
 * same transaction: a slot IS its country. Only a slot nobody holds follows its region; a player's nation, and any
 * country the world generator did not make, keeps its own name. A name another nation of the realm carries is a
 * CONFLICT and nothing changes.
 */
// `jest` is the injected global on purpose: @swc/jest only hoists jest.mock() on the global.
describe("renaming a slot", () => {
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
  beforeEach(() => {
    jest.clearAllMocks();
    clearTrpcMemoryCache();
  });
  describe("renaming a generated slot's region", () => {
    it("renames the nation before the region, and locks the slot first", async () => {
      const db = slotDb();
      await save(db, MAP_OFFICER);
      const [rename] = db.country!.update!.mock.invocationCallOrder;
      expect(rename).toBeLessThan(db.mapLayer!.update!.mock.invocationCallOrder[0]!);
      expect(db.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(rename!);
      expect(String(db.$queryRaw.mock.calls[0]![0])).toContain("FOR UPDATE");
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
  });
  describe("a country that is not an unowned generated slot", () => {
    it("keeps its name when a player holds it, and the region is still renamed", async () => {
      const db = slotDb({ ownerUserId: "user_1" });
      await save(db, MAP_OFFICER);
      expect(db.country!.update).not.toHaveBeenCalled();
      expect(db.mapLayer!.update!.mock.calls[0][0].data).toEqual({ displayName: "Algir Renamed" });
    });
  });
});

describe("the builder's realms", () => {
  const user = { id: "u1", clerkUserId: "clerk_u1" };
  function builderDb(opts: {
    membershipTier?: string;
    activeRealmId?: string | null;
    realms: Array<{ id: string; slug: string; name: string; settings: object | null }>;
    owned?: string[];
  }) {
    return {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          membershipTier: opts.membershipTier ?? "basic",
          country: opts.activeRealmId ? { realmId: opts.activeRealmId } : null,
        }),
      },
      realm: {
        findMany: jest.fn().mockResolvedValue(opts.realms),
        findUnique: jest.fn(),
      },
      country: {
        findMany: jest.fn().mockResolvedValue((opts.owned ?? []).map((realmId) => ({ realmId }))),
        count: jest.fn(),
      },
    } as any;
  }
  describe("listBuilderRealms", () => {
    it("offers Ixnay and active, non-system realms that are public, founded by the player, or where they hold a nation", async () => {
      const db = builderDb({ realms: [] });
      await listBuilderRealms(db, user);
      expect(db.realm.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { id: "default" },
            {
              status: "active",
              isSystem: false,
              OR: [
                { visibility: "public" },
                { ownerId: "clerk_u1" },
                { countries: { some: { ownerUserId: "u1" } } },
              ],
            },
          ],
        },
        orderBy: { name: "asc" },
        select: { id: true, slug: true, name: true, settings: true },
      });
    });
  });
});
