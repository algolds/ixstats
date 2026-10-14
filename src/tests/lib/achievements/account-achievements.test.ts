/** @jest-environment node */
/**
 * Account-level achievements: General / Social / collection achievements evaluate and unlock
 * for a user with no country; country-stat achievements still need one. Unlocks stay keyed by
 * the Clerk id and pay through `grantBonus` with a one-time key.
 */

jest.mock("~/lib/vault/vault-bonus", () => ({
  ...jest.requireActual("~/lib/vault/vault-bonus"),
  getBonusConfig: jest.fn(),
  grantBonus: jest.fn().mockResolvedValue({ granted: true, amount: 100 }),
}));
jest.mock("~/lib/cards/card-service", () => ({ awardAchievementCard: jest.fn() }));
jest.mock("~/lib/activity", () => ({
  ActivityHooks: { User: { onAchievementUnlocked: jest.fn().mockResolvedValue(undefined) } },
}));
jest.mock("~/lib/notifications/hooks", () => ({
  notificationHooks: { onAchievementUnlock: jest.fn().mockResolvedValue(undefined) },
}));

import { getAchievementById } from "~/lib/achievements/definitions";
import { METRIC_LOADERS } from "~/lib/achievements/metrics/registry";
import { ACCOUNT_LEVEL_METRICS, achievementRequiresCountry } from "~/lib/achievements/scope";
import { ALL_DEFINITIONS } from "~/lib/achievements/sets";
import { syncAchievements } from "~/lib/achievements/sync";
import { achievementService } from "~/lib/achievements/service";
import { getBonusConfig, grantBonus, VAULT_BONUS_DEFAULTS } from "~/lib/vault/vault-bonus";
import { createMockPrisma } from "~/tests/helpers/mock-db";

const CLERK_ID = "clerk_no_country";
const DAY = 24 * 60 * 60 * 1000;

/** The conditionJson each built-in definition gets from `syncAchievements`. */
async function syncedConditions(): Promise<Map<string, string>> {
  const db = createMockPrisma();
  jest.spyOn(console, "log").mockImplementation(() => {});
  await syncAchievements(db as never);
  return new Map(
    db.achievement.upsert.mock.calls.map(([args]: any[]) => [
      args.create.key,
      args.create.conditionJson,
    ])
  );
}

function row(key: string, conditionJson: string | null, rarity = "Common") {
  const def = getAchievementById(key);
  return {
    key,
    title: def?.title ?? key,
    description: def?.description ?? "",
    category: def?.category ?? "General",
    rarity,
    points: def?.points ?? 10,
    iconUrl: null,
    triggerType: "GENERAL",
    conditionJson,
    rewardsJson: null,
    isActive: true,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(getBonusConfig).mockResolvedValue(VAULT_BONUS_DEFAULTS);
});

/** Every definition that evaluates without a country, by the scope it derives. */
const ACCOUNT_LEVEL_IDS = ALL_DEFINITIONS.filter(
  (d) => !d.retired && !achievementRequiresCountry({ key: d.id })
).map((d) => d.id);

describe("achievement scope", () => {
  it("derives the account-level definitions from their rule metric or accountLevel flag", () => {
    expect(ACCOUNT_LEVEL_IDS).toEqual(
      expect.arrayContaining([
        "gen-welcome",
        "gen-one-week",
        "gen-one-month",
        "gen-three-months",
        "gen-one-year",
        "gen-achievement-hunter",
        "gen-achievement-master",
        "gen-achievement-legend",
        "vid-end-of-days",
        "vid-annual",
        "meme-ns-ref",
        "social-first-thinkpage",
        "social-thinkpage-author",
        "social-prolific-author",
        "social-trending",
        "lore-scholar",
        "collect-lore-keeper",
        "collect-archaeologist",
        "collect-diplomat",
        "social-recruiter",
        "social-envoy",
        "social-founders-hand",
      ])
    );
  });

  it("covers General, Social and Cards achievements", () => {
    const categories = new Set(ACCOUNT_LEVEL_IDS.map((id) => getAchievementById(id)!.category));
    for (const category of ["General", "Social", "Cards"] as const) {
      expect(categories.has(category)).toBe(true);
    }
  });

  it("account-level definitions evaluate without country data", () => {
    const data = {
      daysActive: 400,
      totalAchievements: 60,
      existingKeys: [],
      thinkpageCount: 60,
      trendingPostCount: 1,
      loreCardCount: 60,
      retiredCardCount: 20,
      distinctCountryIdCount: 30,
    };
    for (const id of ACCOUNT_LEVEL_IDS) {
      // `country` is undefined: a condition touching it would throw here
      expect(() =>
        achievementService.evaluateCondition({ key: id, conditionJson: null }, data)
      ).not.toThrow();
    }
  });

  it("stored rules of account-level achievements read only account-level metrics", async () => {
    const conditions = await syncedConditions();
    for (const id of ACCOUNT_LEVEL_IDS) {
      const rule = JSON.parse(conditions.get(id) ?? "{}");
      if (rule.metric) {
        const accountLoaderKey = METRIC_LOADERS.some(
          (loader) => loader.scope === "account" && loader.keys.includes(rule.metric)
        );
        expect(ACCOUNT_LEVEL_METRICS.has(rule.metric) || accountLoaderKey).toBe(true);
      }
    }
  });

  it("keeps every other built-in achievement country-bound", async () => {
    const conditions = await syncedConditions();
    const countryBound = ALL_DEFINITIONS.filter(
      (d) => !d.retired && !ACCOUNT_LEVEL_IDS.includes(d.id)
    );
    expect(countryBound.map((d) => d.id)).toEqual(
      expect.arrayContaining([
        "meme-1337",
        "meme-bankruptcy",
        "meme-stonks",
        "lore-collector",
        "social-popular",
        "story-chain-1",
        "story-chain-5",
        "story-chain-25",
        "mil-first-branch",
        "dip-first-embassy",
        "gov-first-component",
        "gen-first-country",
        "vid-lightswitch",
      ])
    );
    for (const def of countryBound) {
      expect(
        achievementRequiresCountry({ key: def.id, conditionJson: conditions.get(def.id) ?? null })
      ).toBe(true);
    }
    // e.g. followers belong to a country, GDP growth is a country stat
    expect(achievementRequiresCountry({ key: "social-popular" })).toBe(true);
    expect(achievementRequiresCountry({ key: "meme-stonks" })).toBe(true);
    expect(achievementRequiresCountry({ key: "gen-first-country" })).toBe(true);
  });

  it("classifies admin-authored rows by the metric their rule reads", () => {
    const rule = (metric: string) => JSON.stringify({ metric, operator: ">=", value: 1 });
    expect(achievementRequiresCountry({ key: "custom-a", conditionJson: rule("daysActive") })).toBe(
      false
    );
    expect(
      achievementRequiresCountry({ key: "custom-b", conditionJson: rule("embassyCount") })
    ).toBe(true);
    expect(achievementRequiresCountry({ key: "custom-c", conditionJson: null })).toBe(true);
    expect(achievementRequiresCountry({ key: "custom-d", conditionJson: "{oops" })).toBe(true);
  });
});

describe("AchievementService.evaluateCondition", () => {
  const always = JSON.stringify({ metric: "always_true", operator: "==", value: true });

  it("unlocks gen-welcome from its stored always_true rule (never matched before)", () => {
    expect(
      achievementService.evaluateCondition({ key: "gen-welcome", conditionJson: always }, {})
    ).toBe(true);
  });

  it("never passes a country achievement without a country, whatever the data says", () => {
    const growth = JSON.stringify({ metric: "adjustedGdpGrowth", operator: "<", value: 0 });
    expect(
      achievementService.evaluateCondition({ key: "meme-stonks", conditionJson: growth }, {
        adjustedGdpGrowth: -50,
      } as never)
    ).toBe(false);
    expect(
      achievementService.evaluateCondition({ key: "meme-stonks", conditionJson: null }, {})
    ).toBe(false);
  });

  it("evaluates gen-first-country from countryClaimed", () => {
    const claimed = JSON.stringify({ metric: "countryClaimed", operator: "==", value: true });
    const country = { id: "c1" } as never;
    expect(
      achievementService.evaluateCondition(
        { key: "gen-first-country", conditionJson: claimed },
        { country, countryClaimed: true }
      )
    ).toBe(true);
  });
});

describe("AchievementService.checkAndUnlock without a country", () => {
  function setup(existing: string[] = []) {
    const db = createMockPrisma();
    db.user.findUnique.mockResolvedValue({
      id: "user_db_1",
      createdAt: new Date(Date.now() - 10 * DAY),
      countryId: null,
    });
    db.userAchievement.findMany.mockResolvedValue(
      existing.map((achievementId) => ({ achievementId }))
    );
    db.thinkpagesPost.count.mockResolvedValue(1);
    db.cardOwnership.count.mockResolvedValue(0);
    db.cardOwnership.findMany.mockResolvedValue([]);
    db.achievement.findMany.mockResolvedValue([
      row("gen-welcome", JSON.stringify({ metric: "always_true", operator: "==", value: true })),
      row("gen-one-week", JSON.stringify({ metric: "daysActive", operator: ">=", value: 7 })),
      row("gen-one-month", JSON.stringify({ metric: "daysActive", operator: ">=", value: 30 })),
      row(
        "social-first-thinkpage",
        JSON.stringify({ metric: "thinkpageCount", operator: ">=", value: 1 })
      ),
      row(
        "gen-achievement-hunter",
        JSON.stringify({ metric: "totalAchievements", operator: ">=", value: 10 }),
        "Uncommon"
      ),
      row("meme-stonks", JSON.stringify({ metric: "adjustedGdpGrowth", operator: "<", value: 0 })),
      row(
        "gen-first-country",
        JSON.stringify({ metric: "countryClaimed", operator: "==", value: true })
      ),
    ]);
    return db;
  }

  it("unlocks account-level achievements, keyed by Clerk id, and skips country ones", async () => {
    const db = setup();

    const unlocked = await achievementService.checkAndUnlock(CLERK_ID, null, db as never);

    expect(unlocked.sort()).toEqual(["gen-one-week", "gen-welcome", "social-first-thinkpage"]);
    expect(db.country.findUnique).not.toHaveBeenCalled();
    for (const [args] of db.userAchievement.create.mock.calls) {
      expect(args.data.userId).toBe(CLERK_ID);
    }
  });

  it("pays each unlock once through the ledger", async () => {
    const db = setup();

    await achievementService.checkAndUnlock(CLERK_ID, null, db as never);

    expect(grantBonus).toHaveBeenCalledTimes(3);
    expect(grantBonus).toHaveBeenCalledWith(db, CLERK_ID, "bonus:achievement:gen-welcome", 100, {
      oneTime: true,
      metadata: expect.objectContaining({ achievementId: "gen-welcome" }),
    });
  });

  it("does not unlock or pay again for achievements already held", async () => {
    const db = setup(["gen-welcome", "gen-one-week", "social-first-thinkpage"]);

    const unlocked = await achievementService.checkAndUnlock(CLERK_ID, null, db as never);

    expect(unlocked).toEqual([]);
    expect(db.userAchievement.create).not.toHaveBeenCalled();
    expect(grantBonus).not.toHaveBeenCalled();
  });

  it("pays nothing when a concurrent run already created the unlock", async () => {
    const db = setup();
    db.userAchievement.create.mockRejectedValue(Object.assign(new Error("dup"), { code: "P2002" }));

    const unlocked = await achievementService.checkAndUnlock(CLERK_ID, null, db as never);

    expect(unlocked).toEqual([]);
    expect(grantBonus).not.toHaveBeenCalled();
  });

  it("cascades meta achievements that the new unlocks qualify for", async () => {
    // 7 held (not in the candidate list) + 3 new → totalAchievements reaches 10
    const db = setup(["a1", "a2", "a3", "a4", "a5", "a6", "a7"]);

    const unlocked = await achievementService.checkAndUnlock(CLERK_ID, null, db as never);

    expect(unlocked).toContain("gen-achievement-hunter");
    expect(unlocked).toHaveLength(4);
  });

  it("falls back to account-level achievements when the country is missing", async () => {
    const db = setup();
    db.country.findUnique.mockResolvedValue(null);
    jest.spyOn(console, "warn").mockImplementation(() => {});

    const unlocked = await achievementService.checkAndUnlock(CLERK_ID, "gone", db as never);

    expect(unlocked).toContain("gen-welcome");
    expect(unlocked).not.toContain("meme-stonks");
  });
});

describe("AchievementService.checkAndUnlock with a country", () => {
  it("still evaluates country achievements against it", async () => {
    const db = createMockPrisma();
    db.user.findUnique.mockResolvedValue({ id: "u1", createdAt: new Date(), countryId: "c1" });
    db.country.findUnique.mockResolvedValue({
      id: "c1",
      currentTotalGdp: 1e9,
      currentGdpPerCapita: 20000,
      currentPopulation: 5e6,
      economicTier: "Tier 3",
      adjustedGdpGrowth: -3,
      populationGrowthRate: 1,
      actualGdpGrowth: -3,
      createdAt: new Date(),
    });
    db.embassy.count.mockResolvedValue(0);
    db.militaryBranch.findMany.mockResolvedValue([]);
    db.governmentComponent.count.mockResolvedValue(0);
    db.countryFollow.count.mockResolvedValue(0);
    db.thinkpagesPost.count.mockResolvedValue(0);
    db.achievement.findMany.mockResolvedValue([
      row("meme-stonks", JSON.stringify({ metric: "adjustedGdpGrowth", operator: "<", value: 0 })),
      row(
        "gen-first-country",
        JSON.stringify({ metric: "countryClaimed", operator: "==", value: true })
      ),
    ]);

    const unlocked = await achievementService.checkAndUnlock("clerk_1", "c1", db as never);

    expect(unlocked.sort()).toEqual(["gen-first-country", "meme-stonks"]);
  });
});
