/** @jest-environment node */
/**
 * A staff admin plays as an ordinary member through the real request context: the context swaps to the member, keeps
 * the rate-limit bucket on the admin and writes one play-as audit row. The admin reads the member's packs, but every
 * admin procedure and every money move (a pack purchase, the daily claim) is refused, with the member's wallet, ledger
 * and collection untouched; the member buying the same pack themself pays. Reading the member's balance pays no
 * new-player bonus; the member's own next read pays it once. Out of play-as, the admin's own calls are
 * audited: mutations and failures, with the trusted IP. A second staff member is refused play-as of the system
 * owner, of an equal, and of nobody, and a member is refused play-as at all, each attempt audited.
 *
 * The system owner may play as anyone, and a header naming the requester themself changes nothing. A newcomer's first
 * request creates their account, pays the new-player bonus once and queues their first achievement check.
 *
 * Folds audit-log-middleware (the admin audit rows and the trusted IP), trpc-impersonation (the play-as decision and
 * the context swap) and user-creation-onboarding.
 */
let mockDb: unknown;
jest.mock("~/server/db", () => ({
  get db() {
    return mockDb;
  },
  isDatabaseReadOnly: false,
}));
jest.mock("@clerk/nextjs/server", () => ({
  __esModule: true,
  getAuth: (req: { auth?: unknown } | undefined) => req?.auth ?? null,
  verifyToken: jest.fn(),
  clerkClient: jest.fn(),
}));
jest.mock("~/lib/auth/system-owner-constants", () => ({
  ...jest.requireActual("~/lib/auth/system-owner-constants"),
  isSystemOwner: (id: string) => id === "user_owner",
}));
jest.mock("~/lib/notifications/api", () => ({ notificationAPI: { create: jest.fn() } }));
jest.mock("~/lib/achievements/queue", () => ({ queueAchievementCheck: jest.fn() }));

import type { PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { appRouter } from "~/server/api/root";
import {
  adminProcedure,
  createCallerFactory,
  createTRPCContext,
  createTRPCRouter,
} from "~/server/api/trpc";
import { queueAchievementCheck } from "~/lib/achievements/queue";
import { createMemoryPrisma } from "~/tests/helpers/memory-prisma";
import {
  addCard,
  addPack,
  addPlayer,
  addRealm,
  clearEconomyCaches,
  creditsOf,
  ledgerOf,
  type Player,
} from "~/tests/helpers/money-world";

const app = createCallerFactory(appRouter);
const PLAYING_AS_ADMIN =
  "Admin actions are disabled while playing as another user. Exit play-as mode first.";
const PLAYING_AS_MONEY =
  "Money and card actions are disabled while playing as another user. Exit play-as mode first.";

/** An admin router on the real adminProcedure chain: what the audit middleware sees of any admin call. */
const adminTools = createCallerFactory(
  createTRPCRouter({
    saveThing: adminProcedure
      .input(z.object({ name: z.string() }))
      .mutation(({ input }) => ({ saved: input.name })),
    failThing: adminProcedure.mutation(() => {
      throw new TRPCError({ code: "BAD_REQUEST", message: "nope" });
    }),
    readThing: adminProcedure.query(() => "ok"),
    failRead: adminProcedure.query(() => {
      throw new TRPCError({ code: "NOT_FOUND", message: "missing" });
    }),
  })
);

interface World {
  db: PrismaClient;
  ada: Player;
  sam: Player;
  sue: Player;
  mo: Player;
  pack: string;
}

/** Ada is an admin (level 10), Sam and Sue staff (level 20). Mo is a member with 500 IxC; a 100 IxC pack is on sale. */
async function seed(db: PrismaClient): Promise<World> {
  const admin = await db.role.create({ data: { name: "admin", displayName: "Admin", level: 10 } });
  const staff = await db.role.create({ data: { name: "staff", displayName: "Staff", level: 20 } });
  const [ada, sam, sue, mo] = await Promise.all(
    (["ada", "sam", "sue", "mo"] as const).map((name) =>
      addPlayer(db, name, name === "mo" ? 500 : 0)
    )
  );
  await db.user.update({ where: { id: "ada" }, data: { roleId: admin.id } });
  for (const id of ["sam", "sue"])
    await db.user.update({ where: { id }, data: { roleId: staff.id } });
  const { id: realmId } = await addRealm(db, "realm");
  await addCard(db, { id: "common", realmId, rarity: "COMMON" });
  const { id: pack } = await addPack(db, {
    id: "pack",
    realmId,
    priceCredits: 100,
    cardCount: 1,
    rarity: "COMMON",
  });
  return { db, ada: ada!, sam: sam!, sue: sue!, mo: mo!, pack };
}

/** One request from `player`, with these headers, through the real context. Ada's session claims say admin. */
function request(player: Player, headers: Record<string, string> = {}) {
  return createTRPCContext({
    headers: new Headers(headers),
    req: {
      auth: { userId: player.clerkUserId, sessionClaims: { metadata: { role: "admin" } } },
      headers: new Headers(),
    } as never,
  });
}

const auditRows = (db: PrismaClient, action: string) =>
  db.auditLog.findMany({
    where: { action },
    select: { userId: true, target: true, success: true, details: true },
    orderBy: { timestamp: "asc" },
  });

let w: World;
beforeAll(async () => {
  for (const level of ["info", "log", "warn", "error"] as const)
    jest.spyOn(console, level).mockImplementation(() => {});
  mockDb = createMemoryPrisma();
  clearEconomyCaches();
  w = await seed(mockDb as PrismaClient);
});

describe("an admin playing as a member", () => {
  it("acts as the member, on the admin's own rate-limit bucket, with one audit row per ten minutes", async () => {
    const ctx = await request(w.ada, {
      "x-play-as-user": w.mo.clerkUserId,
      "cf-connecting-ip": "203.0.113.9",
    });
    expect(ctx.auth?.userId).toBe(w.mo.clerkUserId);
    expect(ctx.user?.id).toBe(w.mo.id);
    expect(ctx.impersonatorId).toBe(w.ada.clerkUserId);
    expect(ctx.realUserId).toBe(w.ada.clerkUserId);
    // The admin's session claims are dropped, so no role check reads them for the member
    expect(ctx.auth && "sessionClaims" in ctx.auth).toBe(false);
    expect(ctx.rateLimitIdentifier).toBe(`user:${w.ada.clerkUserId}`);

    await request(w.ada, { "x-play-as-user": w.mo.clerkUserId });
    const rows = await auditRows(w.db, "impersonation.play_as");
    expect(rows).toEqual([
      expect.objectContaining({
        userId: w.ada.clerkUserId,
        target: w.mo.clerkUserId,
        success: true,
      }),
    ]);
    expect(JSON.parse(rows[0]!.details!)).toMatchObject({ ip: "203.0.113.9", reason: null });
  });

  it("reads the member's packs, but every admin procedure and money move is refused, touching nothing", async () => {
    const asMo = app(await request(w.ada, { "x-play-as-user": w.mo.clerkUserId }));
    await expect(asMo.cardPacks.getMyPacks({ isOpened: false })).resolves.toMatchObject({
      packs: [],
    });

    await expect(
      asMo.achievements.unlock({
        userId: w.mo.id,
        achievementId: "first-steps",
        title: "First steps",
      })
    ).rejects.toMatchObject({ message: PLAYING_AS_ADMIN, cause: { code: "FORBIDDEN" } });
    await expect(asMo.cardPacks.purchasePack({ packId: w.pack })).rejects.toMatchObject({
      message: PLAYING_AS_MONEY,
      cause: { code: "FORBIDDEN" },
    });
    await expect(asMo.vault.claimCombinedDailyClaim({ choice: "CREDITS" })).rejects.toMatchObject({
      message: PLAYING_AS_MONEY,
    });

    expect(await creditsOf(w.db, [w.mo.id])).toEqual({ [w.mo.id]: 500 });
    expect(await ledgerOf(w.db, w.mo.id)).toEqual([]);
    expect(await w.db.userPack.count()).toBe(0);
    expect(await w.db.cardOwnership.count()).toBe(0);
    expect(await w.db.userAchievement.count()).toBe(0);

    // The member themself buys the same pack: the guard is play-as, not the purchase
    const mo = app(await request(w.mo));
    await expect(mo.cardPacks.purchasePack({ packId: w.pack })).resolves.toMatchObject({
      success: true,
    });
    expect(await creditsOf(w.db, [w.mo.id])).toEqual({ [w.mo.id]: 400 });
    expect(await ledgerOf(w.db, w.mo.id)).toEqual([
      { credits: -100, balanceAfter: 400, type: "SPEND_PACKS", source: "PACK_PURCHASE" },
    ]);
  });

  it("reads the member's balance without paying their new-player bonus, which their own next read pays once", async () => {
    const rows = await w.db.vaultTransaction.count();
    const asMo = app(await request(w.ada, { "x-play-as-user": w.mo.clerkUserId }));
    await expect(asMo.vault.getBalance()).resolves.toMatchObject({ credits: 400 });
    expect(await w.db.vaultTransaction.count()).toBe(rows);

    const mo = app(await request(w.mo));
    await expect(mo.vault.getBalance()).resolves.toMatchObject({ credits: 5400 });
    await mo.vault.getBalance();
    expect((await ledgerOf(w.db, w.mo.id)).slice(1)).toEqual([
      { credits: 5000, balanceAfter: 5400, type: "EARN_BONUS", source: "bonus:new_player" },
    ]);
  });
});

describe("the admin's own calls, out of play-as", () => {
  it("audit every mutation and every failure, with the IP from cf-connecting-ip and never x-forwarded-for", async () => {
    const ctx = await request(w.ada, {
      "cf-connecting-ip": "203.0.113.9",
      "x-forwarded-for": "6.6.6.6",
    });
    expect(ctx.impersonatorId).toBeUndefined();
    const tools = adminTools(ctx);

    await expect(tools.saveThing({ name: "x" })).resolves.toEqual({ saved: "x" });
    await expect(tools.failThing()).rejects.toThrow("nope");
    await expect(tools.readThing()).resolves.toBe("ok");
    await expect(tools.failRead()).rejects.toThrow("missing");

    const rows = await w.db.auditLog.findMany({
      where: { entityType: "trpc_admin" },
      select: {
        userId: true,
        action: true,
        success: true,
        error: true,
        ipAddress: true,
        details: true,
      },
      orderBy: { timestamp: "asc" },
    });
    // The successful read writes no row
    expect(rows.map(({ action, success, error }) => ({ action, success, error }))).toEqual([
      { action: "saveThing", success: true, error: null },
      { action: "failThing", success: false, error: "nope" },
      { action: "failRead", success: false, error: "missing" },
    ]);
    for (const row of rows) {
      expect(row.userId).toBe(w.ada.clerkUserId);
      expect(row.ipAddress).toBe("203.0.113.9");
      expect(row.details).not.toContain("6.6.6.6");
    }
  });
});

describe("play-as that is refused", () => {
  it.each([
    ["the system owner", "user_owner", "target-is-system-owner"],
    ["a staff member of the same rank", "sue-clerk", "target-outranks"],
    ["an account that does not exist", "user_ghost", "target-not-found"],
  ])(
    "a staff member asking for %s keeps their own context, and the attempt is audited",
    async (_label, target, reason) => {
      const ctx = await request(w.sam, { "x-play-as-user": target });
      expect(ctx.auth?.userId).toBe(w.sam.clerkUserId);
      expect(ctx.impersonatorId).toBeUndefined();
      const denied = (await auditRows(w.db, "impersonation.play_as_denied")).filter(
        (row) => row.target === target
      );
      expect(denied).toEqual([
        expect.objectContaining({ userId: w.sam.clerkUserId, success: false }),
      ]);
      expect(JSON.parse(denied[0]!.details!)).toMatchObject({ reason });
    }
  );

  it("a play-as header naming the requester themself changes nothing and audits nothing", async () => {
    const before = await w.db.auditLog.count({ where: { userId: w.sam.clerkUserId } });
    const ctx = await request(w.sam, { "x-play-as-user": w.sam.clerkUserId });
    expect(ctx.auth?.userId).toBe(w.sam.clerkUserId);
    expect(ctx.impersonatorId).toBeUndefined();
    expect(await w.db.auditLog.count({ where: { userId: w.sam.clerkUserId } })).toBe(before);
  });

  it("a member with a play-as header stays themself", async () => {
    const ctx = await request(w.mo, { "x-play-as-user": w.ada.clerkUserId });
    expect(ctx.auth?.userId).toBe(w.mo.clerkUserId);
    expect(ctx.impersonatorId).toBeUndefined();
    const denied = (await auditRows(w.db, "impersonation.play_as_denied")).filter(
      (row) => row.userId === w.mo.clerkUserId
    );
    expect(JSON.parse(denied[0]!.details!)).toMatchObject({ reason: "not-staff" });
  });
});

describe("the system owner and a newcomer", () => {
  it("the system owner may play as staff, who outrank every member", async () => {
    await w.db.user.create({
      data: { id: "owner", clerkUserId: "user_owner", lastSeenAt: new Date() },
    });
    const ctx = await request(
      { id: "owner", clerkUserId: "user_owner" },
      { "x-play-as-user": w.sam.clerkUserId }
    );
    expect(ctx.auth?.userId).toBe(w.sam.clerkUserId);
    expect(ctx.impersonatorId).toBe("user_owner");
  });

  it("a newcomer's first request creates their account, pays the new-player bonus once and queues achievements", async () => {
    const newcomer = { id: "", clerkUserId: "newcomer-clerk" };
    const first = await request(newcomer);
    const id = first.user!.id;
    expect(await w.db.user.count({ where: { clerkUserId: newcomer.clerkUserId } })).toBe(1);
    expect(jest.mocked(queueAchievementCheck)).toHaveBeenCalledWith(id);

    await request(newcomer);
    await app(await request(newcomer)).vault.getBalance();
    expect(await w.db.user.count({ where: { clerkUserId: newcomer.clerkUserId } })).toBe(1);
    expect(await ledgerOf(w.db, id)).toEqual([
      { credits: 5000, balanceAfter: 5000, type: "EARN_BONUS", source: "bonus:new_player" },
    ]);
  });
});
