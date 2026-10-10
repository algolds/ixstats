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

import { realmsRouter } from "~/server/api/routers/realms";
import { notifyRealmFounderChanged } from "~/server/modules/realms/realms.notices";
import { REALM_OWNER_TRANSFER_ACTION } from "~/server/modules/realms/realms.transfer";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createMockPrisma } from "~/tests/helpers/mock-db";

type Db = ReturnType<typeof createMockPrisma>;

const FOUNDER = "clerk_founder";
const OFFICER = "clerk_officer";
const PLAYER = "clerk_player";
const ADMIN = "clerk_admin";
const admin = { name: "admin", level: 10 };
const ALL_POWERS = ["appearance", "board", "diplomacy", "claims", "map"];
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

beforeEach(() => notify.mockClear());

describe("site admins transfer a realm", () => {
  const transfer = (overrides: Record<string, unknown> = {}) => ({
    realmId: "eurth",
    newOwnerId: PLAYER as string | null,
    confirmSlug: "eurth",
    keepPreviousAsOfficer: false,
    ...overrides,
  });

  it("is for site admins only", async () => {
    const db = makeDb();
    await expect(callerAs(FOUNDER, db).region.adminTransferOwner(transfer())).rejects.toThrow();
    await expect(callerAs(OFFICER, db).region.adminTransferOwner(transfer())).rejects.toThrow();
    expect(db.realm.update).not.toHaveBeenCalled();
    expect(db.adminAuditLog.create).not.toHaveBeenCalled();
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

  it("refuses handing the realm to its current founder", async () => {
    const db = makeDb();
    await expect(
      callerAs(ADMIN, db, admin).region.adminTransferOwner(transfer({ newOwnerId: FOUNDER }))
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
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

  it("keeps the previous founder as an officer with every power when asked", async () => {
    const db = makeDb();
    await callerAs(ADMIN, db, admin).region.adminTransferOwner(
      transfer({ keepPreviousAsOfficer: true })
    );
    expect(db.realmOfficer.upsert).toHaveBeenCalledWith({
      where: { realmId_userId: { realmId: "eurth", userId: FOUNDER } },
      create: {
        realmId: "eurth",
        userId: FOUNDER,
        title: "Former founder",
        powers: ALL_POWERS,
        appointedBy: ADMIN,
      },
      update: { title: "Former founder", powers: ALL_POWERS, appointedBy: ADMIN },
    });
    expect(auditChanges(db)).toMatchObject({ keptPreviousAsOfficer: true });
  });

  it("hands a realm back to staff, and from staff to a player with no one to keep", async () => {
    const db = makeDb();
    await callerAs(ADMIN, db, admin).region.adminTransferOwner(transfer({ newOwnerId: null }));
    expect(db.realm.update).toHaveBeenLastCalledWith({
      where: { id: "eurth" },
      data: { ownerId: "system" },
    });

    const staffDb = makeDb(realmRow({ ownerId: "system" }));
    await callerAs(ADMIN, staffDb, admin).region.adminTransferOwner(
      transfer({ keepPreviousAsOfficer: true })
    );
    expect(staffDb.realm.update).toHaveBeenCalledWith({
      where: { id: "eurth" },
      data: { ownerId: PLAYER },
    });
    expect(staffDb.realmOfficer.upsert).not.toHaveBeenCalled();
    expect(auditChanges(staffDb)).toMatchObject({
      previousOwnerId: "system",
      keptPreviousAsOfficer: false,
    });
  });

  it("keeps IxWorld with staff", async () => {
    const db = makeDb(realmRow({ id: "default", slug: "ixworld", ownerId: "system" }));
    await expect(
      callerAs(ADMIN, db, admin).region.adminTransferOwner(
        transfer({ realmId: "default", confirmSlug: "ixworld" })
      )
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(db.realm.update).not.toHaveBeenCalled();
  });

  it("refuses keeping the previous founder when the officer list is full", async () => {
    const officers = Array.from({ length: 12 }, (_, i) => ({ userId: `clerk_o${i}`, powers: [] }));
    const db = makeDb(realmRow({ officers }));
    await expect(
      callerAs(ADMIN, db, admin).region.adminTransferOwner(
        transfer({ keepPreviousAsOfficer: true })
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

  it("hands it back to staff without a ban check", async () => {
    const db = bannedDb();
    await callerAs(ADMIN, db, admin).region.adminTransferOwner({
      realmId: "eurth",
      newOwnerId: null,
      confirmSlug: "eurth",
      keepPreviousAsOfficer: false,
    });
    expect(db.forumBan.findFirst).not.toHaveBeenCalled();
    expect(db.realm.update).toHaveBeenCalled();
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

  it("needs the realm's slug typed", async () => {
    const db = makeDb();
    db.country.findFirst.mockResolvedValue({ id: "c1" });
    await expect(
      callerAs(FOUNDER, db).region.handOver(handOver({ confirmSlug: "eurt" }))
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
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

  it("hands it to an officer, whose officer post is dropped, and can keep the founder on", async () => {
    const db = makeDb();
    db.country.findFirst.mockResolvedValue(null);
    await callerAs(FOUNDER, db).region.handOver(
      handOver({ newOwnerId: OFFICER, keepPreviousAsOfficer: true })
    );
    expect(db.realm.update).toHaveBeenCalledWith({
      where: { id: "eurth" },
      data: { ownerId: OFFICER },
    });
    expect(db.realmOfficer.deleteMany).toHaveBeenCalledWith({
      where: { realmId: "eurth", userId: OFFICER },
    });
    expect(db.realmOfficer.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ userId: FOUNDER, powers: ALL_POWERS }),
      })
    );
    expect(auditChanges(db)).toEqual({
      previousOwnerId: FOUNDER,
      newOwnerId: OFFICER,
      keptPreviousAsOfficer: true,
      via: "founder",
    });
    // The founder handed it over themselves: only the new founder is told.
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ clerkUserId: OFFICER }));
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

describe("the Manage payload", () => {
  function manageDb(officers: Array<{ userId: string; powers: string[] }>) {
    const db = makeDb(realmRow({ officers }));
    db.realm.findUniqueOrThrow.mockResolvedValue({
      description: null,
      bannerUrl: null,
      thumbnail: null,
      tags: [],
      factbookWikitext: null,
      factbookUpdatedAt: null,
      ownerId: FOUNDER,
    });
    return db;
  }

  it("offers the hand-over to the founder only, and the claims power to officers granted it", async () => {
    const db = manageDb([{ userId: OFFICER, powers: ["claims"] }]);
    await expect(callerAs(FOUNDER, db).region.manage({ slug: "eurth" })).resolves.toMatchObject({
      isFounder: true,
      canHandOver: true,
      powers: ALL_POWERS,
    });
    await expect(
      callerAs(ADMIN, db, admin).region.manage({ slug: "eurth" })
    ).resolves.toMatchObject({ isFounder: true, canHandOver: false });
    await expect(callerAs(OFFICER, db).region.manage({ slug: "eurth" })).resolves.toMatchObject({
      isFounder: false,
      canHandOver: false,
      powers: ["claims"],
    });
  });
});
