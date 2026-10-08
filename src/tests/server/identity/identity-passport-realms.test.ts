/** @jest-environment node */
/**
 * The passport's realm figures: distinct realms and held nations are counted separately, the primary
 * nation follows the User.countryId-else-GDP rule, and realm rows carry the realm role, never the
 * site role or an invented "Leader".
 */
jest.mock("~/server/db", () => {
  const db = {
    user: { update: jest.fn().mockResolvedValue({}) },
    wikiAccountLink: { findFirst: jest.fn().mockResolvedValue(null) },
    userConnection: { findMany: jest.fn().mockResolvedValue([]) },
    passportPreference: { findUnique: jest.fn().mockResolvedValue(null) },
    realm: { findMany: jest.fn() },
  };
  return { __esModule: true, db, isDatabaseReadOnly: false };
});

jest.mock("~/server/modules/identity/identity.resolve", () => ({
  resolveIdentity: jest.fn(),
  resolveIdentityNations: jest.fn(),
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
import { getPassport, getRealms } from "~/server/modules/identity/identity.service";
import {
  resolveIdentity,
  resolveIdentityNations,
} from "~/server/modules/identity/identity.resolve";
import type { IdentityCountry } from "~/server/modules/identity/identity.selects";

const mocked = db as unknown as { realm: { findMany: jest.Mock } };
const forum = { getMember: jest.fn(), lookupUser: jest.fn() } as never;

const user = {
  id: "db_1",
  clerkUserId: "clerk_1",
  handle: "kir",
  wikiUsername: null,
  wikiUserId: null,
  forumUserId: null,
  forumUsername: null,
  discordUserId: null,
  discordUsername: null,
  role: { name: "admin", displayName: "Administrator" },
  createdAt: new Date(),
  countryId: null as string | null,
};

function nation(id: string, realmId: string, gdp: number): IdentityCountry {
  return {
    id,
    name: id,
    slug: id,
    flag: null,
    coatOfArms: null,
    leader: null,
    wikiPageTitle: null,
    continent: null,
    region: null,
    governmentType: null,
    currentPopulation: 1,
    currentTotalGdp: gdp,
    currentGdpPerCapita: 1,
    publicApproval: 50,
    realmId,
    realm: { id: realmId, name: realmId, slug: realmId },
  };
}

function holds(nations: IdentityCountry[], countryId: string | null = null) {
  (resolveIdentity as jest.Mock).mockResolvedValue({
    handle: "kir",
    strippedHandle: "kir",
    user: { ...user, countryId },
    country: null,
    wikiName: null,
    forumUserId: null,
    forumUsername: null,
    isOwner: false,
  });
  (resolveIdentityNations as jest.Mock).mockResolvedValue(nations);
}

const query = { handle: "kir", viewerClerkId: null };

beforeEach(() => {
  mocked.realm.findMany.mockReset().mockResolvedValue([
    { id: "r_founded", ownerId: "clerk_1", officers: [] },
    { id: "r_officer", ownerId: "clerk_x", officers: [{ id: "o1" }] },
    { id: "r_member", ownerId: "clerk_x", officers: [] },
  ]);
});

describe("getPassport realm figures", () => {
  it("counts two nations in one realm as one realm and two nations", async () => {
    holds([nation("c_a", "r_member", 30), nation("c_b", "r_member", 20)]);
    const data = await getPassport(query, forum);
    expect(data?.realmCount).toBe(1);
    expect(data?.nationCount).toBe(2);
  });

  it("makes the linked country the primary nation when it is held", async () => {
    holds([nation("c_big", "r_member", 90), nation("c_linked", "r_officer", 10)], "c_linked");
    const data = await getPassport(query, forum);
    expect(data?.primaryNation?.country.id).toBe("c_linked");
    expect(data?.primaryNation?.role).toBe("officer");
  });

  it("falls back to the highest-GDP held nation", async () => {
    holds([nation("c_small", "r_member", 10), nation("c_big", "r_founded", 90)], "c_not_held");
    const data = await getPassport(query, forum);
    expect(data?.primaryNation?.country.id).toBe("c_big");
    expect(data?.realmCount).toBe(2);
  });

  it("has no primary nation and zero counts when nothing is held", async () => {
    holds([]);
    const data = await getPassport(query, forum);
    expect(data?.primaryNation).toBeNull();
    expect(data?.realmCount).toBe(0);
    expect(data?.nationCount).toBe(0);
  });
});

describe("getRealms roles", () => {
  it("labels each row founder, officer or member, never the site role", async () => {
    holds([
      nation("c_f", "r_founded", 3),
      nation("c_o", "r_officer", 2),
      nation("c_m", "r_member", 1),
    ]);
    const rows = await getRealms(query);
    expect(rows.map((r) => [r.country.id, r.role])).toEqual([
      ["c_f", "founder"],
      ["c_o", "officer"],
      ["c_m", "member"],
    ]);
    expect(rows.find((r) => r.isPrimary)?.country.id).toBe("c_f");
  });
});
