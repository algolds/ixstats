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
    realmClaim: { findMany: jest.fn().mockResolvedValue([]) },
  };
  return { __esModule: true, db, isDatabaseReadOnly: false };
});

jest.mock("~/server/modules/identity/identity.resolve", () => ({
  resolveIdentity: jest.fn(),
  resolveIdentityNations: jest.fn(),
  resolveHandleUser: jest.fn().mockResolvedValue(null),
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
import { getRealms } from "~/server/modules/identity/identity.service";
import {
  resolveIdentity,
  resolveIdentityNations,
} from "~/server/modules/identity/identity.resolve";
import type { IdentityCountry } from "~/server/modules/identity/identity.selects";

const mocked = db as unknown as {
  realm: { findMany: jest.Mock };
  realmClaim: { findMany: jest.Mock };
};

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
