/** @jest-environment node */
/** Plan 410: the Prisma side of bot logins: only a verified wiki link identifies a user. */
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: {
    user: { findUnique: jest.fn() },
    wikiAccountLink: { findFirst: jest.fn() },
    wikiBotPassword: { findUnique: jest.fn(), update: jest.fn() },
    wikiApiSession: { create: jest.fn(), findUnique: jest.fn(), findMany: jest.fn(), updateMany: jest.fn(), deleteMany: jest.fn() },
  },
}));

import { prismaAuthStore, loadSessionUser, syntheticUserId } from "~/lib/wiki-os/api-compat/auth-store";
import { db } from "~/server/db";

const mdb = db as unknown as {
  user: { findUnique: jest.Mock };
  wikiAccountLink: { findFirst: jest.Mock };
  wikiBotPassword: { findUnique: jest.Mock; update: jest.Mock };
  wikiApiSession: Record<"create" | "findUnique" | "findMany" | "updateMany" | "deleteMany", jest.Mock>;
};

const userRow = { id: "u1", clerkUserId: "user_clerk", createdAt: new Date("2020-01-01T00:00:00Z"), role: { id: "r", name: "admin", level: 1 } };

beforeEach(() => {
  jest.clearAllMocks();
  mdb.user.findUnique.mockResolvedValue(userRow);
  mdb.wikiAccountLink.findFirst.mockResolvedValue({ username: "Heku", wikiUserId: 77, userId: "u1" });
});

describe("syntheticUserId", () => {
  it("is stable, never 0 and well above any MediaWiki id", () => {
    expect(syntheticUserId("u1")).toBe(syntheticUserId("u1"));
    expect(syntheticUserId("u1")).not.toBe(syntheticUserId("u2"));
    for (const id of ["a", "u1", "clx123456789", ""]) {
      expect(syntheticUserId(id)).toBeGreaterThanOrEqual(1_000_000_000);
      expect(syntheticUserId(id)).toBeLessThan(2_000_000_000);
    }
  });
});

describe("loadSessionUser", () => {
  it("builds the context the permission services read, named by the verified wiki account", async () => {
    const user = await loadSessionUser("u1");
    expect(user).toEqual({
      name: "Heku",
      mwUserId: 77,
      ctx: {
        auth: { userId: "user_clerk" },
        user: { id: "u1", clerkUserId: "user_clerk", wikiUsername: "Heku", createdAt: userRow.createdAt, role: userRow.role },
      },
    });
    expect(mdb.wikiAccountLink.findFirst.mock.calls[0]![0].where).toEqual({ userId: "u1", source: "ixwiki", verifiedAt: { not: null } });
  });

  it("falls back to a synthetic id when MediaWiki never gave one, and is null without a verified link or user", async () => {
    mdb.wikiAccountLink.findFirst.mockResolvedValue({ username: "Heku", wikiUserId: null, userId: "u1" });
    expect((await loadSessionUser("u1"))?.mwUserId).toBe(syntheticUserId("u1"));
    mdb.wikiAccountLink.findFirst.mockResolvedValue(null);
    expect(await loadSessionUser("u1")).toBeNull();
    mdb.wikiAccountLink.findFirst.mockResolvedValue({ username: "Heku", wikiUserId: 1, userId: "u1" });
    mdb.user.findUnique.mockResolvedValue(null);
    expect(await loadSessionUser("u1")).toBeNull();
  });
});

describe("prismaAuthStore", () => {
  it("finds a bot password through the verified link of the normalized wiki name", async () => {
    mdb.wikiBotPassword.findUnique.mockResolvedValue({ id: "bp1", userId: "u1", appId: "Bot", passwordHash: "scrypt$a$b", grants: ["basic"] });
    const found = await prismaAuthStore.findBotPassword("heku_x", "Bot");
    expect(mdb.wikiAccountLink.findFirst.mock.calls[0]![0].where).toEqual({ source: "ixwiki", username: "Heku x", verifiedAt: { not: null } });
    expect(mdb.wikiBotPassword.findUnique.mock.calls[0]![0].where).toEqual({ userId_appId: { userId: "u1", appId: "Bot" } });
    expect(found?.botPassword.id).toBe("bp1");
    expect(found?.user.name).toBe("Heku");
  });

  it("finds nothing for an unlinked name or a missing bot password", async () => {
    mdb.wikiAccountLink.findFirst.mockResolvedValueOnce(null);
    expect(await prismaAuthStore.findBotPassword("Nobody", "Bot")).toBeNull();
    mdb.wikiBotPassword.findUnique.mockResolvedValue(null);
    expect(await prismaAuthStore.findBotPassword("Heku", "Nope")).toBeNull();
  });

  it("creates, reads, extends and deletes sessions", async () => {
    await prismaAuthStore.createSession({ id: "s1", botPasswordId: "bp1", userId: "u1", expiresAt: new Date("2030-01-01T00:00:00Z") });
    expect(mdb.wikiApiSession.create.mock.calls[0]![0].data).toMatchObject({ id: "s1", botPasswordId: "bp1", userId: "u1" });

    mdb.wikiApiSession.findUnique.mockResolvedValue({ id: "s1", botPasswordId: "bp1", userId: "u1", expiresAt: new Date("2030-01-01T00:00:00Z"), botPassword: { grants: ["basic", "editpage"] } });
    const found = await prismaAuthStore.findSession("s1");
    expect(found?.session).toEqual({ id: "s1", botPasswordId: "bp1", userId: "u1", expiresAt: new Date("2030-01-01T00:00:00Z"), grants: ["basic", "editpage"] });
    expect(found?.user.name).toBe("Heku");

    await prismaAuthStore.extendSession("s1", new Date("2031-01-01T00:00:00Z"));
    expect(mdb.wikiApiSession.updateMany).toHaveBeenCalledWith({ where: { id: "s1" }, data: { expiresAt: new Date("2031-01-01T00:00:00Z") } });
    await prismaAuthStore.deleteSession("s1");
    expect(mdb.wikiApiSession.deleteMany).toHaveBeenCalledWith({ where: { id: "s1" } });

    mdb.wikiApiSession.findUnique.mockResolvedValue(null);
    expect(await prismaAuthStore.findSession("gone")).toBeNull();
  });

  it("records when a bot password was last used, and finds a browser user by Clerk id", async () => {
    await prismaAuthStore.touchBotPassword("bp1", new Date("2026-09-30T12:00:00Z"));
    expect(mdb.wikiBotPassword.update.mock.calls[0]![0]).toMatchObject({ where: { id: "bp1" }, data: { lastUsedAt: new Date("2026-09-30T12:00:00Z") } });
    expect((await prismaAuthStore.findWebUser("user_clerk"))?.name).toBe("Heku");
    expect(mdb.user.findUnique.mock.calls[0]![0].where).toEqual({ clerkUserId: "user_clerk" });
    mdb.user.findUnique.mockResolvedValueOnce(null);
    expect(await prismaAuthStore.findWebUser("user_unknown")).toBeNull();
  });
});

describe("pruneSessions", () => {
  const now = new Date("2026-09-30T12:00:00Z");

  it("deletes expired sessions, and the oldest ones past the cap for that bot password", async () => {
    mdb.wikiApiSession.findMany.mockResolvedValue([{ id: "old1" }, { id: "old2" }]);
    await prismaAuthStore.pruneSessions("bp1", now, 20);
    expect(mdb.wikiApiSession.deleteMany).toHaveBeenNthCalledWith(1, { where: { expiresAt: { lt: now } } });
    expect(mdb.wikiApiSession.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { botPasswordId: "bp1" }, orderBy: { createdAt: "desc" }, skip: 20, select: { id: true } })
    );
    expect(mdb.wikiApiSession.deleteMany).toHaveBeenNthCalledWith(2, { where: { id: { in: ["old1", "old2"] } } });
  });

  it("deletes nothing more when the bot password is within its cap", async () => {
    mdb.wikiApiSession.findMany.mockResolvedValue([]);
    await prismaAuthStore.pruneSessions("bp1", now, 20);
    expect(mdb.wikiApiSession.deleteMany).toHaveBeenCalledTimes(1);
  });
});
