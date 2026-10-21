/**
 * Ribbons are derived from real `UserAchievement` rows (no hard-coded defaults): ordering, pin
 * validation, the country-page rack (owner's top ribbons, empty without an owner or when hidden) and
 * the collection focus.
 */
jest.mock("~/server/db", () => {
  const db = {
    user: { findUnique: jest.fn(), update: jest.fn() },
    country: { findUnique: jest.fn() },
    userAchievement: { findMany: jest.fn() },
    achievement: { count: jest.fn() },
    passportPreference: { findUnique: jest.fn() },
  };
  return { __esModule: true, db, isDatabaseReadOnly: false };
});

jest.mock("~/server/modules/identity/identity.resolve", () => ({
  resolveIdentity: jest.fn(),
  resolveIdentityNations: jest.fn().mockResolvedValue([]),
  resolveHandleUser: jest.fn().mockResolvedValue(null),
}));

import { describe, it, expect, beforeEach } from "@jest/globals";
import { db } from "~/server/db";
import { createCallerFactory } from "~/server/api/trpc";
import { ixnayidPassportRouter } from "~/server/api/routers/ixnayid/passport";
import { resolveIdentity } from "~/server/modules/identity/identity.resolve";
import {
  loadAchievementsShowcase,
  validPinnedKeys,
  type UnlockRow,
} from "~/server/modules/identity/identity.showcase";
import { createMockRouterContext } from "~/tests/helpers/router-context";

const mocked = db as unknown as {
  country: { findUnique: jest.Mock };
  userAchievement: { findMany: jest.Mock };
  achievement: { count: jest.Mock };
  passportPreference: { findUnique: jest.Mock };
};

function unlock(key: string, rarity: string, day: number, category = "Economic"): UnlockRow {
  return {
    achievementId: key,
    title: key,
    description: `${key} description`,
    category,
    rarity,
    iconUrl: null,
    unlockedAt: new Date(Date.UTC(2026, 0, day)),
    achievement: { points: 10 },
  };
}

const UNLOCKS = [
  unlock("common-old", "Common", 1),
  unlock("epic", "Epic", 2, "Military"),
  unlock("common-new", "Common", 5),
  unlock("legendary", "Legendary", 3, "Diplomatic"),
  unlock("rare", "Rare", 4, "Social"),
];

const createCaller = createCallerFactory(ixnayidPassportRouter);
const publicCaller = () =>
  createCaller(createMockRouterContext({ auth: null, user: null, db }) as never);

beforeEach(() => {
  jest.clearAllMocks();
  mocked.passportPreference.findUnique.mockResolvedValue(null);
  mocked.userAchievement.findMany.mockResolvedValue(UNLOCKS);
  mocked.achievement.count.mockResolvedValue(76);
});
describe("validPinnedKeys", () => {
  it("drops keys the user has not unlocked, repeats, and anything past the cap", () => {
    expect(validPinnedKeys(["a", "x", "a", "b", "c", "d"], ["a", "b", "c", "d"], 3)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });
});

describe("loadAchievementsShowcase", () => {
  it("is empty, not invented, for a user with no achievements", async () => {
    mocked.userAchievement.findMany.mockResolvedValue([]);
    const showcase = await loadAchievementsShowcase("clerk_1", []);
    expect(showcase).toEqual({ unlockedCount: 0, totalCount: 76, points: 0, ribbons: [] });
  });
});

describe("ixnayid.getCountryRibbons", () => {
  const activeOwner = { owner: { id: "db_1", clerkUserId: "clerk_1", isActive: true } };
  it("is empty for a country without an owner", async () => {
    mocked.country.findUnique.mockResolvedValue({ owner: null });
    const rack = await publicCaller().getCountryRibbons({ countrySlug: "npc-land" });
    expect(rack).toEqual({ ribbons: [], total: 0 });
    expect(mocked.userAchievement.findMany).not.toHaveBeenCalled();
  });

  it("is empty for an inactive owner", async () => {
    mocked.country.findUnique.mockResolvedValue({
      owner: { ...activeOwner.owner, isActive: false },
    });
    expect(await publicCaller().getCountryRibbons({ countrySlug: "caphiria" })).toEqual({
      ribbons: [],
      total: 0,
    });
  });

  it("is empty when the owner hides their achievements", async () => {
    mocked.country.findUnique.mockResolvedValue(activeOwner);
    mocked.passportPreference.findUnique.mockResolvedValue({
      showLorewards: true,
      showFocus: true,
      showForumStats: true,
      showVault: true,
      showHistory: true,
      showAchievements: false,
      signature: null,
      pinnedRibbonKeys: [],
    });
    expect(await publicCaller().getCountryRibbons({ countrySlug: "caphiria" })).toEqual({
      ribbons: [],
      total: 0,
    });
    expect(mocked.userAchievement.findMany).not.toHaveBeenCalled();
  });
});

describe("ixnayid.getRibbons", () => {
  it("is empty for a handle with no platform user", async () => {
    (resolveIdentity as jest.Mock).mockResolvedValue({ user: null });
    expect(await publicCaller().getRibbons({ handle: "wiki-only" })).toEqual({
      ribbons: [],
      total: 0,
    });
  });
});
