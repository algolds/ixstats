/** @jest-environment node */
/**
 * The metric registry: loaders add named numbers to the evaluation data, rules read them from
 * `data.metrics`, and each scope's loaders run once per evaluation. Every definition names an
 * icon the UI map can draw.
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

import { ACHIEVEMENT_ICON_MAP } from "~/components/achievements/constants";
import { ACHIEVEMENT_ICON_KEYS } from "~/lib/achievements/icons";
import type { AchievementCategory, AchievementDefinition } from "~/lib/achievements/definitions";
import { METRIC_LOADERS, type MetricLoader } from "~/lib/achievements/metrics/registry";
import { achievementRequiresCountry } from "~/lib/achievements/scope";
import { achievementService } from "~/lib/achievements/service";
import { ALL_DEFINITIONS } from "~/lib/achievements/sets";
import { syncAchievements } from "~/lib/achievements/sync";
import { getBonusConfig, VAULT_BONUS_DEFAULTS } from "~/lib/vault/vault-bonus";
import { createMockPrisma } from "~/tests/helpers/mock-db";

const CLERK_ID = "clerk_metrics";
const USER_ID = "user_db_metrics";
const CATEGORIES: AchievementCategory[] = [
  "Executive",
  "Politics",
  "Diplomacy",
  "Defense",
  "Nation",
  "Social",
  "Wiki",
  "Cards",
  "Lorewards",
  "General",
];

const rule = (metric: string, value = 1) => JSON.stringify({ metric, operator: ">=", value });

function loader(over: Partial<MetricLoader> & Pick<MetricLoader, "scope" | "keys">): MetricLoader {
  return { id: `test-${over.scope}`, load: jest.fn().mockResolvedValue({}), ...over };
}

const registered: MetricLoader[] = [];
function register(l: MetricLoader) {
  METRIC_LOADERS.push(l);
  registered.push(l);
  return l;
}

const addedDefinitions: AchievementDefinition[] = [];
function define(def: Partial<AchievementDefinition> & Pick<AchievementDefinition, "id">) {
  const full: AchievementDefinition = {
    title: def.id,
    description: "",
    category: "Executive",
    rarity: "Rare",
    points: 50,
    icon: "Trophy",
    ...def,
  };
  ALL_DEFINITIONS.push(full);
  addedDefinitions.push(full);
  return full;
}

afterEach(() => {
  for (const l of registered.splice(0)) METRIC_LOADERS.splice(METRIC_LOADERS.indexOf(l), 1);
  for (const d of addedDefinitions.splice(0)) ALL_DEFINITIONS.splice(ALL_DEFINITIONS.indexOf(d), 1);
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(getBonusConfig).mockResolvedValue(VAULT_BONUS_DEFAULTS);
});

describe("definitions", () => {
  it("have unique ids, one of the ten categories, and an icon the UI map draws", () => {
    expect(new Set(ALL_DEFINITIONS.map((d) => d.id)).size).toBe(ALL_DEFINITIONS.length);
    for (const def of ALL_DEFINITIONS) {
      expect([def.id, CATEGORIES.includes(def.category)]).toEqual([def.id, true]);
      expect([def.id, def.icon in ACHIEVEMENT_ICON_MAP]).toEqual([def.id, true]);
    }
  });

  it("map every icon key to a component, and nothing else", () => {
    expect(Object.keys(ACHIEVEMENT_ICON_MAP).sort()).toEqual([...ACHIEVEMENT_ICON_KEYS].sort());
    for (const Icon of Object.values(ACHIEVEMENT_ICON_MAP)) {
      expect(Icon).toBeDefined();
    }
  });

  it("can all unlock: an active definition has a rule or a condition", () => {
    for (const def of ALL_DEFINITIONS.filter((d) => !d.retired)) {
      expect([def.id, Boolean(def.rule ?? def.condition)]).toEqual([def.id, true]);
    }
  });
});

describe("rules read data.metrics", () => {
  const country = { id: "c1" } as never;

  it("unlocks a rule on a loader metric, and not below its threshold", () => {
    define({ id: "test-steady", rule: ["EXECUTIVE", "steadyHandWeeks", ">=", 1] });
    const stored = { key: "test-steady", conditionJson: null };

    expect(
      achievementService.evaluateCondition(stored, { country, metrics: { steadyHandWeeks: 1 } })
    ).toBe(true);
    expect(
      achievementService.evaluateCondition(stored, { country, metrics: { steadyHandWeeks: 0 } })
    ).toBe(false);
    expect(achievementService.evaluateCondition(stored, { country })).toBe(false);
  });

  it("reads metrics before a field of the same name, and falls back to the fields", () => {
    const stored = { key: "custom", conditionJson: rule("daysActive", 10) };

    expect(
      achievementService.evaluateCondition(stored, {
        country,
        daysActive: 400,
        metrics: { daysActive: 2 },
      })
    ).toBe(false);
    expect(achievementService.evaluateCondition(stored, { country, daysActive: 400 })).toBe(true);
  });

  it("syncs a definition's rule as its stored trigger", async () => {
    define({ id: "test-synced", rule: ["EXECUTIVE", "steadyHandWeeks", ">=", 1] });
    const db = createMockPrisma();
    jest.spyOn(console, "log").mockImplementation(() => {});

    await syncAchievements(db as never);

    const created = db.achievement.upsert.mock.calls
      .map(([args]: [{ create: { key: string } }]) => args.create)
      .find((row: { key: string }) => row.key === "test-synced");
    expect(created).toMatchObject({
      triggerType: "EXECUTIVE",
      conditionJson: JSON.stringify({ metric: "steadyHandWeeks", operator: ">=", value: 1 }),
      isActive: true,
    });
  });
});

describe("scope follows the loader", () => {
  it("makes a rule on an account-scope loader key account-level, and a country-scope key not", () => {
    register(loader({ scope: "account", keys: ["wikiEdits"] }));
    register(loader({ scope: "country", keys: ["issuesAnswered"] }));
    define({ id: "test-wiki", category: "Wiki", rule: ["WIKI", "wikiEdits", ">=", 1] });
    define({ id: "test-issues", rule: ["EXECUTIVE", "issuesAnswered", ">=", 1] });

    expect(achievementRequiresCountry({ key: "test-wiki" })).toBe(false);
    expect(achievementRequiresCountry({ key: "test-issues" })).toBe(true);
    expect(achievementRequiresCountry({ key: "custom", conditionJson: rule("wikiEdits") })).toBe(
      false
    );
    expect(
      achievementRequiresCountry({ key: "custom", conditionJson: rule("issuesAnswered") })
    ).toBe(true);
  });

  it("treats a condition-only definition as country-bound unless it says accountLevel", () => {
    define({ id: "test-cond", condition: () => true });
    define({ id: "test-cond-account", condition: () => true, accountLevel: true });

    expect(achievementRequiresCountry({ key: "test-cond" })).toBe(true);
    expect(achievementRequiresCountry({ key: "test-cond-account" })).toBe(false);
  });
});

describe("loaders in checkAndUnlock", () => {
  function setup(opts: { country: boolean }) {
    const db = createMockPrisma();
    db.user.findUnique.mockResolvedValue({
      id: USER_ID,
      createdAt: new Date(),
      countryId: opts.country ? "c1" : null,
    });
    db.userAchievement.findMany.mockResolvedValue([]);
    db.thinkpagesPost.count.mockResolvedValue(0);
    db.cardOwnership.count.mockResolvedValue(0);
    db.cardOwnership.findMany.mockResolvedValue([]);
    db.militaryBranch.findMany.mockResolvedValue([]);
    db.embassy.count.mockResolvedValue(0);
    db.governmentComponent.count.mockResolvedValue(0);
    db.countryFollow.count.mockResolvedValue(0);
    db.country.findUnique.mockResolvedValue({
      id: "c1",
      currentTotalGdp: 1,
      currentGdpPerCapita: 1,
      currentPopulation: 1,
      economicTier: "Tier 3",
      adjustedGdpGrowth: 1,
      populationGrowthRate: 1,
      actualGdpGrowth: 1,
      createdAt: new Date(),
    });
    db.achievement.findMany.mockResolvedValue([
      {
        key: "test-account-metric",
        title: "Account metric",
        description: "",
        category: "Wiki",
        rarity: "Common",
        points: 10,
        iconUrl: "Page",
        triggerType: "WIKI",
        conditionJson: rule("wikiEdits", 3),
        rewardsJson: null,
        isActive: true,
      },
      {
        key: "test-country-metric",
        title: "Country metric",
        description: "",
        category: "Executive",
        rarity: "Common",
        points: 10,
        iconUrl: "Flash",
        triggerType: "EXECUTIVE",
        conditionJson: rule("issuesAnswered", 5),
        rewardsJson: null,
        isActive: true,
      },
    ]);
    return db;
  }

  it("runs each loader once, with both ids and one instant, and unlocks from what they return", async () => {
    const account = register(
      loader({
        scope: "account",
        keys: ["wikiEdits"],
        load: jest.fn().mockResolvedValue({ wikiEdits: 3 }),
      })
    );
    const countryLoader = register(
      loader({
        scope: "country",
        keys: ["issuesAnswered"],
        load: jest.fn().mockResolvedValue({ issuesAnswered: 5 }),
      })
    );
    const db = setup({ country: true });

    const unlocked = await achievementService.checkAndUnlock(CLERK_ID, "c1", db as never);

    expect(unlocked.sort()).toEqual(["test-account-metric", "test-country-metric"]);
    expect(account.load).toHaveBeenCalledTimes(1);
    expect(countryLoader.load).toHaveBeenCalledTimes(1);
    const accountCtx = jest.mocked(account.load).mock.calls[0]![0];
    const countryCtx = jest.mocked(countryLoader.load).mock.calls[0]![0];
    expect(accountCtx).toMatchObject({ clerkUserId: CLERK_ID, userId: USER_ID, countryId: "c1" });
    expect(countryCtx).toMatchObject({ clerkUserId: CLERK_ID, userId: USER_ID, countryId: "c1" });
    expect(countryCtx.now).toBe(accountCtx.now);
  });

  it("runs country loaders only when the user has a country", async () => {
    const account = register(
      loader({
        scope: "account",
        keys: ["wikiEdits"],
        load: jest.fn().mockResolvedValue({ wikiEdits: 3 }),
      })
    );
    const countryLoader = register(loader({ scope: "country", keys: ["issuesAnswered"] }));
    const db = setup({ country: false });

    const unlocked = await achievementService.checkAndUnlock(CLERK_ID, null, db as never);

    expect(unlocked).toEqual(["test-account-metric"]);
    expect(account.load).toHaveBeenCalledWith(expect.objectContaining({ countryId: null }));
    expect(countryLoader.load).not.toHaveBeenCalled();
  });

  it("starts every loader of a scope before any finishes", async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    const first = register(
      loader({
        id: "slow",
        scope: "account",
        keys: ["a"],
        load: jest.fn(async () => {
          await gate;
          return { a: 1 };
        }),
      })
    );
    const second = register(loader({ id: "fast", scope: "account", keys: ["b"] }));
    const db = setup({ country: false });

    const run = achievementService.checkAndUnlock(CLERK_ID, null, db as never);
    await new Promise((resolve) => setImmediate(resolve));
    expect(first.load).toHaveBeenCalledTimes(1);
    expect(second.load).toHaveBeenCalledTimes(1);
    release();
    await run;
  });

  it("carries on when a loader fails, leaving its rules unmet", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    register(
      loader({
        id: "broken",
        scope: "account",
        keys: ["wikiEdits"],
        load: jest.fn().mockRejectedValue(new Error("boom")),
      })
    );
    register(
      loader({
        id: "fine",
        scope: "country",
        keys: ["issuesAnswered"],
        load: jest.fn().mockResolvedValue({ issuesAnswered: 5 }),
      })
    );
    const db = setup({ country: true });

    const unlocked = await achievementService.checkAndUnlock(CLERK_ID, "c1", db as never);

    expect(unlocked).toEqual(["test-country-metric"]);
  });
});
