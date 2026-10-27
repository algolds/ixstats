/** @jest-environment node */
/**
 * The World tab's server side: whether a realm's world is locked by claims, and the two slot tools of the
 * Properties inspector (Claimable, Delete slot). Every procedure is for the realm's map editors only, never
 * Ixnay, never an archived realm; a slot with a player or a claim row is never deleted.
 */
// `jest` is the injected global on purpose: @swc/jest only hoists jest.mock() on the global.
jest.mock("~/env", () => ({
  env: { DATABASE_URL: "file:./test.db", NODE_ENV: "test", CRON_ENABLED_JOBS: "" },
}));
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
import { geoEditorLinkageAssignmentRouter } from "~/server/api/routers/geo/editor/linkage/assignment";
import { invalidateCache } from "~/lib/cache";
import { clearTrpcMemoryCache } from "~/lib/cache/trpc-cache";
import { atlasStudioRouter } from "~/server/api/routers/atlas/studio";
import { admin, fakeDb } from "~/tests/server/maps/map-import-fakes";

const EURTH = "r_eurth";
const OTHER = "r_other";
const FOUNDER = "clerk_founder";
const MAP_OFFICER = "clerk_mapper";
const BOARD_OFFICER = "clerk_board";
const CLAIMS_OFFICER = "clerk_claims";
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
/**
 * atlas.studio.createRealm and applyStatus: a draft, unlisted realm owned by the admin who made it, and the
 * world status Ixnay's layer choice reads (the founder's worldStatus refuses Ixnay).
 */
describe("the Atlas studio's realms", () => {
  function caller(user: typeof admin, create = jest.fn()) {
    const createMany = jest.fn().mockResolvedValue({ count: 4 });
    const threadCreateMany = jest.fn().mockResolvedValue({ count: 1 });
    const db = Object.assign(fakeDb(), {
      $transaction: jest.fn(async (fn: (tx: object) => Promise<object>) =>
        fn({
          realm: { create },
          forumCategory: {
            createMany,
            findFirst: jest.fn().mockResolvedValue({ id: "cat_board" }),
          },
          forumThread: { createMany: threadCreateMany },
        })
      ),
    });
    const api = createCallerFactory(atlasStudioRouter)(
      createMockRouterContext({
        db,
        auth: { userId: user.clerkUserId },
        user: { ...user, country: null },
      }) as never
    );
    return { api, db, create, createMany };
  }
  describe("atlas.studio.createRealm", () => {
    const made = { id: "r_new", slug: "new-world", name: "New world" };

    it("creates a draft, unlisted realm owned by the calling admin, and seeds its forum categories", async () => {
      const { api, create, createMany } = caller(admin, jest.fn().mockResolvedValue(made));
      await expect(
        api.createRealm({
          name: " New world ",
          slug: "new-world",
          clock: { startDate: "0812-01-01", era: "AE", multiplier: 3 },
        })
      ).resolves.toEqual({
        realmId: "r_new",
        slug: "new-world",
      });
      expect(create).toHaveBeenCalledWith({
        data: {
          name: "New world",
          slug: "new-world",
          ownerId: admin.clerkUserId,
          visibility: "unlisted",
          status: "draft",
          settings: {
            clock: expect.objectContaining({ multiplier: 3, era: "AE" }),
          },
        },
      });
      expect(createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([expect.objectContaining({ realmId: "r_new", key: "hub" })]),
        })
      );
    });
  });
  describe("atlas.studio.applyStatus", () => {
    const withRealm = (user: typeof admin, row: Record<string, unknown>) => {
      const ctx = caller(user);
      ctx.db.realm.rows.push({ settings: {}, ...row });
      return ctx;
    };

    it("answers for Ixnay, which the founder's worldStatus refuses, and is never locked by its claims", async () => {
      const { api, db } = withRealm(admin, { id: "default", slug: "ixnay", status: "active" });
      db.realmClaim.rows.push(
        { id: "q1", realmId: "default", status: "pending" },
        { id: "q2", realmId: "default", status: "approved" }
      );
      await expect(api.applyStatus({ realm: "ixnay" })).resolves.toEqual({
        realmId: "default",
        status: "active",
        pendingClaims: 1,
        approvedClaims: 1,
        locked: false,
        lockReason: null,
        canReviewClaims: true,
        reliefFailed: false,
      });
    });

    it("locks another realm on claims unless the apply is a layer choice, and always on an archived one", async () => {
      const { api, db } = withRealm(admin, { id: "r1", slug: "eurth", status: "active" });
      db.realmClaim.rows.push({ id: "q1", realmId: "r1", status: "approved" });
      expect(await api.applyStatus({ realm: "eurth" })).toMatchObject({
        locked: true,
        lockReason: "claims",
      });
      expect(await api.applyStatus({ realm: "r1", layers: true })).toMatchObject({
        locked: false,
        approvedClaims: 1,
      });
      db.realm.rows[0].status = "archived";
      expect(await api.applyStatus({ realm: "r1", layers: true })).toMatchObject({
        locked: true,
        lockReason: "archived",
      });
    });
  });
});
