/**
 * SL-4 on the passport: "Wiki attribution" hides the linked wiki name from other viewers (never
 * from the owner), "Online status" decides the online flag, and "Search engine indexing" decides the
 * page's robots metadata. A read error hides (fails closed). The passport carries no Discord tag.
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
  resolveHandleUser: jest.fn().mockResolvedValue(null),
}));

jest.mock("~/server/modules/identity/identity.vault", () => ({
  resolvePassportVault: jest.fn().mockResolvedValue(null),
}));

jest.mock("~/server/modules/identity/identity.showcase", () => {
  const actual = jest.requireActual("~/server/modules/identity/identity.showcase");
  return { ...actual, loadAchievementsShowcase: jest.fn().mockResolvedValue(null) };
});

jest.mock("~/server/modules/identity/identity.loaders", () => ({
  loadWikiInfo: jest.fn().mockResolvedValue({ exists: true }),
  loadLoreStats: jest.fn().mockResolvedValue(null),
  loadLoreAwards: jest.fn().mockResolvedValue([]),
  loadLoreRank: jest.fn().mockResolvedValue(null),
  loadPersonalPersona: jest.fn().mockResolvedValue(null),
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
import { getHistory, getPassport, getWork } from "~/server/modules/identity/identity.service";
import {
  resolveHandleOwnerClerkId,
  resolveIdentity,
} from "~/server/modules/identity/identity.resolve";
import {
  loadAuthoredArticleRows,
  loadLoreAwards,
  loadLoreStats,
  loadNativeRevisions,
  loadWikiContribs,
} from "~/server/modules/identity/identity.loaders";
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
  createdAt: new Date("2024-01-01"),
  countryId: null,
};
const forum = {
  getActivity: jest.fn().mockResolvedValue({ posts: 0, threads: 0 }),
  lookupUser: jest.fn(),
};
const REVISION = {
  id: "rev1",
  summary: "Expanded the history section",
  minor: false,
  parked: false,
  createdAt: new Date("2026-09-01"),
  article: { title: "Imperial Senate", slug: "imperial-senate" },
};

function asViewer(viewerClerkId: string | null) {
  (resolveIdentity as jest.Mock).mockResolvedValue({
    handle: "alex",
    strippedHandle: "alex",
    user: holder,
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
  (loadNativeRevisions as jest.Mock).mockResolvedValue([]);
});

describe("linked names on the passport", () => {
  it("shows the wiki name by default, and never a Discord tag", async () => {
    const passport = await getPassport(asViewer(null), forum);
    expect(passport?.wiki).toMatchObject({ linked: true, username: "Alex" });
    expect(passport).not.toHaveProperty("discord");
    expect(JSON.stringify(passport)).not.toContain("alex#1");
  });

  it("hides it from visitors when switched off", async () => {
    withConfig({ showWikiAttribution: false });
    const passport = await getPassport(asViewer("visitor"), forum);
    expect(passport?.wiki).toMatchObject({ linked: false, username: null });
  });

  it("still shows it to the owner", async () => {
    withConfig({ showWikiAttribution: false });
    const passport = await getPassport(asViewer("clerk_1"), forum);
    expect(passport?.wiki.username).toBe("Alex");
  });

  it("hides it when the setting cannot be read", async () => {
    findConfigs.mockRejectedValue(new Error("db down"));
    const passport = await getPassport(asViewer("visitor"), forum);
    expect(passport?.wiki).toMatchObject({ linked: false, username: null });
  });

  it("drops wiki articles from the Work tab when attribution is off", async () => {
    withConfig({ showWikiAttribution: false });
    await getWork(asViewer("visitor"));
    expect(loadAuthoredArticleRows).not.toHaveBeenCalled();
  });

  it("drops wiki items from the History tab when attribution is off", async () => {
    (loadNativeRevisions as jest.Mock).mockResolvedValue([REVISION]);
    withConfig({ showWikiAttribution: false });
    const page = await getHistory({ ...asViewer("visitor"), limit: 50 });
    expect(page.items.some((item) => item.system === "wikios")).toBe(false);
    expect(page.items.map((item) => item.type)).toEqual(["realm.joined"]);
    expect(loadWikiContribs).not.toHaveBeenCalled();
    expect(loadNativeRevisions).not.toHaveBeenCalled();
  });

  it("links the History join event to the stored handle, not the URL segment", async () => {
    (resolveIdentity as jest.Mock).mockResolvedValue({
      handle: "Alex Legacy",
      strippedHandle: "Alex Legacy",
      user: { ...holder, handle: "alex_h" },
      wikiName: "Alex",
      forumUserId: null,
      forumUsername: null,
      isOwner: false,
    });
    const page = await getHistory({ handle: "Alex Legacy", viewerClerkId: null, limit: 50 });
    expect(page.items.find((item) => item.type === "realm.joined")?.objectUrl).toBe("/@alex_h");
  });

  it("keeps wiki items in the History tab for the owner", async () => {
    (loadNativeRevisions as jest.Mock).mockResolvedValue([REVISION]);
    withConfig({ showWikiAttribution: false });
    const page = await getHistory({ ...asViewer("clerk_1"), limit: 50 });
    expect(page.items.some((item) => item.system === "wikios")).toBe(true);
  });
});

describe("Lorewards and wiki attribution", () => {
  const STATS = {
    totalScore: 1200,
    totalBytes: 0,
    dailyWins: 1,
    dailyRunnerUps: 0,
    weeklyWins: 0,
    monthlyWins: 0,
    currentStreak: 0,
    longestStreak: 2,
  };

  beforeEach(() => {
    (loadLoreStats as jest.Mock).mockResolvedValue(STATS);
  });

  it("are hidden from visitors, and not loaded, when wiki attribution is off", async () => {
    withConfig({ showWikiAttribution: false });
    const passport = await getPassport(asViewer("visitor"), forum);
    expect(passport?.wiki.lorewards).toBeNull();
    expect(passport?.wiki.awardHistory).toEqual([]);
    expect(loadLoreStats).not.toHaveBeenCalled();
    expect(loadLoreAwards).not.toHaveBeenCalled();
  });

  it("are still shown to the owner when wiki attribution is off", async () => {
    withConfig({ showWikiAttribution: false });
    const passport = await getPassport(asViewer("clerk_1"), forum);
    expect(passport?.wiki.lorewards).toMatchObject({ totalScore: 1200 });
  });

  it("are shown to visitors when wiki attribution is on", async () => {
    const passport = await getPassport(asViewer("visitor"), forum);
    expect(passport?.wiki.lorewards).toMatchObject({ totalScore: 1200 });
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
