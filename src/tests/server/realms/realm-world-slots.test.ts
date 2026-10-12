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

import { createCallerFactory } from "~/server/api/trpc";
import { realmMapRouter } from "~/server/api/routers/realms/map";
import { DEFAULT_REALM_ID } from "~/server/modules/realms";
import { invalidateRealmMap } from "~/server/shared/map-invalidation";
import { createMockRouterContext } from "~/tests/helpers/router-context";

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

  it("says whether the viewer can review the claims that lock it: the founder, the Claims power, site staff", async () => {
    const db = realmDb();
    const reviewer = async (who: string) =>
      (await caller(db, who).worldStatus({ realm: "eurth" })).canReviewClaims;
    expect(await reviewer(FOUNDER)).toBe(true);
    expect(await reviewer(CLAIMS_OFFICER)).toBe(true);
    expect(await reviewer(ADMIN)).toBe(true);
    // The Map power alone edits the map but has no Claims section to open
    expect(await reviewer(MAP_OFFICER)).toBe(false);
  });

  it("is unlocked while the realm has no pending or approved claim", async () => {
    const db = realmDb();
    claimCounts(db, 0, 0);
    await expect(caller(db, MAP_OFFICER).worldStatus({ realm: "eurth" })).resolves.toMatchObject({
      locked: false,
      lockReason: null,
    });
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

  it("says the relief step of the latest world import failed, so the tab can offer to rebuild it", async () => {
    const db = realmDb();
    db.mapImportJob!.findMany!.mockResolvedValue([
      { id: "j_apply", result: { phase: "world-apply", relief: { status: "failed" } } },
    ]);
    await expect(caller(db, FOUNDER).worldStatus({ realm: "eurth" })).resolves.toMatchObject({
      reliefFailed: true,
    });
    expect(db.mapImportJob!.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { realmId: EURTH, kind: "world", dryRun: false, status: "succeeded" },
      })
    );
  });

  it("does not say it once the relief was built", async () => {
    const db = realmDb();
    db.mapImportJob!.findMany!.mockResolvedValue([
      { id: "j_apply", result: { phase: "world-apply", relief: { status: "built" } } },
    ]);
    await expect(caller(db, FOUNDER).worldStatus({ realm: "eurth" })).resolves.toMatchObject({
      reliefFailed: false,
    });
  });

  it("does not look at the realm's imports for someone who may not see its world", async () => {
    const db = realmDb();
    await expect(caller(db, PLAYER).worldStatus({ realm: "eurth" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(db.mapImportJob!.findMany).not.toHaveBeenCalled();
  });

  it("is for the realm's map editors only", async () => {
    const db = realmDb();
    await expect(caller(db, PLAYER).worldStatus({ realm: "eurth" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(caller(db, BOARD_OFFICER).worldStatus({ realm: "eurth" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(caller(db, FOUNDER).worldStatus({ realm: "other" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    jest.spyOn(console, "warn").mockImplementation(() => {});
    await expect(caller(db, null).worldStatus({ realm: "eurth" })).rejects.toThrow(
      /Authentication required/
    );
    expect(db.realmClaim!.count).not.toHaveBeenCalled();
  });

  it("is refused for Ixnay, even to a site admin, and for a realm that does not exist", async () => {
    const db = realmDb();
    await expect(caller(db, ADMIN).worldStatus({ realm: "ixnay" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(caller(db, ADMIN).worldStatus({ realm: "nowhere" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

describe("realms.map.worldSlot", () => {
  it("reports whether the country is a generated slot, claimable, owned or claimed", async () => {
    const db = realmDb();
    db.realmClaim!.count!.mockResolvedValue(3);
    await expect(
      caller(db, FOUNDER).worldSlot({ realm: "eurth", countryId: SLOT.id })
    ).resolves.toEqual({ worldgen: true, claimable: true, owned: false, claims: 3 });
  });

  it("says nothing of a country in another realm", async () => {
    const db = realmDb();
    db.country!.findUnique!.mockResolvedValue({ ...SLOT, realmId: OTHER });
    await expect(
      caller(db, FOUNDER).worldSlot({ realm: "eurth", countryId: SLOT.id })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("is for the realm's map editors only", async () => {
    await expect(
      caller(realmDb(), PLAYER).worldSlot({ realm: "eurth", countryId: SLOT.id })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
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

  it("lets an officer with the map power do the same", async () => {
    const db = realmDb();
    await caller(db, MAP_OFFICER).setSlotClaimable(input);
    expect(db.country!.updateMany).toHaveBeenCalled();
  });

  it("makes a slot claimable again whoever holds it", async () => {
    const db = realmDb();
    await caller(db, FOUNDER).setSlotClaimable({ ...input, claimable: true });
    expect(db.country!.updateMany).toHaveBeenCalledWith({
      where: { id: SLOT.id, realmId: EURTH, worldgen: true },
      data: { claimable: true },
    });
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

  it("leaves a country that is not a generated slot alone", async () => {
    const db = realmDb();
    db.country!.updateMany!.mockResolvedValue({ count: 0 });
    db.country!.findUnique!.mockResolvedValue({ ...SLOT, worldgen: false });
    await expect(caller(db, FOUNDER).setSlotClaimable(input)).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  it("leaves a country of another realm alone", async () => {
    const db = realmDb();
    db.country!.updateMany!.mockResolvedValue({ count: 0 });
    db.country!.findUnique!.mockResolvedValue({ ...SLOT, realmId: OTHER });
    await expect(caller(db, FOUNDER).setSlotClaimable(input)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("answers not found, not an internal error, when the slot is deleted under the write", async () => {
    const db = realmDb();
    db.country!.updateMany!.mockResolvedValue({ count: 0 });
    db.country!.findUnique!.mockResolvedValue(null);
    await expect(caller(db, FOUNDER).setSlotClaimable(input)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

describe("realms.map.deleteSlot", () => {
  const input = { realm: "eurth", countryId: SLOT.id };

  it("deletes an unowned slot with no claim row and bumps the realm's map version", async () => {
    const db = realmDb();
    await expect(caller(db, FOUNDER).deleteSlot(input)).resolves.toEqual({ deleted: true });
    expect(db.country!.delete).toHaveBeenCalledWith({ where: { id: SLOT.id } });
    expect(invalidateRealmMap).toHaveBeenCalledWith(expect.anything(), EURTH);
    expect(db.realmClaim!.count).toHaveBeenCalledWith({ where: { countryId: SLOT.id } });
  });

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

  it("refuses a slot a player owns", async () => {
    const db = realmDb();
    db.country!.findUnique!.mockResolvedValue({ ...SLOT, ownerUserId: "db_player" });
    await expect(caller(db, FOUNDER).deleteSlot(input)).rejects.toMatchObject({
      code: "CONFLICT",
    });
    expect(db.country!.delete).not.toHaveBeenCalled();
    expect(invalidateRealmMap).not.toHaveBeenCalled();
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

  it("refuses a country that is not a generated slot or belongs to another realm", async () => {
    const hand = realmDb();
    hand.country!.findUnique!.mockResolvedValue({ ...SLOT, worldgen: false });
    await expect(caller(hand, FOUNDER).deleteSlot(input)).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    const foreign = realmDb();
    foreign.country!.findUnique!.mockResolvedValue({ ...SLOT, realmId: OTHER });
    await expect(caller(foreign, FOUNDER).deleteSlot(input)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(hand.country!.delete).not.toHaveBeenCalled();
    expect(foreign.country!.delete).not.toHaveBeenCalled();
  });

  it("refuses anyone without the map power, Ixnay and archived realms, deleting nothing", async () => {
    for (const [who, realm, status] of [
      [PLAYER, "eurth", {}],
      [BOARD_OFFICER, "eurth", {}],
      [FOUNDER, "other", {}],
      [ADMIN, "ixnay", {}],
      [ADMIN, "eurth", { [EURTH]: "archived" }],
    ] as const) {
      const db = realmDb(status);
      await expect(caller(db, who).deleteSlot({ ...input, realm })).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
      expect(db.country!.delete).not.toHaveBeenCalled();
    }
    expect(invalidateRealmMap).not.toHaveBeenCalled();
  });
});
