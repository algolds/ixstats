/**
 * `getPassportCard`: the slim, public passport summary for page metadata and the OG image.
 * Database reads only (no MediaWiki, XenForo or Clerk), each section already redacted
 * by the owner's `PassportPreference`; with link previews off it is only `{ preview: false }`.
 */
jest.mock("~/server/db", () => {
  const db = {
    user: { update: jest.fn() },
    wikiAccountLink: { findFirst: jest.fn().mockResolvedValue(null) },
    userConnection: { findMany: jest.fn().mockResolvedValue([]) },
    passportPreference: { findUnique: jest.fn().mockResolvedValue(null) },
  };
  return { __esModule: true, db, isDatabaseReadOnly: false };
});

jest.mock("~/server/modules/identity/identity.resolve", () => ({
  resolveIdentity: jest.fn(),
  resolveUserIdentity: jest.fn(),
  resolveIdentityNations: jest.fn(),
  resolveHandleUser: jest.fn().mockResolvedValue(null),
}));

jest.mock("~/server/modules/identity/identity.realm-roles", () => ({
  loadRealmRoles: jest.fn(),
}));

jest.mock("~/server/modules/identity/identity.loaders", () => ({
  loadLoreStats: jest.fn(),
  loadLoreRank: jest.fn(),
  loadPersonalPersona: jest.fn(),
  loadWikiInfo: jest.fn(),
  loadClerkProfile: jest.fn(),
  loadLoreAwards: jest.fn(),
}));

import { beforeEach, describe, expect, it } from "@jest/globals";
import { db } from "~/server/db";
import { getPassportCard } from "~/server/modules/identity/identity.service";
import {
  resolveHandleUser,
  resolveIdentityNations,
  resolveUserIdentity,
} from "~/server/modules/identity/identity.resolve";
import { loadRealmRoles } from "~/server/modules/identity/identity.realm-roles";
import {
  loadClerkProfile,
  loadLoreRank,
  loadLoreStats,
  loadPersonalPersona,
  loadWikiInfo,
} from "~/server/modules/identity/identity.loaders";

const mocked = db as unknown as {
  user: { update: jest.Mock };
  wikiAccountLink: { findFirst: jest.Mock };
  userConnection: { findMany: jest.Mock };
  passportPreference: { findUnique: jest.Mock };
};

const JOINED = new Date("2024-01-01T00:00:00Z");

const holder = {
  id: "db_1",
  clerkUserId: "clerk_1",
  handle: "alex" as string | null,
  wikiUsername: "Alex",
  forumUserId: 9,
  forumUsername: "AlexForum",
  createdAt: JOINED,
  countryId: "c2",
};

function nation(id: string, name: string, realmId: string, gdp: number) {
  return {
    id,
    name,
    slug: name.toLowerCase(),
    flag: `/images/uploads/flags/${id}.png`,
    coatOfArms: null,
    leader: null,
    wikiPageTitle: null,
    continent: null,
    region: null,
    governmentType: null,
    currentPopulation: 1000,
    currentTotalGdp: gdp,
    currentGdpPerCapita: 10,
    publicApproval: 50,
    realmId,
    realm: { id: realmId, name: realmId === "r1" ? "Eurth" : "Ajax", slug: realmId },
  };
}

const NATIONS = [
  nation("c1", "Caphiria", "r1", 900),
  nation("c2", "Urcea", "r1", 500),
  nation("c3", "Kiravia", "r2", 100),
];

const ROW = {
  showLorewards: true,
  showFocus: true,
  showForumStats: true,
  showVault: true,
  showHistory: true,
  showAchievements: true,
  showLinkPreview: true,
  signature: "A. Pav",
  pinnedRibbonKeys: [],
};

function resolvesTo(user: typeof holder | null, viewerClerkId: string | null = null) {
  (resolveUserIdentity as jest.Mock).mockResolvedValue(
    user && {
      handle: "Alex",
      strippedHandle: "Alex",
      user,
      wikiName: "Alex",
      forumUserId: user.forumUserId,
      forumUsername: user.forumUsername,
      isOwner: viewerClerkId === user.clerkUserId,
    }
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  resolvesTo(holder);
  mocked.passportPreference.findUnique.mockResolvedValue(ROW);
  mocked.userConnection.findMany.mockResolvedValue([]);
  mocked.wikiAccountLink.findFirst.mockResolvedValue(null);
  (resolveIdentityNations as jest.Mock).mockResolvedValue(NATIONS);
  (loadRealmRoles as jest.Mock).mockResolvedValue(new Map([["r1", "founder"]]));
  (loadLoreStats as jest.Mock).mockResolvedValue({ totalScore: 900 });
  (loadLoreRank as jest.Mock).mockResolvedValue(4);
  (loadPersonalPersona as jest.Mock).mockResolvedValue({
    displayName: "Alex Pav",
    profileImageUrl: "/images/uploads/avatars/alex.png",
    bio: "Senator of the realm",
  });
});

describe("getPassportCard", () => {
  it("returns the front face summary", async () => {
    const card = await getPassportCard({ handle: "Alex", viewerClerkId: null });
    expect(card).toEqual({
      preview: true,
      handle: "alex",
      displayName: "Alex Pav",
      avatarUrl: "/images/uploads/avatars/alex.png",
      primaryNation: {
        name: "Urcea",
        slug: "urcea",
        flagUrl: "/images/uploads/flags/c2.png",
        realm: { name: "Eurth", slug: "r1" },
        role: "founder",
      },
      lorewards: { score: 900, rank: 4 },
      realmCount: 2,
      nationCount: 3,
      joinedAt: JOINED,
      signature: "A. Pav",
      bio: "Senator of the realm",
    });
  });

  it("makes no external call (MediaWiki, XenForo, Clerk) and no write", async () => {
    await getPassportCard({ handle: "Alex", viewerClerkId: null });
    expect(loadWikiInfo).not.toHaveBeenCalled();
    expect(loadClerkProfile).not.toHaveBeenCalled();
    expect(mocked.user.update).not.toHaveBeenCalled();
  });

  it("returns null for a handle that names no user, like getPassport", async () => {
    resolvesTo(null);
    await expect(getPassportCard({ handle: "nobody", viewerClerkId: null })).resolves.toBeNull();
  });

  it("returns only the preview marker when link previews are off", async () => {
    mocked.passportPreference.findUnique.mockResolvedValue({ ...ROW, showLinkPreview: false });
    const card = await getPassportCard({ handle: "Alex", viewerClerkId: null });
    expect(card).toEqual({ preview: false });
    expect(resolveIdentityNations).not.toHaveBeenCalled();
    expect(loadLoreStats).not.toHaveBeenCalled();
    expect(loadPersonalPersona).not.toHaveBeenCalled();
  });

  it("returns null Lorewards without loading them when the owner hides accolades", async () => {
    mocked.passportPreference.findUnique.mockResolvedValue({ ...ROW, showLorewards: false });
    const card = await getPassportCard({ handle: "Alex", viewerClerkId: "clerk_1" });
    expect(card).toMatchObject({ preview: true, lorewards: null });
    expect(JSON.stringify(card)).not.toContain("900");
    expect(loadLoreStats).not.toHaveBeenCalled();
    expect(loadLoreRank).not.toHaveBeenCalled();
  });

  it("hides Lorewards from visitors when wiki attribution is off, not from the owner", async () => {
    mocked.userConnection.findMany.mockResolvedValue([
      { userId: "clerk_1", status: JSON.stringify({ showWikiAttribution: false }) },
    ]);
    const visitor = await getPassportCard({ handle: "Alex", viewerClerkId: null });
    expect(visitor).toMatchObject({ preview: true, lorewards: null });

    resolvesTo(holder, "clerk_1");
    const owner = await getPassportCard({ handle: "Alex", viewerClerkId: "clerk_1" });
    expect(owner).toMatchObject({ lorewards: { score: 900, rank: 4 } });
  });

  it("falls back to the forum name, then the handle, with no avatar or bio", async () => {
    (loadPersonalPersona as jest.Mock).mockResolvedValue(null);
    expect(await getPassportCard({ handle: "Alex", viewerClerkId: null })).toMatchObject({
      displayName: "AlexForum",
      avatarUrl: null,
      bio: null,
    });

    resolvesTo({ ...holder, forumUsername: null });
    expect(await getPassportCard({ handle: "Alex", viewerClerkId: null })).toMatchObject({
      displayName: "alex",
    });
  });

  it("uses the passport handle chain when no handle is stored", async () => {
    resolvesTo({ ...holder, handle: null });
    (resolveHandleUser as jest.Mock).mockResolvedValue({ id: holder.id });
    mocked.wikiAccountLink.findFirst.mockResolvedValue({ username: "Alex_Wiki" });
    const card = await getPassportCard({ handle: "Alex", viewerClerkId: null });
    expect(card).toMatchObject({ handle: "Alex_Wiki" });
  });

  it("has no primary nation, and zero counts, when the holder holds no nation", async () => {
    (resolveIdentityNations as jest.Mock).mockResolvedValue([]);
    (loadRealmRoles as jest.Mock).mockResolvedValue(new Map());
    const card = await getPassportCard({ handle: "Alex", viewerClerkId: null });
    expect(card).toMatchObject({ primaryNation: null, realmCount: 0, nationCount: 0 });
  });
});
