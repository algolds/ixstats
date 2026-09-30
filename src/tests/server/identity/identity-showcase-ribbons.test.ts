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
}));

import { describe, it, expect, beforeEach } from "@jest/globals";
import { db } from "~/server/db";
import { createCallerFactory } from "~/server/api/trpc";
import { ixnayidPassportRouter } from "~/server/api/routers/ixnayid/passport";
import { resolveIdentity } from "~/server/modules/identity/identity.resolve";
import {
  loadAchievementsShowcase,
  toRibbons,
  validPinnedKeys,
  type UnlockRow,
} from "~/server/modules/identity/identity.showcase";
import { toVaultFocus } from "~/server/modules/identity/identity.vault";
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

describe("toRibbons", () => {
  it("orders rarest first, then newest", () => {
    expect(toRibbons(UNLOCKS, []).map((r) => r.key)).toEqual([
      "legendary",
      "epic",
      "rare",
      "common-new",
      "common-old",
    ]);
  });

  it("puts pinned ribbons first, in pin order, and marks them", () => {
    const ribbons = toRibbons(UNLOCKS, ["common-old", "rare"]);
    expect(ribbons.slice(0, 3).map((r) => r.key)).toEqual(["common-old", "rare", "legendary"]);
    expect(ribbons.filter((r) => r.pinned).map((r) => r.key)).toEqual(["common-old", "rare"]);
  });

  it("carries the achievement's category, rarity, points and unlock date", () => {
    const [top] = toRibbons([unlock("legendary", "Legendary", 3, "Diplomatic")], []);
    expect(top).toEqual(
      expect.objectContaining({
        category: "Diplomatic",
        rarity: "Legendary",
        points: 10,
        unlockedAt: "2026-01-03T00:00:00.000Z",
      })
    );
  });
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
  it("reads unlocks by Clerk id and sums points", async () => {
    const showcase = await loadAchievementsShowcase("clerk_1", []);
    expect(mocked.userAchievement.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "clerk_1" } })
    );
    expect(showcase).toEqual(
      expect.objectContaining({ unlockedCount: 5, totalCount: 76, points: 50 })
    );
  });

  it("is empty, not invented, for a user with no achievements", async () => {
    mocked.userAchievement.findMany.mockResolvedValue([]);
    const showcase = await loadAchievementsShowcase("clerk_1", []);
    expect(showcase).toEqual({ unlockedCount: 0, totalCount: 76, points: 0, ribbons: [] });
  });
});

describe("ixnayid.getCountryRibbons", () => {
  const activeOwner = { owner: { id: "db_1", clerkUserId: "clerk_1", isActive: true } };

  it("returns the owner's top three ribbons and the full count", async () => {
    mocked.country.findUnique.mockResolvedValue(activeOwner);
    const rack = await publicCaller().getCountryRibbons({ countrySlug: "caphiria" });
    expect(mocked.country.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { slug: "caphiria" } })
    );
    expect(rack.ribbons.map((r) => r.key)).toEqual(["legendary", "epic", "rare"]);
    expect(rack.total).toBe(5);
  });

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
  it("returns every ribbon of the resolved passport holder", async () => {
    (resolveIdentity as jest.Mock).mockResolvedValue({
      user: { id: "db_1", clerkUserId: "clerk_1" },
    });
    const rack = await publicCaller().getRibbons({ handle: "alex" });
    expect(rack.total).toBe(5);
    expect(rack.ribbons).toHaveLength(5);
  });

  it("is empty for a handle with no platform user", async () => {
    (resolveIdentity as jest.Mock).mockResolvedValue({ user: null });
    expect(await publicCaller().getRibbons({ handle: "wiki-only" })).toEqual({
      ribbons: [],
      total: 0,
    });
  });
});

describe("toVaultFocus", () => {
  it("counts distinct lore categories, skips NationStates imports, and names the largest", () => {
    expect(toVaultFocus(["MILITARY", "NS_IMPORT", "MILITARY", "CULTURE", null])).toEqual({
      categoryCount: 2,
      categoryTotal: 12,
      topCategory: "MILITARY",
    });
  });

  it("is zero for an empty or NS-only collection", () => {
    expect(toVaultFocus(["NS_IMPORT"])).toEqual({
      categoryCount: 0,
      categoryTotal: 12,
      topCategory: null,
    });
  });
});
