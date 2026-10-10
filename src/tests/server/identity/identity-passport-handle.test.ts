/** @jest-environment node */
/**
 * The passport payload carries the passport handle (`data.handle`, `passportHandleOf`), never the URL
 * segment: stored handle, verified wiki name, forum name, Clerk id. A computed name is used only when
 * it resolves back to the holder.
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
  resolveHandleUser: jest.fn(),
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
  loadPersonalPersona: jest.fn().mockResolvedValue(null),
  loadClerkProfile: jest.fn().mockResolvedValue(null),
}));

import { beforeEach, describe, expect, it } from "@jest/globals";
import { db } from "~/server/db";
import { getPassport } from "~/server/modules/identity/identity.service";
import { resolveHandleUser, resolveIdentity } from "~/server/modules/identity/identity.resolve";

const mocked = db as unknown as { wikiAccountLink: { findFirst: jest.Mock } };
const forum = {
  getActivity: jest.fn().mockResolvedValue({ posts: 0, threads: 0 }),
  lookupUser: jest.fn(),
} as never;

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
  createdAt: new Date(),
  countryId: null,
};

function resolvesTo(handle: string, overrides: Partial<typeof user> | null) {
  (resolveIdentity as jest.Mock).mockResolvedValue({
    handle,
    strippedHandle: handle.replace(/_$/, ""),
    user: overrides ? { ...user, ...overrides } : null,
    wikiName: overrides ? null : handle,
    forumUserId: null,
    forumUsername: null,
    isOwner: false,
  });
}

const passport = (handle: string) => getPassport({ handle, viewerClerkId: null }, forum);

describe("getPassport canonical handle", () => {
  const owners = (byName: Record<string, string>) =>
    (resolveHandleUser as jest.Mock).mockImplementation((name: string) =>
      Promise.resolve(byName[name] ? { id: byName[name] } : null)
    );

  beforeEach(() => {
    mocked.wikiAccountLink.findFirst.mockReset().mockResolvedValue(null);
    owners({ "Kir Forum": "db_1", "Kir Wiki": "db_1" });
  });

  it("returns the stored handle whatever the URL segment", async () => {
    for (const segment of ["kir", "Kir Forum", "me"]) {
      resolvesTo(segment, {});
      const data = await passport(segment);
      expect(data?.handle).toBe("kir");
      expect(data).not.toHaveProperty("canonicalRedirect");
    }
  });

  it("falls back to the forum name, never the segment, when no handle is stored", async () => {
    resolvesTo("me", { handle: null });
    expect((await passport("me"))?.handle).toBe("Kir Forum");
  });

  it("prefers a verified wiki name in the computed handle", async () => {
    mocked.wikiAccountLink.findFirst.mockResolvedValue({ username: "Kir Wiki" });
    resolvesTo("me", { handle: null });
    expect((await passport("me"))?.handle).toBe("Kir Wiki");
  });

  it("skips a name that resolves to someone else", async () => {
    mocked.wikiAccountLink.findFirst.mockResolvedValue({ username: "Kir Wiki" });
    owners({ "Kir Wiki": "db_other", "Kir Forum": "db_1" });
    resolvesTo("me", { handle: null });
    expect((await passport("me"))?.handle).toBe("Kir Forum");
  });

  it("falls back to the Clerk id when the user has no other name", async () => {
    resolvesTo("me", { handle: null, forumUsername: null });
    expect((await passport("me"))?.handle).toBe("clerk_1");
  });

  it("keeps the URL segment for an external wiki or forum identity", async () => {
    resolvesTo("Some Wiki Editor", null);
    expect((await passport("Some Wiki Editor"))?.handle).toBe("Some Wiki Editor");
  });
});
