/**
 * SL-4 on the passport: "Show Discord tag" and "Wiki attribution" hide the linked names from
 * other viewers (never from the owner), "Online status" decides the online flag, and "Search
 * engine indexing" decides the page's robots metadata. A read error hides (fails closed).
 */
jest.mock("~/server/db", () => {
  const db = {
    user: { update: jest.fn().mockResolvedValue({}) },
    wikiAccountLink: { findFirst: jest.fn().mockResolvedValue({ username: "Alex" }) },
    userConnection: { findMany: jest.fn().mockResolvedValue([]) },
    passportPreference: { findUnique: jest.fn().mockResolvedValue(null) },
  };
  return { __esModule: true, db, isDatabaseReadOnly: false };
});

jest.mock("~/server/modules/identity/identity.resolve", () => ({
  resolveIdentity: jest.fn(),
  resolveIdentityNations: jest.fn().mockResolvedValue([]),
  resolveHandleOwnerClerkId: jest.fn(),
}));

jest.mock("~/server/modules/identity/identity.vault", () => ({
  resolvePassportVault: jest.fn().mockResolvedValue(null),
}));

jest.mock("~/server/modules/identity/identity.showcase", () => {
  const actual = jest.requireActual("~/server/modules/identity/identity.showcase");
  return { ...actual, loadAchievementsShowcase: jest.fn().mockResolvedValue(null) };
});

jest.mock("~/server/modules/identity/identity.loaders", () => ({
  loadWikiInfo: jest.fn().mockResolvedValue({ exists: true, editCount: 12, groups: ["user"] }),
  loadLoreStats: jest.fn().mockResolvedValue(null),
  loadLoreAwards: jest.fn().mockResolvedValue([]),
  loadLoreRank: jest.fn().mockResolvedValue(null),
  loadThinkpagesAccount: jest.fn().mockResolvedValue(null),
  loadClerkProfile: jest.fn().mockResolvedValue(null),
  loadWikiContribs: jest.fn().mockResolvedValue([]),
  loadNativeRevisions: jest.fn().mockResolvedValue([]),
  loadDiscussionComments: jest.fn().mockResolvedValue([]),
  loadAuthoredArticleRows: jest.fn().mockResolvedValue([]),
  loadConlangs: jest.fn().mockResolvedValue([]),
  loadCreatedPages: jest.fn().mockResolvedValue([]),
  loadDirectives: jest.fn().mockResolvedValue([]),
  loadSportTeams: jest.fn().mockResolvedValue([]),
}));

import { describe, it, expect, beforeEach } from "@jest/globals";
import { db } from "~/server/db";
import { getPassport, getWork } from "~/server/modules/identity/identity.service";
import {
  resolveHandleOwnerClerkId,
  resolveIdentity,
} from "~/server/modules/identity/identity.resolve";
import { loadAuthoredArticleRows } from "~/server/modules/identity/identity.loaders";
import { passportIndexable } from "~/server/modules/identity/identity.link-privacy";
import { recordHeartbeat, resetPresenceForTests } from "~/server/shared/presence";

const findConfigs = (db as unknown as { userConnection: { findMany: jest.Mock } }).userConnection
  .findMany;

const holder = {
  id: "db_1",
  clerkUserId: "clerk_1",
  wikiUsername: "Alex",
  forumUserId: null,
  forumUsername: null,
  discordUserId: "d1",
  discordUsername: "alex#1",
  role: null,
  createdAt: new Date("2024-01-01"),
  countryId: null,
};
const forum = { getMember: jest.fn(), lookupUser: jest.fn() };

function asViewer(viewerClerkId: string | null) {
  (resolveIdentity as jest.Mock).mockResolvedValue({
    handle: "alex",
    strippedHandle: "alex",
    user: holder,
    country: null,
    wikiName: "Alex",
    forumUserId: null,
    forumUsername: null,
    isOwner: viewerClerkId === holder.clerkUserId,
  });
  return { handle: "alex", viewerClerkId };
}

function withConfig(config: Record<string, unknown>) {
  findConfigs.mockResolvedValue([{ userId: "clerk_1", status: JSON.stringify(config) }]);
}

beforeEach(() => {
  jest.clearAllMocks();
  resetPresenceForTests();
  findConfigs.mockResolvedValue([]);
});

describe("linked names on the passport", () => {
  it("shows the Discord tag and wiki name by default", async () => {
    const passport = await getPassport(asViewer(null), forum);
    expect(passport?.discord).toEqual({ linked: true, username: "alex#1" });
    expect(passport?.wiki.username).toBe("Alex");
  });

  it("hides them from visitors when switched off", async () => {
    withConfig({ showDiscordTag: false, showWikiAttribution: false });
    const passport = await getPassport(asViewer("visitor"), forum);
    expect(passport?.discord).toEqual({ linked: false, username: null });
    expect(passport?.wiki).toMatchObject({ linked: false, username: null, editCount: null });
  });

  it("still shows them to the owner", async () => {
    withConfig({ showDiscordTag: false, showWikiAttribution: false });
    const passport = await getPassport(asViewer("clerk_1"), forum);
    expect(passport?.discord.username).toBe("alex#1");
    expect(passport?.wiki.username).toBe("Alex");
  });

  it("hides them when the setting cannot be read", async () => {
    findConfigs.mockRejectedValue(new Error("db down"));
    const passport = await getPassport(asViewer("visitor"), forum);
    expect(passport?.discord.username).toBeNull();
    expect(passport?.wiki.username).toBeNull();
  });

  it("drops wiki articles from the Work tab when attribution is off", async () => {
    withConfig({ showWikiAttribution: false });
    await getWork(asViewer("visitor"));
    expect(loadAuthoredArticleRows).not.toHaveBeenCalled();
  });
});

describe("online flag", () => {
  it("is set only with a recent heartbeat and the setting on", async () => {
    expect((await getPassport(asViewer(null), forum))?.online).toBe(false);
    await recordHeartbeat("clerk_1");
    expect((await getPassport(asViewer(null), forum))?.online).toBe(true);
    withConfig({ showOnlineStatus: false });
    expect((await getPassport(asViewer(null), forum))?.online).toBe(false);
  });
});

describe("passportIndexable (robots metadata)", () => {
  it("is false only when the holder turned search engine indexing off", async () => {
    (resolveHandleOwnerClerkId as jest.Mock).mockResolvedValue("clerk_1");
    expect(await passportIndexable("alex")).toBe(true);
    withConfig({ searchEngineIndexing: false });
    expect(await passportIndexable("alex")).toBe(false);
  });

  it("is true for a handle with no user, false on a read error", async () => {
    (resolveHandleOwnerClerkId as jest.Mock).mockResolvedValue(null);
    expect(await passportIndexable("Some Nation")).toBe(true);
    (resolveHandleOwnerClerkId as jest.Mock).mockRejectedValue(new Error("db down"));
    expect(await passportIndexable("alex")).toBe(false);
  });
});
