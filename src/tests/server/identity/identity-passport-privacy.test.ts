/**
 * Passport privacy is persisted (`PassportPreference`) and enforced server-side: a section the owner
 * hides is absent from the public passport payload for every viewer, not merely hidden in the UI.
 */
jest.mock("~/server/db", () => {
  const db = {
    user: { update: jest.fn().mockResolvedValue({}) },
    wikiAccountLink: { findFirst: jest.fn().mockResolvedValue(null) },
    passportPreference: {
      findUnique: jest.fn().mockResolvedValue(null),
      upsert: jest.fn(),
    },
  };
  return { __esModule: true, db, isDatabaseReadOnly: false };
});

jest.mock("~/server/modules/identity/identity.resolve", () => ({
  resolveIdentity: jest.fn(),
  resolveIdentityNations: jest.fn().mockResolvedValue([]),
}));

jest.mock("~/server/modules/identity/identity.vault", () => ({
  resolvePassportVault: jest.fn(),
}));

jest.mock("~/server/modules/identity/identity.showcase", () => {
  const actual = jest.requireActual("~/server/modules/identity/identity.showcase");
  return { ...actual, loadAchievementsShowcase: jest.fn(), loadUnlocks: jest.fn() };
});

jest.mock("~/server/modules/identity/identity.loaders", () => ({
  loadWikiInfo: jest.fn().mockResolvedValue(null),
  loadLoreStats: jest.fn(),
  loadLoreAwards: jest.fn(),
  loadLoreRank: jest.fn().mockResolvedValue(4),
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
import {
  getHistory,
  getPassport,
  getWork,
  updateOwnPassportSettings,
} from "~/server/modules/identity/identity.service";
import { resolveIdentity } from "~/server/modules/identity/identity.resolve";
import { resolvePassportVault } from "~/server/modules/identity/identity.vault";
import { loadAchievementsShowcase, loadUnlocks } from "~/server/modules/identity/identity.showcase";
import {
  loadLoreAwards,
  loadLoreStats,
  loadWikiContribs,
} from "~/server/modules/identity/identity.loaders";
import {
  DEFAULT_PASSPORT_VISIBILITY,
  redactPassportSections,
  toPassportSettings,
  type PassportSections,
} from "~/server/modules/identity/identity.privacy";

const mocked = db as unknown as {
  passportPreference: { findUnique: jest.Mock; upsert: jest.Mock };
};

const owner = {
  id: "db_1",
  clerkUserId: "clerk_1",
  wikiUsername: "Alex",
  forumUserId: 9,
  forumUsername: "alex",
  discordUserId: null,
  discordUsername: null,
  role: null,
  createdAt: new Date("2024-01-01"),
  countryId: null,
};

const member = {
  user_id: 9,
  username: "alex",
  user_title: "Senator",
  message_count: 120,
  reaction_score: 44,
  trophy_points: 12,
  register_date: 1_600_000_000,
  is_staff: false,
};
const forum = { getMember: jest.fn(), lookupUser: jest.fn() };

const LORE_STATS = {
  totalScore: 900,
  totalBytes: 5000,
  dailyWins: 2,
  dailyRunnerUps: 1,
  weeklyWins: 1,
  monthlyWins: 0,
  currentStreak: 3,
  longestStreak: 7,
};
const AWARD = {
  id: "aw1",
  date: "2026-09-01",
  type: "daily",
  winnerUser: "Alex",
  winnerPage: "Imperial Senate",
  winnerScore: 300,
  runnerUpPage: null,
  runnerUpScore: null,
};
const VAULT = {
  totalCards: 4,
  deckValue: 2000,
  collectorLevel: 3,
  collectorXp: 120,
  xpPerLevel: 1000,
  credits: 5150,
  focus: { categoryCount: 2, categoryTotal: 12, topCategory: "MILITARY" },
  topCards: [],
};
const SHOWCASE = { unlockedCount: 1, totalCount: 76, points: 50, ribbons: [] };

/** A stored preference row with every section hidden. */
const ALL_HIDDEN = {
  showLorewards: false,
  showFocus: false,
  showForumStats: false,
  showVault: false,
  showHistory: false,
  showAchievements: false,
  signature: "  A. Pav  ",
  pinnedRibbonKeys: ["a", "b", "c", "d"],
};

function asViewer(viewerClerkId: string | null) {
  (resolveIdentity as jest.Mock).mockResolvedValue({
    handle: "alex",
    strippedHandle: "alex",
    user: owner,
    country: null,
    wikiName: "Alex",
    forumUserId: 9,
    forumUsername: "alex",
    isOwner: viewerClerkId === owner.clerkUserId,
  });
  return { handle: "alex", viewerClerkId };
}

beforeEach(() => {
  jest.clearAllMocks();
  mocked.passportPreference.findUnique.mockResolvedValue(null);
  forum.getMember.mockResolvedValue(member);
  (loadLoreStats as jest.Mock).mockResolvedValue(LORE_STATS);
  (loadLoreAwards as jest.Mock).mockResolvedValue([AWARD]);
  (resolvePassportVault as jest.Mock).mockResolvedValue(VAULT);
  (loadAchievementsShowcase as jest.Mock).mockResolvedValue(SHOWCASE);
});

describe("toPassportSettings", () => {
  it("defaults every section to visible when the user has no row", () => {
    expect(toPassportSettings(null)).toEqual({
      visibility: DEFAULT_PASSPORT_VISIBILITY,
      signature: null,
      pinnedRibbonKeys: [],
    });
  });

  it("maps stored columns, trims the signature and caps pins at three", () => {
    const settings = toPassportSettings(ALL_HIDDEN);
    expect(Object.values(settings.visibility).every((v) => v === false)).toBe(true);
    expect(settings.signature).toBe("A. Pav");
    expect(settings.pinnedRibbonKeys).toEqual(["a", "b", "c"]);
  });
});

describe("redactPassportSections", () => {
  const sections: PassportSections = {
    lorewards: { ...LORE_STATS, rank: 4 },
    awardHistory: [{ id: "1", date: "d", type: "daily", role: "winner", page: null, score: 1 }],
    forumStats: { userTitle: "Senator", messageCount: 1, reactionScore: 2, trophyPoints: 3 },
    vault: VAULT,
    achievements: SHOWCASE,
  };

  it("keeps everything with the default visibility", () => {
    expect(redactPassportSections(sections, DEFAULT_PASSPORT_VISIBILITY)).toEqual(sections);
  });

  it("drops only the vault focus when Focus is hidden but the vault is shown", () => {
    const out = redactPassportSections(sections, { ...DEFAULT_PASSPORT_VISIBILITY, impact: false });
    expect(out.vault).toEqual({ ...VAULT, focus: null });
    expect(sections.vault?.focus).not.toBeNull(); // input untouched
  });
});

describe("getPassport enforces privacy server-side", () => {
  it("returns every section when nothing is hidden", async () => {
    const passport = await getPassport(asViewer(null), forum);
    expect(passport?.privacy).toEqual(DEFAULT_PASSPORT_VISIBILITY);
    expect(passport?.wiki.lorewards?.totalScore).toBe(900);
    expect(passport?.wiki.awardHistory).toHaveLength(1);
    expect(passport?.forum.stats?.messageCount).toBe(120);
    expect(passport?.vault?.credits).toBe(5150);
    expect(passport?.showcase.achievements).toEqual(SHOWCASE);
  });

  it("does not return hidden sections to a visitor", async () => {
    mocked.passportPreference.findUnique.mockResolvedValue(ALL_HIDDEN);
    const passport = await getPassport(asViewer("someone_else"), forum);

    expect(passport?.wiki.lorewards).toBeNull();
    expect(passport?.wiki.awardHistory).toEqual([]);
    expect(passport?.forum.stats).toBeNull();
    expect(passport?.vault).toBeNull();
    expect(passport?.showcase.achievements).toBeNull();
    // No hidden value leaks anywhere in the serialized payload.
    const json = JSON.stringify(passport);
    expect(json).not.toContain("5150");
    expect(json).not.toContain("Imperial Senate");
    expect(json).not.toContain("Senator");
    // Hidden sections are not even loaded.
    expect(resolvePassportVault).not.toHaveBeenCalled();
    expect(loadLoreStats).not.toHaveBeenCalled();
    expect(loadAchievementsShowcase).not.toHaveBeenCalled();
  });

  it("hides them from the owner too, and returns the saved signature", async () => {
    mocked.passportPreference.findUnique.mockResolvedValue(ALL_HIDDEN);
    const passport = await getPassport(asViewer(owner.clerkUserId), forum);
    expect(passport?.account.isOwner).toBe(true);
    expect(passport?.vault).toBeNull();
    expect(passport?.account.signature).toBe("A. Pav");
    expect(passport?.privacy.vaultCards).toBe(false);
  });

  it("reads the preference row by the user's database id", async () => {
    await getPassport(asViewer(null), forum);
    expect(mocked.passportPreference.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "db_1" } })
    );
  });
});

describe("getHistory / getWork honour privacy", () => {
  it("returns an empty History stream without loading it when the owner hides it", async () => {
    mocked.passportPreference.findUnique.mockResolvedValue(ALL_HIDDEN);
    const page = await getHistory({ ...asViewer(null), limit: 50 });
    expect(page).toEqual({ items: [], nextCursor: null });
    expect(loadWikiContribs).not.toHaveBeenCalled();
  });

  it("leaves Lorewards laurels out of the Work feed when accolades are hidden", async () => {
    mocked.passportPreference.findUnique.mockResolvedValue(ALL_HIDDEN);
    const work = await getWork(asViewer(null));
    expect(loadLoreAwards).not.toHaveBeenCalled();
    expect(work.wikiActivityFeed.some((item) => item.type === "laurel")).toBe(false);
  });

  it("includes laurels when accolades are shown", async () => {
    const work = await getWork(asViewer(null));
    expect(work.wikiActivityFeed.some((item) => item.type === "laurel")).toBe(true);
  });
});

describe("updateOwnPassportSettings", () => {
  const user = { id: "db_1", clerkUserId: "clerk_1" };

  beforeEach(() => {
    mocked.passportPreference.upsert.mockImplementation(async ({ create }) => ({
      ...ALL_HIDDEN,
      showLorewards: true,
      showFocus: true,
      showForumStats: true,
      showHistory: true,
      showAchievements: true,
      showVault: create.showVault ?? true,
      signature: create.signature ?? null,
      pinnedRibbonKeys: create.pinnedRibbonKeys ?? [],
    }));
    (loadUnlocks as jest.Mock).mockResolvedValue([
      { achievementId: "econ-first-million" },
      { achievementId: "mil-first-branch" },
    ]);
  });

  it("persists a visibility change against the user's own row", async () => {
    const saved = await updateOwnPassportSettings(user, { visibility: { vaultCards: false } });
    expect(mocked.passportPreference.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "db_1" },
        create: { userId: "db_1", showVault: false },
        update: { showVault: false },
      })
    );
    expect(saved.visibility.vaultCards).toBe(false);
  });

  it("keeps only pins for achievements the user has unlocked", async () => {
    await updateOwnPassportSettings(user, {
      pinnedRibbonKeys: ["mil-first-branch", "not-mine", "econ-first-million"],
    });
    expect(loadUnlocks).toHaveBeenCalledWith("clerk_1");
    expect(mocked.passportPreference.upsert.mock.calls[0]![0].update).toEqual({
      pinnedRibbonKeys: ["mil-first-branch", "econ-first-million"],
    });
  });

  it("stores a blank signature as null", async () => {
    await updateOwnPassportSettings(user, { signature: "   " });
    expect(mocked.passportPreference.upsert.mock.calls[0]![0].update).toEqual({ signature: null });
  });
});
