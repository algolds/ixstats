/**
 * The passport payload carries the canonical handle (`data.handle`), never the URL segment, and says
 * whether the segment should redirect to it (`canonicalRedirect`).
 */
jest.mock("~/server/db", () => {
  const db = {
    user: { update: jest.fn().mockResolvedValue({}) },
    wikiAccountLink: { findFirst: jest.fn().mockResolvedValue(null) },
    userConnection: { findMany: jest.fn().mockResolvedValue([]) },
    passportPreference: { findUnique: jest.fn().mockResolvedValue(null) },
  };
  return { __esModule: true, db, isDatabaseReadOnly: false };
});

jest.mock("~/server/modules/identity/identity.resolve", () => ({
  resolveIdentity: jest.fn(),
  resolveIdentityNations: jest.fn().mockResolvedValue([]),
}));

jest.mock("~/server/modules/identity/identity.vault", () => ({
  resolvePassportVault: jest.fn().mockResolvedValue(null),
}));

jest.mock("~/server/modules/identity/identity.showcase", () => ({
  loadAchievementsShowcase: jest.fn().mockResolvedValue(null),
}));

jest.mock("~/server/modules/identity/identity.loaders", () => ({
  loadWikiInfo: jest.fn().mockResolvedValue(null),
  loadLoreStats: jest.fn().mockResolvedValue(null),
  loadLoreAwards: jest.fn().mockResolvedValue([]),
  loadLoreRank: jest.fn().mockResolvedValue(null),
  loadThinkpagesAccount: jest.fn().mockResolvedValue(null),
  loadClerkProfile: jest.fn().mockResolvedValue(null),
}));

import { beforeEach, describe, expect, it } from "@jest/globals";
import { db } from "~/server/db";
import { getPassport } from "~/server/modules/identity/identity.service";
import { resolveIdentity } from "~/server/modules/identity/identity.resolve";

const mocked = db as unknown as { wikiAccountLink: { findFirst: jest.Mock } };
const forum = { getMember: jest.fn(), lookupUser: jest.fn() } as never;

const user = {
  id: "db_1",
  clerkUserId: "clerk_1",
  handle: "kir" as string | null,
  wikiUsername: null,
  wikiUserId: null,
  forumUserId: null,
  forumUsername: "Kir Forum" as string | null,
  discordUserId: null,
  discordUsername: null,
  role: null,
  createdAt: new Date(),
  countryId: null,
};

function resolvesTo(handle: string, overrides: Partial<typeof user> | null) {
  (resolveIdentity as jest.Mock).mockResolvedValue({
    handle,
    strippedHandle: handle.replace(/_$/, ""),
    user: overrides ? { ...user, ...overrides } : null,
    country: null,
    wikiName: overrides ? null : handle,
    forumUserId: null,
    forumUsername: null,
    isOwner: false,
  });
}

const passport = (handle: string) => getPassport({ handle, viewerClerkId: null }, forum);

describe("getPassport canonical handle", () => {
  beforeEach(() => {
    mocked.wikiAccountLink.findFirst.mockReset().mockResolvedValue(null);
  });

  it("returns the stored handle and no redirect when the URL is the handle", async () => {
    resolvesTo("kir", {});
    const data = await passport("kir");
    expect(data?.handle).toBe("kir");
    expect(data?.canonicalRedirect).toBe(false);
  });

  it("asks a forum-name URL to redirect to the stored handle", async () => {
    resolvesTo("Kir Forum", {});
    const data = await passport("Kir Forum");
    expect(data?.handle).toBe("kir");
    expect(data?.canonicalRedirect).toBe(true);
  });

  it("returns the stored handle for /@me, without a redirect", async () => {
    resolvesTo("me", {});
    const data = await passport("me");
    expect(data?.handle).toBe("kir");
    expect(data?.canonicalRedirect).toBe(false);
  });

  it("falls back to the computed handle, never me, when no handle is stored", async () => {
    resolvesTo("me", { handle: null });
    const data = await passport("me");
    expect(data?.handle).toBe("Kir Forum");
    expect(data?.canonicalRedirect).toBe(false);
  });

  it("prefers a verified wiki name in the computed handle", async () => {
    mocked.wikiAccountLink.findFirst.mockResolvedValue({ username: "Kir Wiki" });
    resolvesTo("me", { handle: null });
    expect((await passport("me"))?.handle).toBe("Kir Wiki");
  });

  it("falls back to the Clerk id when the user has no other name", async () => {
    resolvesTo("me", { handle: null, forumUsername: null });
    expect((await passport("me"))?.handle).toBe("clerk_1");
  });

  it("keeps the URL segment for an external wiki or forum identity", async () => {
    resolvesTo("Some Wiki Editor", null);
    const data = await passport("Some Wiki Editor");
    expect(data?.handle).toBe("Some Wiki Editor");
    expect(data?.canonicalRedirect).toBe(false);
  });
});
