/** @jest-environment node */
/**
 * The IxStates Passport as the identity service builds it (getPassport, getWork, getHistory, getRealms,
 * getPassportCard, the page metadata and the ribbon racks), with identity resolution and the external loaders
 * (MediaWiki, XenForo, Clerk, the Vault) stubbed.
 *
 * Privacy is persisted (`PassportPreference`) and enforced server-side: a section the owner hides is absent from the
 * payload for every viewer, the owner included, and is not even loaded. A wiki name's work, history and Lorewards
 * follow its claim's visibility (the resolver names the identity's wiki name), never a switch; "Online status" decides
 * the online flag and "Search engine indexing" the robots metadata; a switch that cannot be read hides. The payload
 * carries the passport handle, never the URL segment. A public read writes nothing, reports the wiki "linked" only for
 * an approved name claim the holder shows (a hidden claim links nothing) and asks MediaWiki nothing for a user. Realm
 * rows carry the realm role, never the site role. The card and page metadata make no external call and carry no
 * personal field; with link previews off they are generic.
 *
 * Folds identity-passport-handle, -link-privacy, -wiki, -realms, -card, -metadata and identity-showcase-ribbons. A
 * hidden claim on the passport, in its handle, in player names and on the mirror is security-hidden-wiki-claim's.
 */
jest.mock("~/server/db", () => {
  const db = {
    user: { findUnique: jest.fn(), update: jest.fn() },
    country: { findUnique: jest.fn() },
    wikiNameClaim: { findMany: jest.fn() },
    userConnection: { findMany: jest.fn() },
    passportPreference: { findUnique: jest.fn(), upsert: jest.fn() },
    realm: { findMany: jest.fn() },
    realmClaim: { findMany: jest.fn() },
    userAchievement: { findMany: jest.fn() },
    achievement: { count: jest.fn() },
  };
  return { __esModule: true, db, isDatabaseReadOnly: false };
});
jest.mock("~/server/modules/identity/identity.resolve", () => ({
  resolveIdentity: jest.fn(),
  resolveUserIdentity: jest.fn(),
  resolveIdentityNations: jest.fn(),
  resolveHandleUser: jest.fn(),
  resolveHandleOwnerClerkId: jest.fn(),
}));
jest.mock("~/server/modules/identity/identity.vault", () => ({ resolvePassportVault: jest.fn() }));
jest.mock("~/server/modules/identity/identity.showcase", () => ({
  ...jest.requireActual("~/server/modules/identity/identity.showcase"),
  loadAchievementsShowcase: jest.fn(),
  loadUnlocks: jest.fn(),
}));
jest.mock("~/server/modules/identity/identity.loaders", () => ({
  loadWikiInfo: jest.fn(),
  loadLoreStats: jest.fn(),
  loadLoreAwards: jest.fn(),
  loadLoreRank: jest.fn(),
  loadPersonalPersona: jest.fn(),
  loadClerkProfile: jest.fn(),
  loadWikiContribs: jest.fn(),
  loadNativeRevisions: jest.fn(),
  loadDiscussionComments: jest.fn(),
  loadAuthoredArticleRows: jest.fn(),
  loadConlangs: jest.fn(),
  loadCreatedPages: jest.fn(),
  loadDirectives: jest.fn(),
  loadSportTeams: jest.fn(),
}));

import { beforeEach, describe, expect, it } from "@jest/globals";
import { db } from "~/server/db";
import { createCallerFactory } from "~/server/api/trpc";
import { ixnayidPassportRouter } from "~/server/api/routers/ixnayid/passport";
import {
  getHistory,
  getPassport,
  getPassportCard,
  getRealms,
  getWork,
  updateOwnPassportSettings,
} from "~/server/modules/identity/identity.service";
import {
  resolveHandleOwnerClerkId,
  resolveHandleUser,
  resolveIdentity,
  resolveIdentityNations,
  resolveUserIdentity,
} from "~/server/modules/identity/identity.resolve";
import { resolvePassportVault } from "~/server/modules/identity/identity.vault";
import {
  loadAchievementsShowcase,
  loadUnlocks,
  validPinnedKeys,
} from "~/server/modules/identity/identity.showcase";
import * as loaders from "~/server/modules/identity/identity.loaders";
import {
  DEFAULT_PASSPORT_VISIBILITY,
  redactPassportSections,
  toPassportSettings,
  type PassportSections,
} from "~/server/modules/identity/identity.privacy";
import {
  passportIndexable,
  passportMetadata,
  passportPageMetadata,
} from "~/server/modules/identity/identity.metadata";
import type { IdentityCountry } from "~/server/modules/identity/identity.selects";
import { recordHeartbeat, resetPresenceForTests } from "~/server/shared/presence";
import { createMockRouterContext } from "~/tests/helpers/router-context";

const mocked = db as unknown as {
  user: { findUnique: jest.Mock; update: jest.Mock };
  country: { findUnique: jest.Mock };
  wikiNameClaim: { findMany: jest.Mock };
  userConnection: { findMany: jest.Mock };
  passportPreference: { findUnique: jest.Mock; upsert: jest.Mock };
  realm: { findMany: jest.Mock };
  realmClaim: { findMany: jest.Mock };
  userAchievement: { findMany: jest.Mock };
  achievement: { count: jest.Mock };
};
const loader = loaders as unknown as Record<keyof typeof loaders, jest.Mock>;
const forum = { getActivity: jest.fn(), lookupUser: jest.fn() };

const holder = {
  id: "db_1",
  clerkUserId: "clerk_1",
  handle: null as string | null,
  forumUserId: 9 as number | null,
  forumUsername: "alex" as string | null,
  discordUserId: "d1",
  discordUsername: "alex#1",
  createdAt: new Date("2024-01-01"),
  countryId: null as string | null,
};
type Holder = typeof holder;

/**
 * The passport `handle` resolves to `user` (null: an external wiki or forum name), as `viewerClerkId` reads it. The
 * user's `wikiName` (the shown claimed name `identity.resolve.ts` gives them) is "Alex" unless the case sets it.
 */
function resolvesTo(
  viewerClerkId: string | null,
  user: (Partial<Holder> & { wikiName?: string | null }) | null = {},
  handle = "alex"
) {
  const { wikiName = "Alex", ...fields } = user ?? {};
  const row = user && { ...holder, ...fields };
  const identity = {
    handle,
    strippedHandle: handle.replace(/_$/, ""),
    user: row,
    wikiName: row ? wikiName : handle,
    forumUserId: row?.forumUserId ?? null,
    forumUsername: row?.forumUsername ?? null,
    isOwner: Boolean(row && viewerClerkId === row.clerkUserId),
  };
  (resolveIdentity as jest.Mock).mockResolvedValue(identity);
  (resolveUserIdentity as jest.Mock).mockResolvedValue(row ? identity : null);
  return { handle, viewerClerkId };
}

/** The holder's approved name claims, oldest first (a string is a shown one); a `shown` read keeps the visible ones. */
function claimed(...claims: Array<string | { name: string; visible: boolean }>) {
  const rows = claims.map((c) => (typeof c === "string" ? { name: c, visible: true } : c));
  mocked.wikiNameClaim.findMany.mockImplementation(
    async ({ where }: { where: { visible?: boolean } }) =>
      rows
        .filter((row) => !where.visible || row.visible)
        .map((row) => ({ userId: holder.id, ...row }))
  );
}

/** The holder's stored privacy switches (Settings → Privacy & Security). */
const switches = (config: Record<string, boolean>) =>
  mocked.userConnection.findMany.mockResolvedValue([
    { userId: holder.clerkUserId, status: JSON.stringify(config) },
  ]);

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
const REVISION = {
  id: "rev1",
  summary: "Expanded the history section",
  minor: false,
  parked: false,
  createdAt: new Date("2026-09-01"),
  article: { title: "Imperial Senate", slug: "imperial-senate" },
};
const SHOWN = {
  showLorewards: true,
  showFocus: true,
  showForumStats: true,
  showVault: true,
  showHistory: true,
  showAchievements: true,
  showLinkPreview: true,
  signature: "A. Pav",
  pinnedRibbonKeys: [] as string[],
};
/** A stored preference row with every section hidden. */
const ALL_HIDDEN = {
  showLorewards: false,
  showFocus: false,
  showForumStats: false,
  showVault: false,
  showHistory: false,
  showAchievements: false,
  showLinkPreview: false,
  signature: "  A. Pav  ",
  pinnedRibbonKeys: ["a", "b", "c", "d"],
};

beforeEach(() => {
  jest.resetAllMocks();
  resetPresenceForTests();
  mocked.user.update.mockResolvedValue({});
  mocked.country.findUnique.mockResolvedValue(null);
  claimed();
  mocked.userConnection.findMany.mockResolvedValue([]);
  mocked.passportPreference.findUnique.mockResolvedValue(null);
  mocked.realm.findMany.mockResolvedValue([]);
  mocked.realmClaim.findMany.mockResolvedValue([]);
  mocked.userAchievement.findMany.mockResolvedValue([]);
  mocked.achievement.count.mockResolvedValue(76);
  (resolveIdentityNations as jest.Mock).mockResolvedValue([]);
  (resolveHandleUser as jest.Mock).mockResolvedValue(null);
  (resolveHandleOwnerClerkId as jest.Mock).mockResolvedValue(null);
  (resolvePassportVault as jest.Mock).mockResolvedValue(null);
  (loadAchievementsShowcase as jest.Mock).mockResolvedValue(null);
  (loadUnlocks as jest.Mock).mockResolvedValue([]);
  for (const name of [
    "loadWikiInfo",
    "loadLoreStats",
    "loadLoreRank",
    "loadPersonalPersona",
    "loadClerkProfile",
  ] as const) {
    loader[name].mockResolvedValue(null);
  }
  for (const name of [
    "loadLoreAwards",
    "loadWikiContribs",
    "loadNativeRevisions",
    "loadDiscussionComments",
    "loadAuthoredArticleRows",
    "loadConlangs",
    "loadCreatedPages",
    "loadDirectives",
    "loadSportTeams",
  ] as const) {
    loader[name].mockResolvedValue([]);
  }
  forum.getActivity.mockResolvedValue({ posts: 0, threads: 0 });
});

describe("the sections the owner hides", () => {
  beforeEach(() => {
    forum.getActivity.mockResolvedValue({ posts: 120, threads: 7 });
    loader.loadLoreStats.mockResolvedValue(LORE_STATS);
    loader.loadLoreAwards.mockResolvedValue([AWARD]);
    loader.loadLoreRank.mockResolvedValue(4);
    (resolvePassportVault as jest.Mock).mockResolvedValue(VAULT);
    (loadAchievementsShowcase as jest.Mock).mockResolvedValue(SHOWCASE);
  });

  it("are all there when nothing is hidden, read from the holder's own preference row", async () => {
    expect(toPassportSettings(null)).toEqual({
      visibility: DEFAULT_PASSPORT_VISIBILITY,
      signature: null,
      pinnedRibbonKeys: [],
    });
    const passport = await getPassport(resolvesTo(null), forum);
    expect(passport?.privacy).toEqual(DEFAULT_PASSPORT_VISIBILITY);
    expect(passport?.wiki.lorewards?.totalScore).toBe(900);
    expect(passport?.forum).toEqual({
      linked: true,
      username: "alex",
      stats: { messageCount: 120, threadCount: 7 },
    });
    expect(forum.getActivity).toHaveBeenCalledWith(holder.id);
    expect(passport?.vault?.credits).toBe(5150);
    expect(passport?.showcase.achievements).toEqual(SHOWCASE);
    expect(mocked.passportPreference.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "db_1" } })
    );
  });

  it("are absent for a visitor, and not even loaded", async () => {
    mocked.passportPreference.findUnique.mockResolvedValue(ALL_HIDDEN);
    const passport = await getPassport(resolvesTo("someone_else"), forum);
    expect(passport?.wiki.lorewards).toBeNull();
    expect(passport?.forum.stats).toBeNull();
    expect(passport?.vault).toBeNull();
    expect(passport?.showcase.achievements).toBeNull();
    const json = JSON.stringify(passport);
    expect(json).not.toContain("5150");
    expect(json).not.toContain("Imperial Senate");
    expect(resolvePassportVault).not.toHaveBeenCalled();
    expect(loader.loadLoreStats).not.toHaveBeenCalled();
    expect(loadAchievementsShowcase).not.toHaveBeenCalled();
  });

  it("are absent for the owner too, who gets the saved signature, trimmed", async () => {
    mocked.passportPreference.findUnique.mockResolvedValue(ALL_HIDDEN);
    const passport = await getPassport(resolvesTo(holder.clerkUserId), forum);
    expect(passport?.account.isOwner).toBe(true);
    expect(passport?.vault).toBeNull();
    expect(passport?.account.signature).toBe("A. Pav");
    expect(passport?.privacy.vaultCards).toBe(false);
  });

  it("drop only the vault focus when Focus is hidden but the vault is shown", () => {
    const sections: PassportSections = {
      lorewards: { ...LORE_STATS, rank: 4, names: [] },
      forumStats: { messageCount: 1, threadCount: 2 },
      vault: VAULT,
      achievements: SHOWCASE,
    };
    const out = redactPassportSections(sections, { ...DEFAULT_PASSPORT_VISIBILITY, impact: false });
    expect(out.vault).toEqual({ ...VAULT, focus: null });
    expect(sections.vault?.focus).not.toBeNull(); // input untouched
  });

  it("leave an empty History stream, not loaded, when History is hidden", async () => {
    mocked.passportPreference.findUnique.mockResolvedValue(ALL_HIDDEN);
    expect(await getHistory({ ...resolvesTo(null), limit: 50 })).toEqual({
      items: [],
      nextCursor: null,
    });
    expect(loader.loadWikiContribs).not.toHaveBeenCalled();
  });

  it("keep Lorewards laurels out of the Work feed only while accolades are hidden", async () => {
    const shown = await getWork(resolvesTo(null));
    expect(shown.wikiActivityFeed.some((item) => item.type === "laurel")).toBe(true);
    mocked.passportPreference.findUnique.mockResolvedValue(ALL_HIDDEN);
    loader.loadLoreAwards.mockClear();
    const hidden = await getWork(resolvesTo(null));
    expect(loader.loadLoreAwards).not.toHaveBeenCalled();
    expect(hidden.wikiActivityFeed.some((item) => item.type === "laurel")).toBe(false);
  });
});

describe("what the passport carries", () => {
  it("only the fields it shows: no role, no Discord tag, the bio of the personal persona only", async () => {
    loader.loadPersonalPersona.mockResolvedValue({
      displayName: "Alex",
      profileImageUrl: null,
      bio: "Cartographer of the southern sea.",
    });
    const passport = await getPassport(resolvesTo(null), forum);
    expect(Object.keys(passport ?? {}).sort()).toEqual(
      [
        "account",
        "forum",
        "handle",
        "nationCount",
        "online",
        "primaryNation",
        "privacy",
        "realmCount",
        "recruitedCount",
        "showcase",
        "thinkpages",
        "vault",
        "wiki",
      ].sort()
    );
    expect(passport?.account).not.toHaveProperty("roleName");
    expect(JSON.stringify(passport)).not.toContain("alex#1");
    expect(passport?.thinkpages.bio).toBe("Cartographer of the southern sea.");
    expect(loader.loadPersonalPersona).toHaveBeenCalledWith(
      expect.objectContaining({ id: "db_1" })
    );
  });

  it.each([
    ["the stored handle, whatever the URL segment", { handle: "kir" }, "Kir Forum", "kir"],
    [
      "the forum name, never the segment, with no stored handle",
      { forumUsername: "Kir Forum" },
      "me",
      "Kir Forum",
    ],
    [
      "the Clerk id when the user has no other name",
      { forumUsername: null, wikiName: null },
      "me",
      "clerk_1",
    ],
  ])("the passport handle: %s", async (_case, user, segment, handle) => {
    (resolveHandleUser as jest.Mock).mockImplementation(async (name: string) =>
      name === "Kir Forum" ? { id: "db_1" } : null
    );
    const passport = await getPassport(resolvesTo(null, user, segment), forum);
    expect(passport?.handle).toBe(handle);
    expect(passport).not.toHaveProperty("canonicalRedirect");
  });

  it("the shown claimed name in the handle only when it resolves back to the holder", async () => {
    claimed("Kir Wiki");
    const owners = (byName: Record<string, string>) =>
      (resolveHandleUser as jest.Mock).mockImplementation(async (name: string) =>
        byName[name] ? { id: byName[name] } : null
      );
    owners({ "Kir Forum": "db_1", "Kir Wiki": "db_1" });
    const user = { forumUsername: "Kir Forum", wikiName: null };
    expect((await getPassport(resolvesTo(null, user, "me"), forum))?.handle).toBe("Kir Wiki");
    owners({ "Kir Wiki": "db_other", "Kir Forum": "db_1" });
    expect((await getPassport(resolvesTo(null, user, "me"), forum))?.handle).toBe("Kir Forum");
  });

  it("never a hidden claimed name in the handle, even the owner's", async () => {
    claimed({ name: "Kir Secret", visible: false });
    (resolveHandleUser as jest.Mock).mockResolvedValue({ id: "db_1" });
    const user = { forumUsername: "Kir Forum", wikiName: null };
    expect((await getPassport(resolvesTo("clerk_1", user, "me"), forum))?.handle).toBe("Kir Forum");
    expect(resolveHandleUser).not.toHaveBeenCalledWith("Kir Secret");
  });

  it("the URL segment only for an external wiki or forum identity", async () => {
    expect((await getPassport(resolvesTo(null, null, "Some Wiki Editor"), forum))?.handle).toBe(
      "Some Wiki Editor"
    );
  });

  it("an online flag only with a recent heartbeat and the setting on", async () => {
    expect((await getPassport(resolvesTo(null), forum))?.online).toBe(false);
    await recordHeartbeat("clerk_1");
    expect((await getPassport(resolvesTo(null), forum))?.online).toBe(true);
    switches({ showOnlineStatus: false });
    expect((await getPassport(resolvesTo(null), forum))?.online).toBe(false);
  });
});

describe("the wiki block of a public read", () => {
  // The pre-fix bridge fabricated user_id 1 and an edit count from the Lorewards score.
  const LIVE = { exists: true, userId: 77, user_id: 77, editCount: 1234, groups: ["sysop"] };
  /** A user whose wiki name was derived from their country name ("Kir Republic"). */
  const countryDerived = () =>
    resolvesTo(
      null,
      { wikiName: "Kir Republic", forumUserId: null, forumUsername: null, countryId: "c1" },
      "kir-republic"
    );

  it("writes nothing and is not linked without an approved claim, even with a wiki name", async () => {
    loader.loadWikiInfo.mockResolvedValue({
      exists: true,
      userId: 1,
      user_id: 1,
      editCount: 40,
      groups: ["user"],
    });
    const passport = await getPassport(countryDerived(), forum);
    expect(passport?.wiki.linked).toBe(false);
    expect(mocked.user.update).not.toHaveBeenCalled();
  });

  it("is linked once the holder shows an approved claim, and carries no edit count or groups, asking MediaWiki nothing", async () => {
    claimed("Kir Republic");
    loader.loadWikiInfo.mockResolvedValue(LIVE);
    const passport = await getPassport(countryDerived(), forum);
    expect(passport?.wiki.linked).toBe(true);
    expect(mocked.wikiNameClaim.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { source: "ixwiki", userId: { in: ["db_1"] }, status: "APPROVED", visible: true },
      })
    );
    expect(Object.keys(passport?.wiki ?? {}).sort()).toEqual(["linked", "lorewards", "username"]);
    expect(loader.loadWikiInfo).not.toHaveBeenCalled();
  });

  it("is not linked by a hidden claim", async () => {
    claimed({ name: "Kir Republic", visible: false });
    expect((await getPassport(countryDerived(), forum))?.wiki.linked).toBe(false);
  });

  it("reports an external wiki name as linked when MediaWiki knows it", async () => {
    loader.loadWikiInfo.mockResolvedValue({
      exists: true,
      userId: 0,
      user_id: 0,
      editCount: 0,
      groups: [],
    });
    const passport = await getPassport(resolvesTo(null, null, "Some Editor"), forum);
    expect(passport?.wiki).toMatchObject({ linked: true, username: "Some Editor" });
    expect(loader.loadWikiInfo).toHaveBeenCalledWith("Some Editor");
  });
});

describe("the work, the history and the Lorewards of a shown claim", () => {
  beforeEach(() => {
    claimed("Alex");
    loader.loadLoreStats.mockResolvedValue({ ...LORE_STATS, totalScore: 1200 });
  });

  it("lists the wiki articles on the Work tab and the wiki items in History for a visitor", async () => {
    loader.loadNativeRevisions.mockResolvedValue([REVISION]);
    await getWork(resolvesTo("visitor"));
    expect(loader.loadAuthoredArticleRows).toHaveBeenCalled();
    const page = await getHistory({ ...resolvesTo("visitor"), limit: 50 });
    expect(page.items.some((item) => item.system === "wikios")).toBe(true);
  });

  it("links the History join event to the stored handle, else the passport handle, never the segment or a hidden name", async () => {
    const stored = await getHistory({
      ...resolvesTo(null, { handle: "alex_h" }, "Alex Legacy"),
      limit: 50,
    });
    expect(stored.items.find((item) => item.type === "realm.joined")?.objectUrl).toBe("/@alex_h");

    (resolveHandleUser as jest.Mock).mockResolvedValue({ id: holder.id });
    // A hidden claim gives the identity no wiki name (identity.resolve.ts), and the handle chain skips it
    claimed({ name: "Alex", visible: false });
    const chain = await getHistory({
      ...resolvesTo("visitor", { forumUsername: null, wikiName: null }),
      limit: 50,
    });
    expect(chain.items.find((item) => item.type === "realm.joined")?.objectUrl).toBe("/@clerk_1");
    expect(JSON.stringify(chain)).not.toContain("Alex");
  });

  it.each([
    ["a visitor", "visitor"],
    ["the owner", "clerk_1"],
  ])("shows the Lorewards to %s", async (_who, viewer) => {
    const passport = await getPassport(resolvesTo(viewer), forum);
    expect(passport?.wiki.lorewards).toMatchObject({ totalScore: 1200 });
  });
});

describe("the Lorewards of every claimed name", () => {
  const SCORES: Record<string, number> = { Alex: 300, "Alex Two": 120, "Alex Hidden": 1000 };
  /** The loader as `lorewardStatsOfNames` adds up: each name's score, null when none has a row. */
  const statsOfNames = async (names: readonly string[]) => {
    const scored = names.filter((name) => name in SCORES);
    if (scored.length === 0) return null;
    return { ...LORE_STATS, totalScore: scored.reduce((sum, name) => sum + SCORES[name]!, 0) };
  };
  const threeClaims = () => claimed("Alex", "Alex Two", { name: "Alex Hidden", visible: false });

  beforeEach(() => {
    loader.loadLoreStats.mockImplementation(statsOfNames);
    loader.loadLoreRank.mockResolvedValue(5);
  });

  it("sums a visitor's view over the shown names only, oldest first", async () => {
    threeClaims();
    const passport = await getPassport(resolvesTo("visitor"), forum);
    expect(passport?.wiki.lorewards).toMatchObject({
      totalScore: 420,
      rank: 5,
      names: ["Alex", "Alex Two"],
    });
    expect(loader.loadLoreStats).toHaveBeenCalledWith(["Alex", "Alex Two"]);
    expect(loader.loadLoreRank).toHaveBeenCalledWith(420);
    expect(JSON.stringify(passport)).not.toContain("Alex Hidden");
  });

  it("sums the owner's own view over every approved name, hidden ones included", async () => {
    threeClaims();
    const passport = await getPassport(resolvesTo("clerk_1"), forum);
    expect(passport?.wiki.lorewards).toMatchObject({
      totalScore: 1420,
      names: ["Alex", "Alex Two", "Alex Hidden"],
    });
    expect(loader.loadLoreRank).toHaveBeenCalledWith(1420);
  });

  it("is null for a user with no claim, never the handle's or the resolver's name", async () => {
    const passport = await getPassport(resolvesTo("clerk_1"), forum);
    expect(passport?.wiki.lorewards).toBeNull();
    expect(loader.loadLoreStats).toHaveBeenCalledWith([]);
  });

  it("reads an external wiki name alone", async () => {
    const passport = await getPassport(resolvesTo(null, null, "Alex"), forum);
    expect(passport?.wiki.lorewards).toMatchObject({ totalScore: 300, names: ["Alex"] });
  });

  describe("when every claim is hidden", () => {
    // A hidden claim gives the identity no wiki name (identity.resolve.ts).
    const allHidden = (viewer: string) => resolvesTo(viewer, { wikiName: null });

    beforeEach(() => {
      claimed({ name: "Alex", visible: false });
      loader.loadLoreAwards.mockResolvedValue([AWARD]);
    });

    it("shows the owner their own Lorewards, wiki name and wiki work", async () => {
      const passport = await getPassport(allHidden("clerk_1"), forum);
      expect(passport?.wiki).toMatchObject({
        username: "Alex",
        lorewards: { totalScore: 300, names: ["Alex"] },
      });

      const work = await getWork(allHidden("clerk_1"));
      expect(loader.loadWikiContribs).toHaveBeenCalledWith("Alex");
      expect(loader.loadCreatedPages).toHaveBeenCalledWith("Alex");
      expect(work.wikiActivityFeed.some((item) => item.type === "laurel")).toBe(true);

      loader.loadWikiContribs.mockClear();
      await getHistory({ ...allHidden("clerk_1"), limit: 50 });
      expect(loader.loadWikiContribs).toHaveBeenCalledWith("Alex");
    });

    it("shows a visitor none of it", async () => {
      const passport = await getPassport(allHidden("visitor"), forum);
      expect(passport?.wiki).toMatchObject({ username: null, lorewards: null });
      expect(JSON.stringify(passport)).not.toContain("Alex");

      const work = await getWork(allHidden("visitor"));
      expect(loader.loadWikiContribs).toHaveBeenCalledWith(null);
      expect(loader.loadLoreAwards).toHaveBeenCalledWith(null);
      expect(JSON.stringify(work)).not.toContain("Alex");
    });
  });

  it("puts the shown names' score on the card, for the owner too", async () => {
    threeClaims();
    mocked.passportPreference.findUnique.mockResolvedValue(SHOWN);
    resolvesTo("clerk_1", { handle: "alex" }, "alex");
    const card = await getPassportCard({ handle: "alex", viewerClerkId: "clerk_1" });
    expect(card).toMatchObject({ lorewards: { score: 420, rank: 5 } });
    expect(loader.loadLoreStats).toHaveBeenCalledWith(["Alex", "Alex Two"]);
  });
});

describe("the realm rows", () => {
  const nation = (id: string, realmId: string, gdp: number): IdentityCountry => ({
    id,
    name: id,
    slug: id,
    flag: null,
    coatOfArms: null,
    continent: null,
    region: null,
    governmentType: null,
    currentPopulation: 1,
    currentTotalGdp: gdp,
    currentGdpPerCapita: 1,
    publicApproval: 50,
    realmId,
    realm: { id: realmId, name: realmId, slug: realmId },
  });

  it("are labelled founder, officer or member, never the site role", async () => {
    mocked.realm.findMany.mockResolvedValue([
      { id: "r_founded", ownerId: "clerk_1", officers: [] },
      { id: "r_officer", ownerId: "clerk_x", officers: [{ id: "o1" }] },
      { id: "r_member", ownerId: "clerk_x", officers: [] },
    ]);
    (resolveIdentityNations as jest.Mock).mockResolvedValue([
      nation("c_f", "r_founded", 3),
      nation("c_o", "r_officer", 2),
      nation("c_m", "r_member", 1),
    ]);
    resolvesTo(null, { handle: "kir" });
    const rows = await getRealms({ handle: "kir", viewerClerkId: null });
    expect(rows.map((r) => [r.country.id, r.role])).toEqual([
      ["c_f", "founder"],
      ["c_o", "officer"],
      ["c_m", "member"],
    ]);
    expect(rows.find((r) => r.isPrimary)?.country.id).toBe("c_f");
  });
});

describe("the passport card", () => {
  const card = (viewerClerkId: string | null = null, handle = "Alex") =>
    getPassportCard({ handle, viewerClerkId });
  const cardHolder = { handle: "alex", forumUsername: "AlexForum", countryId: "c2" };

  beforeEach(() => {
    resolvesTo(null, cardHolder, "Alex");
    mocked.passportPreference.findUnique.mockResolvedValue(SHOWN);
    loader.loadLoreStats.mockResolvedValue({ totalScore: 900 });
    loader.loadLoreRank.mockResolvedValue(4);
    loader.loadPersonalPersona.mockResolvedValue({
      displayName: "Alex Pav",
      profileImageUrl: "/images/uploads/avatars/alex.png",
      bio: "Senator of the realm",
    });
  });

  it("makes no external call (MediaWiki, XenForo, Clerk) and no write, and is null for a handle with no user", async () => {
    await card();
    expect(loader.loadWikiInfo).not.toHaveBeenCalled();
    expect(loader.loadClerkProfile).not.toHaveBeenCalled();
    expect(mocked.user.update).not.toHaveBeenCalled();
    (resolveUserIdentity as jest.Mock).mockResolvedValue(null);
    await expect(card(null, "nobody")).resolves.toBeNull();
  });

  it("is only the preview marker, loading nothing, when link previews are off", async () => {
    mocked.passportPreference.findUnique.mockResolvedValue({ ...SHOWN, showLinkPreview: false });
    expect(await card()).toEqual({ preview: false });
    expect(resolveIdentityNations).not.toHaveBeenCalled();
    expect(loader.loadLoreStats).not.toHaveBeenCalled();
    expect(loader.loadPersonalPersona).not.toHaveBeenCalled();
  });

  it("has null Lorewards, not loaded, when the owner hides accolades", async () => {
    mocked.passportPreference.findUnique.mockResolvedValue({ ...SHOWN, showLorewards: false });
    const shown = await card("clerk_1");
    expect(shown).toMatchObject({ preview: true, lorewards: null });
    expect(JSON.stringify(shown)).not.toContain("900");
    expect(loader.loadLoreStats).not.toHaveBeenCalled();
    expect(loader.loadLoreRank).not.toHaveBeenCalled();
  });

  it("falls back to the forum name, then the handle, with no avatar or bio", async () => {
    loader.loadPersonalPersona.mockResolvedValue(null);
    expect(await card()).toMatchObject({ displayName: "AlexForum", avatarUrl: null, bio: null });
    resolvesTo(null, { ...cardHolder, forumUsername: null }, "Alex");
    expect(await card()).toMatchObject({ displayName: "alex" });
  });

  it("names a handle-less holder by the chain, leaving a hidden claimed name out for every viewer", async () => {
    (resolveHandleUser as jest.Mock).mockResolvedValue({ id: holder.id });
    claimed("Alex_Wiki");
    resolvesTo(null, { ...cardHolder, handle: null }, "Alex");
    expect(await card()).toMatchObject({ handle: "Alex_Wiki" });

    const handleless = { ...cardHolder, handle: null, forumUsername: null };
    loader.loadPersonalPersona.mockResolvedValue(null);
    claimed({ name: "Alex_Wiki", visible: false });
    resolvesTo(null, handleless, "Alex_Wiki");
    const visitor = await card(null, "Alex_Wiki");
    expect(visitor).toMatchObject({ handle: "clerk_1", displayName: "clerk_1" });
    expect(JSON.stringify(visitor)).not.toContain("Alex_Wiki");
    resolvesTo("clerk_1", handleless, "Alex_Wiki");
    expect(await card("clerk_1", "Alex_Wiki")).toMatchObject({ handle: "clerk_1" });
  });
});

describe("the page metadata", () => {
  const NOINDEX = { index: false, follow: false };
  const previewCard = {
    preview: true as const,
    handle: "alex",
    displayName: "Alex Pav",
    avatarUrl: null,
    primaryNation: {
      name: "Burgundie",
      slug: "burgundie",
      flagUrl: null,
      realm: { name: "Eurth", slug: "eurth" },
      role: "member" as const,
    },
    lorewards: { score: 47, rank: 14 },
    realmCount: 1,
    nationCount: 1,
    joinedAt: new Date("2024-01-01T00:00:00Z"),
    signature: "Personal note",
    bio: "Private bio",
  };

  it("never shows the signature, bio or join date, and keeps noindex when the holder turned indexing off", () => {
    const text = JSON.stringify(passportMetadata(previewCard, true));
    for (const hidden of ["Personal note", "Private bio", "2024", "Since"])
      expect(text).not.toContain(hidden);
    expect(passportMetadata(previewCard, true).robots).toBeUndefined();
    expect(passportMetadata(previewCard, false).robots).toEqual(NOINDEX);
  });

  it("is the generic IxStates Passport card with link previews off, and nothing but the rule for an unknown handle", () => {
    const meta = passportMetadata({ preview: false }, false);
    expect(meta).toMatchObject({ title: "IxStates Passport", robots: NOINDEX });
    expect(meta.alternates).toBeUndefined();
    for (const personal of ["alex", "Alex Pav", "Burgundie", "Eurth", "Lorewards"]) {
      expect(JSON.stringify(meta)).not.toContain(personal);
    }
    expect(passportMetadata(null, true)).toEqual({});
    expect(passportMetadata(null, false)).toEqual({ robots: NOINDEX });
  });

  it("is indexable unless the holder turned search engine indexing off, and not on a read error", async () => {
    (resolveHandleOwnerClerkId as jest.Mock).mockResolvedValue("clerk_1");
    expect(await passportIndexable("alex")).toBe(true);
    switches({ searchEngineIndexing: false });
    expect(await passportIndexable("alex")).toBe(false);
    (resolveHandleOwnerClerkId as jest.Mock).mockResolvedValue(null);
    expect(await passportIndexable("Some Nation")).toBe(true);
    (resolveHandleOwnerClerkId as jest.Mock).mockRejectedValue(new Error("db down"));
    expect(await passportIndexable("alex")).toBe(false);
  });

  it("logs a failed card read and keeps only the indexing rule", async () => {
    const logged = jest.spyOn(console, "error").mockImplementation(() => undefined);
    (resolveUserIdentity as jest.Mock).mockRejectedValue(new Error("db down"));
    (resolveHandleOwnerClerkId as jest.Mock).mockRejectedValue(new Error("db down"));
    await expect(passportPageMetadata("alex")).resolves.toEqual({ robots: NOINDEX });
    expect(logged).toHaveBeenCalledWith(
      "[metadata] passport card @alex failed:",
      expect.objectContaining({ message: "db down" })
    );
    logged.mockRestore();
  });
});

describe("settings and ribbons", () => {
  it("persists a visibility change against the user's own row, and keeps only pins for unlocked achievements", async () => {
    mocked.passportPreference.upsert.mockImplementation(
      async ({ create }: { create: Record<string, unknown> }) => ({
        ...SHOWN,
        showVault: create.showVault ?? true,
        pinnedRibbonKeys: create.pinnedRibbonKeys ?? [],
      })
    );
    (loadUnlocks as jest.Mock).mockResolvedValue([
      { achievementId: "econ-first-million" },
      { achievementId: "mil-first-branch" },
    ]);
    const user = { id: "db_1", clerkUserId: "clerk_1" };
    const saved = await updateOwnPassportSettings(user, { visibility: { vaultCards: false } });
    expect(mocked.passportPreference.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "db_1" },
        create: { userId: "db_1", showVault: false },
        update: { showVault: false },
      })
    );
    expect(saved.visibility.vaultCards).toBe(false);

    await updateOwnPassportSettings(user, {
      pinnedRibbonKeys: ["mil-first-branch", "not-mine", "econ-first-million"],
    });
    expect(loadUnlocks).toHaveBeenCalledWith("clerk_1");
    expect(mocked.passportPreference.upsert.mock.calls[1]![0].update).toEqual({
      pinnedRibbonKeys: ["mil-first-branch", "econ-first-million"],
    });
    expect(validPinnedKeys(["a", "x", "a", "b", "c", "d"], ["a", "b", "c", "d"], 3)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  const publicCaller = () =>
    createCallerFactory(ixnayidPassportRouter)(
      createMockRouterContext({ auth: null, user: null, db }) as never
    );
  const owner = { id: "db_1", clerkUserId: "clerk_1", isActive: true };

  it.each([
    ["has no owner", { owner: null }, SHOWN],
    ["has an inactive owner", { owner: { ...owner, isActive: false } }, SHOWN],
    [
      "is owned by a player who hides their achievements",
      { owner },
      { ...SHOWN, showAchievements: false },
    ],
  ])(
    "a country page rack is empty, reading no achievement, when the country %s",
    async (_case, country, preference) => {
      mocked.country.findUnique.mockResolvedValue(country);
      mocked.passportPreference.findUnique.mockResolvedValue(preference);
      expect(await publicCaller().getCountryRibbons({ countrySlug: "caphiria" })).toEqual({
        ribbons: [],
        total: 0,
      });
      expect(mocked.userAchievement.findMany).not.toHaveBeenCalled();
    }
  );

  it("a showcase is empty, not invented, for a user with no achievements", async () => {
    const actual = jest.requireActual<typeof import("~/server/modules/identity/identity.showcase")>(
      "~/server/modules/identity/identity.showcase"
    );
    await expect(actual.loadAchievementsShowcase("clerk_1", [])).resolves.toEqual({
      unlockedCount: 0,
      totalCount: 76,
      points: 0,
      ribbons: [],
    });
  });

  it("a passport rack is empty for a handle with no platform user", async () => {
    (resolveIdentity as jest.Mock).mockResolvedValue({ user: null });
    expect(await publicCaller().getRibbons({ handle: "wiki-only" })).toEqual({
      ribbons: [],
      total: 0,
    });
  });
});
