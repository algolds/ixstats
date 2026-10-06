/** @jest-environment node */
/**
 * Plan 410: bot passwords (scrypt), sessions, tokens, cookie flags, login/logout, how the caller is
 * resolved, and the grant intersection (effective rights = the user's rights ∩ the grants' rights).
 */
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: {
    wikiAccountLink: { findFirst: jest.fn() },
    wikiUserGroup: { findMany: jest.fn() },
    wikiBlock: { findMany: jest.fn() },
    wikiRevision: { count: jest.fn() },
    wikiRestriction: { findMany: jest.fn() },
    user: { findUnique: jest.fn() },
  },
}));
jest.mock("~/lib/auth", () => ({
  __esModule: true,
  isSystemOwner: jest.fn(() => false),
  SYSTEM_OWNER_IDS: [],
}));

import { env } from "~/env";
import {
  SESSION_COOKIE,
  SESSION_TTL_MS,
  TOKEN_SUFFIX,
  clearedSessionCookie,
  generateBotPassword,
  hashBotPassword,
  MAX_SESSIONS_PER_BOT_PASSWORD,
  loginNonceCookie,
  loginToken,
  loginWithBotPassword,
  newLoginNonce,
  readCookie,
  readLoginNonce,
  readSessionCookie,
  resolveSession,
  serializeCookie,
  sessionCookie,
  sessionToken,
  signSessionId,
  splitBotLogin,
  tokenIsValid,
  verifyBotPassword,
} from "~/lib/wiki-os/api-compat/auth";
import { GRANT_RIGHTS, rightsForGrants } from "~/lib/wiki-os/api-compat/grants";
import type {
  ApiSession,
  AuthStore,
  PermissionLoader,
  SessionUser,
} from "~/lib/wiki-os/api-compat/types";
import { authorizeAction } from "~/lib/wiki-os/permissions";
import { capWikiPermissions, getWikiPermissions, type Right } from "~/lib/wiki-os/rights";
import { db } from "~/server/db";

const NOW = new Date("2026-09-30T12:00:00Z");
const sysopUser: SessionUser = {
  name: "Heku",
  mwUserId: 7,
  ctx: { auth: { userId: "user_clerk" }, user: { id: "u1", clerkUserId: "user_clerk" } },
};

function storeWith(overrides: Partial<AuthStore> = {}): jest.Mocked<AuthStore> {
  return {
    findBotPassword: jest.fn().mockResolvedValue(null),
    touchBotPassword: jest.fn().mockResolvedValue(undefined),
    createSession: jest.fn().mockResolvedValue(undefined),
    findSession: jest.fn().mockResolvedValue(null),
    extendSession: jest.fn().mockResolvedValue(undefined),
    pruneSessions: jest.fn().mockResolvedValue(undefined),
    deleteSession: jest.fn().mockResolvedValue(undefined),
    findWebUser: jest.fn().mockResolvedValue(null),
    ...overrides,
  } as jest.Mocked<AuthStore>;
}

const permissionsOf = (rights: Right[]) => ({
  groups: ["*" as const],
  rights: new Set<Right>(rights),
  block: null,
  verifiedWikiUsername: null,
});

describe("bot passwords", () => {
  it("generates 32 base32 characters, different each time", () => {
    const a = generateBotPassword();
    expect(a).toMatch(/^[A-Z2-7]{32}$/);
    expect(generateBotPassword()).not.toBe(a);
  });

  it("stores scrypt$<salt>$<hash> and verifies only the right password", async () => {
    const hash = await hashBotPassword("correct horse");
    expect(hash).toMatch(/^scrypt\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/);
    expect(await verifyBotPassword("correct horse", hash)).toBe(true);
    expect(await verifyBotPassword("wrong horse", hash)).toBe(false);
    expect(await hashBotPassword("correct horse")).not.toBe(hash); // a fresh salt each time
  });

  it("never matches a malformed stored hash", async () => {
    expect(await verifyBotPassword("x", "plaintext")).toBe(false);
    expect(await verifyBotPassword("x", "bcrypt$abc$def")).toBe(false);
    expect(await verifyBotPassword("x", "scrypt$$")).toBe(false);
  });

  it("splits User@AppId at the last @ and checks the app id", () => {
    expect(splitBotLogin("Heku@WikiOS")).toEqual({ username: "Heku", appId: "WikiOS" });
    expect(splitBotLogin("Heku")).toBeNull();
    expect(splitBotLogin("@App")).toBeNull();
    expect(splitBotLogin("Heku@bad/app")).toBeNull();
    expect(splitBotLogin(`Heku@${"x".repeat(33)}`)).toBeNull();
  });
});

describe("grants", () => {
  it("always includes basic and ignores unknown grants", () => {
    const rights = rightsForGrants(["nonsense"]);
    expect(rights.has("read")).toBe(true);
    expect(rights.has("edit")).toBe(false);
  });

  it("adds each grant's rights", () => {
    const rights = rightsForGrants(["editpage", "delete"]);
    expect(rights.has("edit")).toBe(true);
    expect(rights.has("delete")).toBe(true);
    expect(rights.has("protect")).toBe(false);
    expect(GRANT_RIGHTS.protect).toContain("editprotected");
  });

  it("has MediaWiki's two upload grants (plan 411): a new file, and replacing or moving one", () => {
    const upload = rightsForGrants(["uploadfile"]);
    expect(upload.has("upload")).toBe(true);
    expect(upload.has("reupload")).toBe(false);
    expect(upload.has("edit")).toBe(false);

    const replace = rightsForGrants(["uploadeditmovefile"]);
    expect(
      [...replace].filter((right) => ["upload", "reupload", "movefile"].includes(right)).sort()
    ).toEqual(["movefile", "reupload", "upload"]);
  });

  describe("capWikiPermissions: effective rights = user rights ∩ grant rights", () => {
    beforeEach(() => {
      jest.clearAllMocks();
      (db.wikiAccountLink.findFirst as jest.Mock).mockResolvedValue(null);
      (db.wikiUserGroup.findMany as jest.Mock).mockResolvedValue([
        { group: "sysop", expiresAt: null },
      ]);
      (db.wikiBlock.findMany as jest.Mock).mockResolvedValue([]);
      (db.wikiRevision.count as jest.Mock).mockResolvedValue(0);
      (db.wikiRestriction.findMany as jest.Mock).mockResolvedValue([]);
    });

    const makeCtx = () => ({
      auth: { userId: "user_clerk" },
      user: { id: "u1", clerkUserId: "user_clerk", createdAt: new Date("2020-01-01") },
    });

    it("keeps only rights both the user and the grants have", async () => {
      const ctx = makeCtx();
      const full = await getWikiPermissions(ctx);
      expect(full.rights.has("delete")).toBe(true);

      const ctx2 = makeCtx();
      const capped = await capWikiPermissions(ctx2, rightsForGrants(["editpage"]));
      expect(capped.rights.has("edit")).toBe(true);
      expect(capped.rights.has("delete")).toBe(false);
      expect(capped.rights.has("block")).toBe(false);
      // a grant never gives a right the user lacks
      const ctx3 = makeCtx();
      (db.wikiUserGroup.findMany as jest.Mock).mockResolvedValue([]);
      const plain = await capWikiPermissions(ctx3, rightsForGrants(["delete", "editpage"]));
      expect(plain.rights.has("delete")).toBe(false);
      expect(plain.rights.has("edit")).toBe(true);
    });

    it("makes authorizeAction and later reads of the same context see the cap", async () => {
      const ctx = makeCtx();
      await capWikiPermissions(ctx, rightsForGrants(["editpage"]));
      await expect(authorizeAction(ctx, "delete", "Foo")).rejects.toThrow(/permissiondenied/);
      await expect(authorizeAction(ctx, "edit", "Foo")).resolves.toBeUndefined();
      expect((await getWikiPermissions(ctx)).rights.has("delete")).toBe(false);
    });
  });
});

describe("session cookie and tokens", () => {
  it("signs a session id and refuses a tampered cookie", () => {
    const cookie = signSessionId("abc123");
    expect(readSessionCookie(cookie)).toBe("abc123");
    expect(readSessionCookie(cookie.replace("abc123", "abc124"))).toBeNull();
    expect(readSessionCookie(`${cookie}x`)).toBeNull();
    expect(readSessionCookie("nodot")).toBeNull();
    expect(readSessionCookie(undefined)).toBeNull();
    expect(readSessionCookie(".sig")).toBeNull();
  });

  it("makes a MediaWiki-shaped token per session and type", () => {
    const csrf = sessionToken("s1", "csrf");
    expect(csrf).toMatch(/^[0-9a-f]{32}\+\\$/);
    expect(csrf).toBe(sessionToken("s1", "csrf"));
    expect(csrf).not.toBe(sessionToken("s2", "csrf"));
    expect(csrf).not.toBe(sessionToken("s1", "rollback"));
  });

  it("validates a bot's token against its session; anyone else only has +\\", () => {
    const bot = { kind: "bot", sessionId: "s1" } as ApiSession;
    expect(tokenIsValid(bot, "csrf", sessionToken("s1", "csrf"))).toBe(true);
    expect(tokenIsValid(bot, "csrf", sessionToken("s2", "csrf"))).toBe(false);
    expect(tokenIsValid(bot, "csrf", TOKEN_SUFFIX)).toBe(false);
    expect(tokenIsValid(bot, "csrf", "")).toBe(false);
    const anonymous = { kind: "anonymous", sessionId: null } as ApiSession;
    expect(tokenIsValid(anonymous, "csrf", TOKEN_SUFFIX)).toBe(true);
    expect(tokenIsValid(anonymous, "csrf", sessionToken("s1", "csrf"))).toBe(false);
  });

  it("derives the login token from a signed nonce, and refuses a forged, tampered or expired one", () => {
    const nonce = newLoginNonce(NOW);
    expect(readLoginNonce(nonce, NOW)).toBe(nonce);
    expect(readLoginNonce(undefined, NOW)).toBeNull();
    expect(readLoginNonce("short", NOW)).toBeNull();
    expect(readLoginNonce(`${nonce}x`, NOW)).toBeNull();
    const [issued, random, signature] = nonce.split(".") as [string, string, string];
    expect(
      readLoginNonce(`${issued}.${random}.${signature.split("").reverse().join("")}`, NOW)
    ).toBeNull();
    // a nonce a client made up, with a valid-looking shape
    expect(readLoginNonce(`${issued}.${"0".repeat(32)}.${signature}`, NOW)).toBeNull();
    expect(loginToken(nonce)).toBe(loginToken(nonce));
    expect(loginToken(nonce)).not.toBe(loginToken(newLoginNonce(NOW)));
  });

  it("expires a login nonce after ten minutes", () => {
    const nonce = newLoginNonce(NOW);
    expect(readLoginNonce(nonce, new Date(NOW.getTime() + 9 * 60 * 1000))).toBe(nonce);
    expect(readLoginNonce(nonce, new Date(NOW.getTime() + 10 * 60 * 1000 + 1000))).toBeNull();
    // one stamped well in the future is not one this server made
    expect(readLoginNonce(nonce, new Date(NOW.getTime() - 5 * 60 * 1000))).toBeNull();
  });
});

describe("cookies", () => {
  const mutableEnv = env as { NODE_ENV: string };
  afterEach(() => {
    mutableEnv.NODE_ENV = "test";
  });

  it("sets HttpOnly, SameSite=Lax and the path; Secure only in production", () => {
    const spec = sessionCookie("sid", "/w/");
    expect(spec).toMatchObject({ name: SESSION_COOKIE, path: "/w/", maxAgeSeconds: 86400 });
    const header = serializeCookie(spec);
    expect(header).toContain(`${SESSION_COOKIE}=`);
    expect(header).toContain("HttpOnly");
    expect(header).toContain("SameSite=Lax");
    expect(header).toContain("Path=/w/");
    expect(header).toContain("Max-Age=86400");
    expect(header).not.toContain("Secure");
    mutableEnv.NODE_ENV = "production";
    expect(serializeCookie(spec)).toContain("Secure");
  });

  it("clears a cookie with Max-Age=0 and sets a short-lived login nonce", () => {
    expect(serializeCookie(clearedSessionCookie("/w/"))).toContain("Max-Age=0");
    expect(loginNonceCookie("n", "/w/").maxAgeSeconds).toBe(600);
  });

  it("reads a cookie out of a Cookie header", () => {
    const header = `a=1; ${SESSION_COOKIE}=${encodeURIComponent("x.y")}; b=2`;
    expect(readCookie(header, SESSION_COOKIE)).toBe("x.y");
    expect(readCookie(header, "missing")).toBeUndefined();
    expect(readCookie(null, "a")).toBeUndefined();
  });
});

describe("loginWithBotPassword", () => {
  const record = async (password: string) => ({
    botPassword: {
      id: "bp1",
      userId: "u1",
      appId: "WikiOS",
      passwordHash: await hashBotPassword(password),
      grants: ["basic", "editpage"],
    },
    user: sysopUser,
  });

  it("starts a 24 hour session and returns the user's name and id on success", async () => {
    const store = storeWith({
      findBotPassword: jest.fn().mockResolvedValue(await record("s3cret")),
    });
    const outcome = await loginWithBotPassword(
      store,
      { name: "Heku@WikiOS", password: "s3cret", now: NOW },
      "/w/"
    );
    expect(outcome).toMatchObject({ result: "Success", userId: 7, username: "Heku" });
    expect(store.findBotPassword).toHaveBeenCalledWith("Heku", "WikiOS");
    const created = store.createSession.mock.calls[0]![0];
    expect(created).toMatchObject({ botPasswordId: "bp1", userId: "u1" });
    expect(created.expiresAt.getTime()).toBe(NOW.getTime() + SESSION_TTL_MS);
    expect(store.touchBotPassword).toHaveBeenCalledWith("bp1", NOW);
    // expired sessions go, and the bot password keeps at most 20
    expect(store.pruneSessions).toHaveBeenCalledWith("bp1", NOW, MAX_SESSIONS_PER_BOT_PASSWORD);
    expect(MAX_SESSIONS_PER_BOT_PASSWORD).toBe(20);
    if (outcome.result === "Success") {
      expect(readSessionCookie(outcome.cookie.value)).toBe(created.id);
      expect(outcome.cookie.path).toBe("/w/");
    }
  });

  it("fails with a reason on a wrong password, an unknown user, or a malformed login name", async () => {
    const wrong = storeWith({
      findBotPassword: jest.fn().mockResolvedValue(await record("right")),
    });
    const failed = {
      result: "Failed",
      reason: expect.stringContaining("Incorrect username or password"),
    };
    expect(
      await loginWithBotPassword(wrong, { name: "Heku@WikiOS", password: "wrong", now: NOW }, "/w/")
    ).toEqual(failed);
    expect(wrong.createSession).not.toHaveBeenCalled();

    const unknown = storeWith();
    expect(
      await loginWithBotPassword(unknown, { name: "Nobody@WikiOS", password: "x", now: NOW }, "/w/")
    ).toEqual(failed);
    expect(
      await loginWithBotPassword(unknown, { name: "no-app-id", password: "x", now: NOW }, "/w/")
    ).toEqual(failed);
    expect(unknown.createSession).not.toHaveBeenCalled();
  });
});

describe("resolveSession", () => {
  const loader = jest.fn<ReturnType<PermissionLoader>, Parameters<PermissionLoader>>();
  beforeEach(() => {
    loader.mockReset();
    loader.mockImplementation(async (_ctx, ceiling) =>
      permissionsOf(ceiling ? [...ceiling] : ["read"])
    );
  });

  const sessionRow = (expiresAt: Date, grants = ["basic", "editpage"]) => ({
    session: { id: "sid", botPasswordId: "bp1", userId: "u1", expiresAt, grants },
    user: sysopUser,
  });
  const identity = (cookie?: string, webAuthId: string | null = null) => ({
    sessionCookie: cookie,
    webAuthId,
    anonymousName: "203.0.113.9",
  });

  it("is a bot session capped at its grants' rights for a valid cookie", async () => {
    const store = storeWith({
      findSession: jest
        .fn()
        .mockResolvedValue(sessionRow(new Date(NOW.getTime() + SESSION_TTL_MS))),
    });
    const session = await resolveSession(identity(signSessionId("sid")), store, loader, NOW);
    expect(session).toMatchObject({ kind: "bot", name: "Heku", userId: 7, sessionId: "sid" });
    expect(session.grants).toEqual(["basic", "editpage"]);
    const ceiling = loader.mock.calls[0]![1]!;
    expect(ceiling.has("edit")).toBe(true);
    expect(ceiling.has("delete")).toBe(false);
    expect(store.extendSession).not.toHaveBeenCalled(); // a fresh session is not rewritten
  });

  it("slides the expiry once less than 23 hours are left", async () => {
    const store = storeWith({
      findSession: jest
        .fn()
        .mockResolvedValue(sessionRow(new Date(NOW.getTime() + 60 * 60 * 1000))),
    });
    await resolveSession(identity(signSessionId("sid")), store, loader, NOW);
    expect(store.extendSession).toHaveBeenCalledWith(
      "sid",
      new Date(NOW.getTime() + SESSION_TTL_MS)
    );
  });

  it("ignores an expired session, an unknown one and a forged cookie", async () => {
    const expired = storeWith({
      findSession: jest.fn().mockResolvedValue(sessionRow(new Date(NOW.getTime() - 1))),
    });
    expect((await resolveSession(identity(signSessionId("sid")), expired, loader, NOW)).kind).toBe(
      "anonymous"
    );
    const unknown = storeWith();
    expect((await resolveSession(identity(signSessionId("sid")), unknown, loader, NOW)).kind).toBe(
      "anonymous"
    );
    const forged = storeWith({
      findSession: jest
        .fn()
        .mockResolvedValue(sessionRow(new Date(NOW.getTime() + SESSION_TTL_MS))),
    });
    expect((await resolveSession(identity("sid.forged"), forged, loader, NOW)).kind).toBe(
      "anonymous"
    );
    expect(forged.findSession).not.toHaveBeenCalled();
  });

  it("treats a signed-in browser user as read-only (web), with their uncapped rights", async () => {
    const store = storeWith({ findWebUser: jest.fn().mockResolvedValue(sysopUser) });
    const session = await resolveSession(identity(undefined, "user_clerk"), store, loader, NOW);
    expect(session).toMatchObject({ kind: "web", name: "Heku", sessionId: null, grants: null });
    expect(loader.mock.calls[0]![1]).toBeNull();
  });

  it("is anonymous, named by address, otherwise", async () => {
    const session = await resolveSession(identity(), storeWith(), loader, NOW);
    expect(session).toMatchObject({ kind: "anonymous", name: "203.0.113.9", userId: 0 });
  });
});
