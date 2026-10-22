/** @jest-environment node */
/**
 * Handing a realm over (realms.transfer.ts): site admins transfer any realm from /admin/realms, a founder hands
 * their own realm to a nation owner or officer of it. Both need the realm's slug typed, write an admin audit
 * row with the previous owner, and may keep the previous founder on as an officer.
 */
jest.mock("~/server/db", () => ({ db: {} }));
jest.mock("~/server/modules/realms/realms.notices", () => ({
  notifyClaimRejected: jest.fn().mockResolvedValue(undefined),
  notifyRealmFounderChanged: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("~/server/shared/map-invalidation", () => ({
  ...jest.requireActual("~/server/shared/map-invalidation"),
  invalidateRealmMap: jest.fn().mockResolvedValue(1),
}));

jest.mock("~/lib/auth", () => ({ isSystemOwner: (id: string) => id === "sys_owner" }));
jest.mock("~/server/modules/realms", () => {
  const actual = jest.requireActual("~/server/modules/realms");
  return { ...actual, assignNation: jest.fn(actual.assignNation) };
});
jest.mock("~/lib/cache", () => ({
  ...jest.requireActual("~/lib/cache"), // the tRPC context needs the real Cache class
  globalCache: {
    delete: jest.fn().mockResolvedValue(undefined),
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
  },
  invalidateCache: jest.fn().mockResolvedValue(undefined),
}));

import { realmsRouter } from "~/server/api/routers/realms";
import { invalidateRealmMap } from "~/server/shared/map-invalidation";
import { notifyRealmFounderChanged } from "~/server/modules/realms/realms.notices";
import { REALM_OWNER_TRANSFER_ACTION } from "~/server/modules/realms/realms.transfer";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createMockPrisma } from "~/tests/helpers/mock-db";
import { adminAssignNation } from "~/server/modules/realms";
import { usersProfileRouter } from "~/server/api/routers/users/profile";
import { usersCountryLinkingRouter } from "~/server/api/routers/users/country-linking";
import { globalCache } from "~/lib/cache";
import { assignClaimedNation } from "~/server/modules/realms/realms.ownership";
import {
  assignNation,
  canModerateRealm,
  NationOwnershipError,
  releaseNation,
} from "~/server/modules/realms";

type Db = ReturnType<typeof createMockPrisma>;

const FOUNDER = "clerk_founder";
const OFFICER = "clerk_officer";
const PLAYER = "clerk_player";
const ADMIN = "clerk_admin";
const admin = { name: "admin", level: 10 };
const notify = notifyRealmFounderChanged as jest.Mock;

function realmRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "eurth",
    slug: "eurth",
    name: "Eurth",
    ownerId: FOUNDER,
    status: "active",
    officers: [{ userId: OFFICER, powers: ["diplomacy"] }],
    ...overrides,
  };
}

/** A mock Prisma holding one realm and active accounts for everyone but `inactive`. */
function makeDb(realm = realmRow(), { inactive = [] as string[] } = {}): Db {
  // $executeRaw: the forum's member lock that the new founder's board-power check takes (M9).
  const db = createMockPrisma({ $executeRaw: jest.fn(async () => 0) });
  db.$transaction.mockImplementation((cb: (tx: Db) => unknown) => cb(db));
  db.realm.findUnique.mockImplementation(async ({ where }: any) =>
    where.slug === realm.slug || where.id === realm.id ? realm : null
  );
  db.user.findUnique.mockImplementation(async ({ where }: any) =>
    [FOUNDER, OFFICER, PLAYER, ADMIN].includes(where.clerkUserId)
      ? { isActive: !inactive.includes(where.clerkUserId) }
      : null
  );
  return db;
}

function callerAs(
  clerkUserId: string,
  db: Db,
  role: { name: string; level: number } | null = null
) {
  return realmsRouter.createCaller(
    createMockRouterContext({
      db,
      auth: { userId: clerkUserId },
      user: { id: `db_${clerkUserId}`, clerkUserId, role },
      rateLimitIdentifier: `${clerkUserId}_${Math.random()}`,
    }) as never
  );
}

const auditChanges = (db: Db) => JSON.parse(db.adminAuditLog.create.mock.calls[0][0].data.changes);

beforeEach(() => {
  notify.mockClear();
  jest.mocked(invalidateRealmMap).mockClear();
});

describe("site admins transfer a realm", () => {
  const transfer = (overrides: Record<string, unknown> = {}) => ({
    realmId: "eurth",
    newOwnerId: PLAYER as string | null,
    confirmSlug: "eurth",
    keepPreviousAsOfficer: false,
    ...overrides,
  });
  it("needs the realm's slug typed, checked on the server", async () => {
    const db = makeDb();
    await expect(
      callerAs(ADMIN, db, admin).region.adminTransferOwner(transfer({ confirmSlug: "Eurth" }))
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      callerAs(ADMIN, db, admin).region.adminTransferOwner(transfer({ confirmSlug: "" }))
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(db.realm.update).not.toHaveBeenCalled();
  });

  it("only hands a realm to an existing, active account", async () => {
    const db = makeDb(realmRow(), { inactive: [PLAYER] });
    await expect(
      callerAs(ADMIN, db, admin).region.adminTransferOwner(transfer({ newOwnerId: "clerk_ghost" }))
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      callerAs(ADMIN, db, admin).region.adminTransferOwner(transfer())
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(db.realm.update).not.toHaveBeenCalled();
  });
  it("sets the new founder, records the previous one in the audit log and tells both", async () => {
    const db = makeDb();
    await expect(
      callerAs(ADMIN, db, admin).region.adminTransferOwner(transfer())
    ).resolves.toMatchObject({
      previousOwnerId: FOUNDER,
      newOwnerId: PLAYER,
      keptPreviousAsOfficer: false,
    });
    expect(db.realm.update).toHaveBeenCalledWith({
      where: { id: "eurth" },
      data: { ownerId: PLAYER },
    });
    expect(db.realmOfficer.deleteMany).toHaveBeenCalledWith({
      where: { realmId: "eurth", userId: PLAYER },
    });
    // The previous founder keeps no post: they lose the founder's powers.
    expect(db.realmOfficer.upsert).not.toHaveBeenCalled();
    expect(db.adminAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: REALM_OWNER_TRANSFER_ACTION,
        targetType: "realm",
        targetId: "eurth",
        targetName: "Eurth",
        adminId: `db_${ADMIN}`,
        adminName: ADMIN,
      }),
    });
    expect(auditChanges(db)).toEqual({
      previousOwnerId: FOUNDER,
      newOwnerId: PLAYER,
      keptPreviousAsOfficer: false,
      via: "admin",
    });
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({ clerkUserId: PLAYER, role: "new", realmSlug: "eurth" })
    );
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({ clerkUserId: FOUNDER, role: "previous", keptAsOfficer: false })
    );
  });

  it("drops the realm's remembered tile access, after the handover commits, so the old founder loses private tiles at once", async () => {
    const db = makeDb();
    await callerAs(ADMIN, db, admin).region.adminTransferOwner(transfer());
    expect(invalidateRealmMap).toHaveBeenCalledTimes(1);
    expect(invalidateRealmMap).toHaveBeenCalledWith(db, "eurth");
    const [update] = db.realm.update.mock.invocationCallOrder;
    const [invalidated] = jest.mocked(invalidateRealmMap).mock.invocationCallOrder;
    expect(update).toBeLessThan(invalidated!);
  });
  it("keeps Ixnay with staff", async () => {
    const db = makeDb(realmRow({ id: "default", slug: "ixnay", ownerId: "system" }));
    await expect(
      callerAs(ADMIN, db, admin).region.adminTransferOwner(
        transfer({ realmId: "default", confirmSlug: "ixnay" })
      )
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(db.realm.update).not.toHaveBeenCalled();
  });
});

describe("the new founder and forum bans (M9)", () => {
  const BANNED = {
    code: "BAD_REQUEST",
    message:
      "They have an active forum ban here or sitewide. Lift it before giving them moderator powers.",
  };
  /** Every account here has an IxStats id; the player has a live forum ban in the realm or sitewide. */
  function bannedDb(): Db {
    const db = makeDb();
    db.user.findUnique.mockResolvedValue({ id: "u_player", isActive: true });
    db.forumBan.findFirst.mockResolvedValue({ id: "b1" });
    db.country.findFirst.mockResolvedValue({ id: "c1" });
    return db;
  }

  it("refuses handing the realm to a banned player, by a site admin or the founder", async () => {
    const db = bannedDb();
    await expect(
      callerAs(ADMIN, db, admin).region.adminTransferOwner({
        realmId: "eurth",
        newOwnerId: PLAYER,
        confirmSlug: "eurth",
        keepPreviousAsOfficer: false,
      })
    ).rejects.toMatchObject(BANNED);
    await expect(
      callerAs(FOUNDER, db).region.handOver({
        slug: "eurth",
        newOwnerId: PLAYER,
        confirmSlug: "eurth",
        keepPreviousAsOfficer: false,
      })
    ).rejects.toMatchObject(BANNED);
    expect(db.realm.update).not.toHaveBeenCalled();
  });

  it("checks the new founder's bans inside the handover's transaction, under their lock", async () => {
    const db = bannedDb();
    db.forumBan.findFirst.mockResolvedValue(null);
    await callerAs(FOUNDER, db).region.handOver({
      slug: "eurth",
      newOwnerId: PLAYER,
      confirmSlug: "eurth",
      keepPreviousAsOfficer: false,
    });
    const [, key] = db.$executeRaw.mock.calls[0]!;
    expect(key).toBe("forum-member:u_player");
    expect(db.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(
      db.forumBan.findFirst.mock.invocationCallOrder[0]!
    );
    expect(db.forumBan.findFirst.mock.invocationCallOrder[0]).toBeLessThan(
      db.realm.update.mock.invocationCallOrder[0]!
    );
  });
});

describe("a founder hands their realm over", () => {
  const handOver = (overrides: Record<string, unknown> = {}) => ({
    slug: "eurth",
    newOwnerId: PLAYER,
    confirmSlug: "eurth",
    keepPreviousAsOfficer: false,
    ...overrides,
  });

  it("is for the realm's own founder only, not officers or site admins", async () => {
    const db = makeDb();
    db.country.findFirst.mockResolvedValue({ id: "c1" });
    await expect(callerAs(OFFICER, db).region.handOver(handOver())).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(callerAs(ADMIN, db, admin).region.handOver(handOver())).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(db.realm.update).not.toHaveBeenCalled();
  });
  it("only hands it to a nation owner of the realm or one of its officers", async () => {
    const db = makeDb();
    db.country.findFirst.mockResolvedValue(null);
    await expect(callerAs(FOUNDER, db).region.handOver(handOver())).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(db.country.findFirst).toHaveBeenCalledWith({
      where: { realmId: "eurth", owner: { clerkUserId: PLAYER } },
      select: { id: true },
    });
    expect(db.realm.update).not.toHaveBeenCalled();

    db.country.findFirst.mockResolvedValue({ id: "c1" });
    await callerAs(FOUNDER, db).region.handOver(handOver());
    expect(db.realm.update).toHaveBeenCalledWith({
      where: { id: "eurth" },
      data: { ownerId: PLAYER },
    });
  });
  it("refuses handing it to yourself, a deactivated account, or from an archived realm", async () => {
    const db = makeDb(realmRow(), { inactive: [PLAYER] });
    db.country.findFirst.mockResolvedValue({ id: "c1" });
    await expect(
      callerAs(FOUNDER, db).region.handOver(handOver({ newOwnerId: FOUNDER }))
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(callerAs(FOUNDER, db).region.handOver(handOver())).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    const archived = makeDb(realmRow({ status: "archived" }));
    archived.country.findFirst.mockResolvedValue({ id: "c1" });
    await expect(callerAs(FOUNDER, archived).region.handOver(handOver())).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(db.realm.update).not.toHaveBeenCalled();
    expect(archived.realm.update).not.toHaveBeenCalled();
  });

  it("lists the realm's other nation owners as candidates, for the founder only", async () => {
    const db = makeDb();
    db.country.findMany.mockResolvedValue([
      { name: "Aurelia", owner: { clerkUserId: PLAYER } },
      { name: "Aurelia Minor", owner: { clerkUserId: PLAYER } },
      { name: "Borea", owner: { clerkUserId: OFFICER } },
    ]);
    await expect(
      callerAs(FOUNDER, db).region.handOverCandidates({ slug: "eurth", query: "a" })
    ).resolves.toEqual([
      { userId: PLAYER, nation: "Aurelia" },
      { userId: OFFICER, nation: "Borea" },
    ]);
    expect(db.country.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          realmId: "eurth",
          owner: { clerkUserId: { not: FOUNDER }, isActive: true },
          name: { contains: "a", mode: "insensitive" },
        },
      })
    );
    await expect(
      callerAs(OFFICER, db).region.handOverCandidates({ slug: "eurth", query: "" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("nation ownership writers", () => {
  function db(user: any, country: any) {
    const d: any = {
      $transaction: jest.fn((cb: any) => cb(d)),
      user: {
        upsert: jest.fn().mockResolvedValue(user),
        findUnique: jest.fn().mockResolvedValue({ membershipTier: "basic" }),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      country: {
        findUnique: jest.fn().mockResolvedValue(country),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      realmOfficer: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
    };
    return d;
  }
  describe("adminAssignNation", () => {
    const country = {
      id: "c2",
      realmId: "default",
      ownerUserId: "u_old",
      realm: { settings: null },
    };

    it("regular user: the previous owner loses c2 and the user keeps their other nation in the same realm", async () => {
      // u1 owns and acts as c1 in Ixnay; the realm allows 2 and u1 is premium, so c2 fits.
      const d = db(
        { id: "u1", clerkUserId: "clerk_u1", countryId: "c1" },
        { ...country, ownerUserId: null, realm: { settings: { maxNationsPerUser: 2 } } }
      );
      d.user.findUnique.mockResolvedValue({ membershipTier: "mycountry_premium" });
      d.country.count.mockResolvedValue(1);
      await adminAssignNation(d, { clerkUserId: "clerk_u1", countryId: "c2" });
      expect(d.country.update).toHaveBeenCalledTimes(1);
      expect(d.country.update).toHaveBeenCalledWith({
        where: { id: "c2" },
        data: { ownerUserId: null, ownedSince: null },
      });
      expect(d.country.findMany).not.toHaveBeenCalled();
      expect(d.country.update).not.toHaveBeenCalledWith({
        where: { id: "c1" },
        data: { ownerUserId: null, ownedSince: null },
      });
      expect(d.user.updateMany).not.toHaveBeenCalledWith({
        where: { countryId: "c1" },
        data: { countryId: null },
      });
      expect(d.country.updateMany).toHaveBeenCalledWith({
        where: { id: "c2", ownerUserId: null },
        data: { ownerUserId: "u1", ownedSince: expect.any(Date) },
      });
      // The active pointer follows assignNation's rule: u1 keeps acting as c1.
      expect(d.user.updateMany).toHaveBeenCalledWith({
        where: { id: "u1", countryId: null },
        data: { countryId: "c2" },
      });
    });

    it("the previous owner loses their officer post when that was their last nation in the realm", async () => {
      const d = db(
        { id: "u1", clerkUserId: "clerk_u1", countryId: null },
        {
          ...country,
          realmId: "eurth",
          ownerUserId: null,
          owner: { id: "u_old", clerkUserId: "clerk_old" },
        }
      );
      await adminAssignNation(d, { clerkUserId: "clerk_u1", countryId: "c2" });
      expect(d.country.count).toHaveBeenCalledWith({
        where: { realmId: "eurth", ownerUserId: "u_old" },
      });
      expect(d.realmOfficer.deleteMany).toHaveBeenCalledWith({
        where: { realmId: "eurth", userId: "clerk_old" },
      });
    });
    it("a user at their cap in c2's realm is CAP_REACHED; nothing they own is released", async () => {
      const d = db(
        { id: "u1", clerkUserId: "clerk_u1", countryId: "c1" },
        { ...country, ownerUserId: null }
      );
      d.country.count.mockResolvedValue(1); // free tier, realm cap 1: already full
      await expect(
        adminAssignNation(d, { clerkUserId: "clerk_u1", countryId: "c2" })
      ).rejects.toMatchObject({
        code: "CAP_REACHED",
      });
      expect(d.country.update).not.toHaveBeenCalledWith({
        where: { id: "c1" },
        data: { ownerUserId: null, ownedSince: null },
      });
      expect(d.country.updateMany).not.toHaveBeenCalled();
    });

    it("cross-realm (ruling F-1): the user's nation in ANOTHER realm stays owned", async () => {
      // u1 owns and acts as e1 in Eurth; the admin gives them Ixnay's c2.
      const d = db(
        { id: "u1", clerkUserId: "clerk_u1", countryId: "e1" },
        { ...country, ownerUserId: null }
      );
      await adminAssignNation(d, { clerkUserId: "clerk_u1", countryId: "c2" });
      expect(d.country.count).toHaveBeenCalledWith({
        where: { ownerUserId: "u1", realmId: "default" },
      });
      expect(d.country.update).toHaveBeenCalledTimes(1);
      expect(d.country.update).not.toHaveBeenCalledWith({
        where: { id: "e1" },
        data: { ownerUserId: null, ownedSince: null },
      });
      expect(d.user.updateMany).not.toHaveBeenCalledWith({
        where: { countryId: "e1" },
        data: { countryId: null },
      });
      expect(d.country.updateMany).toHaveBeenCalledWith({
        where: { id: "c2", ownerUserId: null },
        data: { ownerUserId: "u1", ownedSince: expect.any(Date) },
      });
      // The active pointer follows assignNation's rule: only set while the user acts as no nation.
      expect(d.user.updateMany).toHaveBeenCalledWith({
        where: { id: "u1", countryId: null },
        data: { countryId: "c2" },
      });
      expect(d.user.update).not.toHaveBeenCalled();
    });
  });
  describe("users.getProfile ThinkPages fallback never grants ownership", () => {
    const { assignNation } = jest.requireMock("~/server/modules/realms");

    function profileCaller(ownerUserId: string | null) {
      const country = { id: "c1", name: "Linkedland" };
      const d: any = {
        $transaction: jest.fn((cb: any) => cb(d)),
        user: {
          findUnique: jest.fn(({ where }: any) =>
            Promise.resolve(
              where.id
                ? { id: "u1", clerkUserId: "clerk_u1", countryId: "c1", country, role: null }
                : { id: "u1", clerkUserId: "clerk_u1", countryId: null, country: null, role: null }
            )
          ),
          update: jest.fn().mockResolvedValue({}),
          updateMany: jest.fn(),
        },
        thinkpagesAccount: { findFirst: jest.fn().mockResolvedValue({ countryId: "c1" }) },
        country: {
          findUnique: jest.fn().mockResolvedValue({ ownerUserId }),
          count: jest.fn(),
          update: jest.fn(),
        },
      };
      const ctx = createMockRouterContext({ auth: { userId: "clerk_u1" }, db: d });
      return { caller: usersProfileRouter.createCaller(ctx as any), d };
    }

    beforeEach(() => assignNation.mockClear());

    it("an account for an UNOWNED nation does not make the user its owner", async () => {
      const { caller, d } = profileCaller(null);
      const profile = await caller.getProfile();
      expect(profile.countryId).toBeNull();
      expect(assignNation).not.toHaveBeenCalled();
      expect(d.country.update).not.toHaveBeenCalled();
      expect(d.user.update).not.toHaveBeenCalled();
    });
  });
  describe("users.setActiveNation (ruling F-1)", () => {
    function caller(ownerUserId: string | null) {
      const d: any = {
        $transaction: jest.fn((cb: any) => cb(d)),
        user: { update: jest.fn().mockResolvedValue({}), updateMany: jest.fn() },
        country: { findUnique: jest.fn().mockResolvedValue({ ownerUserId }) },
      };
      const ctx = createMockRouterContext({
        auth: { userId: "clerk_u1" },
        user: { id: "u1", clerkUserId: "clerk_u1", countryId: "c1" },
        db: d,
      });
      return { caller: usersCountryLinkingRouter.createCaller(ctx as any), d };
    }

    beforeEach(() => jest.mocked(globalCache.delete).mockClear());
    it("a nation the caller does not own is FORBIDDEN and nothing moves", async () => {
      for (const owner of ["u2", null]) {
        const { caller: c, d } = caller(owner);
        await expect(c.setActiveNation({ countryId: "e1" })).rejects.toMatchObject({
          code: "FORBIDDEN",
        });
        expect(d.user.update).not.toHaveBeenCalled();
      }
      expect(globalCache.delete).not.toHaveBeenCalled();
    });
  });
});

describe("the ownership module", () => {
  function tx(country: any, ownedInRealm = 0) {
    return {
      country: {
        findUnique: jest.fn().mockResolvedValue(country),
        count: jest.fn().mockResolvedValue(ownedInRealm),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({ membershipTier: "basic" }),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    } as any;
  }
  const unowned = { id: "c1", realmId: "default", ownerUserId: null, realm: { settings: null } };
  describe("assignNation", () => {
    it("sets the owner, and makes it the active nation only when the user has none (invariant I1, ruling F-1)", async () => {
      const t = tx(unowned);
      await assignNation(t, { userId: "u1", countryId: "c1" });
      expect(t.country.updateMany).toHaveBeenCalledWith({
        where: { id: "c1", ownerUserId: null },
        data: { ownerUserId: "u1", ownedSince: expect.any(Date) },
      });
      // Guarded on countryId: null — a player already acting as a nation (another realm's) keeps it.
      expect(t.user.updateMany).toHaveBeenCalledWith({
        where: { id: "u1", countryId: null },
        data: { countryId: "c1" },
      });
      expect(t.user.update).not.toHaveBeenCalled();
    });

    it("loses a concurrent race: the guarded ownership write matches nothing → ALREADY_OWNED, no pointer move", async () => {
      const t = tx(unowned);
      t.country.updateMany.mockResolvedValue({ count: 0 });
      await expect(assignNation(t, { userId: "u1", countryId: "c1" })).rejects.toMatchObject({
        code: "ALREADY_OWNED",
      });
      expect(t.user.update).not.toHaveBeenCalled();
      expect(t.user.updateMany).not.toHaveBeenCalled();
    });
    it("enforces the per-realm cap (invariant I2)", async () => {
      const t = tx(unowned, 1);
      await expect(assignNation(t, { userId: "u1", countryId: "c1" })).rejects.toBeInstanceOf(
        NationOwnershipError
      );
      expect(t.country.updateMany).not.toHaveBeenCalled();
    });
  });
  describe("assignClaimedNation", () => {
    const claimable = { ...unowned, claimable: true };
    it("loses a flip to scenery that lands between its read and its write: the guarded write matches nothing", async () => {
      const t = tx(claimable);
      t.country.updateMany.mockResolvedValue({ count: 0 });
      await expect(
        assignClaimedNation(t, { userId: "u1", countryId: "c1" })
      ).rejects.toBeInstanceOf(NationOwnershipError);
      expect(t.user.updateMany).not.toHaveBeenCalled();
    });
  });
  describe("releaseNation / pointActiveNation", () => {
    it("clears owner and every active pointer at the country", async () => {
      const t = tx(unowned);
      await releaseNation(t, "c1");
      expect(t.country.update).toHaveBeenCalledWith({
        where: { id: "c1" },
        data: { ownerUserId: null, ownedSince: null },
      });
      expect(t.user.updateMany).toHaveBeenCalledWith({
        where: { countryId: "c1" },
        data: { countryId: null },
      });
    });
  });
  describe("canModerateRealm", () => {
    const realm = { ownerId: "clerk_founder" };
    it("allows the founder, site admins and system owners only", () => {
      expect(canModerateRealm({ id: "u1", clerkUserId: "clerk_founder" }, realm)).toBe(true);
      expect(
        canModerateRealm({ id: "u2", clerkUserId: "x", role: { name: "admin", level: 10 } }, realm)
      ).toBe(true);
      expect(canModerateRealm({ id: "u3", clerkUserId: "sys_owner" }, realm)).toBe(true);
      expect(
        canModerateRealm(
          { id: "u4", clerkUserId: "x", role: { name: "member", level: 100 } },
          realm
        )
      ).toBe(false);
    });
  });
});
