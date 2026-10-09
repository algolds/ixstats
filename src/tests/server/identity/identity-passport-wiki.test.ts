/**
 * getPassport is a public read. It must not write an unverified wiki identity (derived from a country
 * name) into User.wikiUsername/wikiUserId, must report wiki "linked" only for a verified link, and
 * carries no wiki edit count or groups (nothing shows them), so a user's passport makes no MediaWiki call.
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
  resolveHandleUser: jest.fn().mockResolvedValue(null),
}));

jest.mock("~/server/modules/identity/identity.vault", () => ({
  resolvePassportVault: jest.fn().mockResolvedValue({ credits: 0 }),
}));

jest.mock("~/server/modules/identity/identity.showcase", () => ({
  loadAchievementsShowcase: jest.fn().mockResolvedValue(null),
}));

jest.mock("~/server/modules/identity/identity.loaders", () => ({
  loadWikiInfo: jest.fn(),
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
import { getPassport } from "~/server/modules/identity/identity.service";
import { resolveIdentity } from "~/server/modules/identity/identity.resolve";
import { loadWikiInfo } from "~/server/modules/identity/identity.loaders";

const mocked = db as unknown as {
  user: { update: jest.Mock };
  wikiAccountLink: { findFirst: jest.Mock };
};
const forum = {
  getActivity: jest.fn().mockResolvedValue({ posts: 0, threads: 0 }),
  lookupUser: jest.fn(),
} as never;

const countryOwner = {
  id: "db_1",
  clerkUserId: "clerk_1",
  wikiUsername: null,
  wikiUserId: null,
  forumUserId: null,
  forumUsername: null,
  discordUserId: null,
  discordUsername: null,
  createdAt: new Date(),
  countryId: "c1",
};

/** A user whose wiki name was derived from their country name ("Kir Republic"). */
function identityWithCountryDerivedWikiName() {
  (resolveIdentity as jest.Mock).mockResolvedValue({
    handle: "kir-republic",
    strippedHandle: "kir-republic",
    user: countryOwner,
    wikiName: "Kir Republic",
    forumUserId: null,
    forumUsername: null,
    isOwner: false,
  });
}

// The pre-fix bridge fabricated user_id 1 and an edit count from the Lorewards score.
const FABRICATED = { exists: true, userId: 1, user_id: 1, editCount: 40, groups: ["user"] };
const UNKNOWN = { exists: true, userId: 0, user_id: 0, editCount: 0, groups: [] };
const LIVE = { exists: true, userId: 77, user_id: 77, editCount: 1234, groups: ["sysop"] };

describe("getPassport wiki identity", () => {
  beforeEach(() => {
    mocked.user.update.mockClear();
    mocked.wikiAccountLink.findFirst.mockReset().mockResolvedValue(null);
    identityWithCountryDerivedWikiName();
  });

  it("never writes wikiUsername / wikiUserId while serving a public passport", async () => {
    (loadWikiInfo as jest.Mock).mockResolvedValue(FABRICATED);
    await getPassport({ handle: "kir-republic", viewerClerkId: null }, forum);
    expect(mocked.user.update).not.toHaveBeenCalled();
  });

  it("reports wiki as not linked without a verified link, even though the wiki name exists", async () => {
    (loadWikiInfo as jest.Mock).mockResolvedValue(UNKNOWN);
    const passport = await getPassport({ handle: "kir-republic", viewerClerkId: null }, forum);
    expect(passport?.wiki.linked).toBe(false);
  });

  it("reports wiki as linked once a verified ixwiki link exists", async () => {
    mocked.wikiAccountLink.findFirst.mockResolvedValue({ username: "Kir Republic" });
    (loadWikiInfo as jest.Mock).mockResolvedValue(LIVE);
    const passport = await getPassport({ handle: "kir-republic", viewerClerkId: null }, forum);
    expect(passport?.wiki.linked).toBe(true);
    expect(mocked.wikiAccountLink.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "db_1", source: "ixwiki", verifiedAt: { not: null } },
      })
    );
  });

  it("carries no edit count or groups, and asks MediaWiki nothing, for a user", async () => {
    (loadWikiInfo as jest.Mock).mockClear().mockResolvedValue(LIVE);
    const passport = await getPassport({ handle: "kir-republic", viewerClerkId: null }, forum);
    expect(Object.keys(passport?.wiki ?? {}).sort()).toEqual(
      ["awardHistory", "linked", "lorewards", "username"].sort()
    );
    expect(loadWikiInfo).not.toHaveBeenCalled();
  });

  it("reports an external wiki name as linked when MediaWiki knows it", async () => {
    (resolveIdentity as jest.Mock).mockResolvedValue({
      handle: "Some Editor",
      strippedHandle: "Some Editor",
      user: null,
      wikiName: "Some Editor",
      forumUserId: null,
      forumUsername: null,
      isOwner: false,
    });
    (loadWikiInfo as jest.Mock).mockResolvedValue(UNKNOWN);
    const passport = await getPassport({ handle: "Some Editor", viewerClerkId: null }, forum);
    expect(passport?.wiki).toMatchObject({ linked: true, username: "Some Editor" });
    expect(loadWikiInfo).toHaveBeenCalledWith("Some Editor");
  });
});
