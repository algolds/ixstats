/** @jest-environment node */
/**
 * Retired (Legacy) achievements: the sync marks them inactive once, they never evaluate, and
 * what players already earned still counts toward the achievement-count tiers.
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
import { achievementService } from "~/lib/achievements/service";
import { ALL_DEFINITIONS } from "~/lib/achievements/sets";
import { RETIRED_IDS, syncAchievements } from "~/lib/achievements/sync";
import { getBonusConfig, VAULT_BONUS_DEFAULTS } from "~/lib/vault/vault-bonus";
import { createMockPrisma } from "~/tests/helpers/mock-db";

/** Spec section 5.2, id by id. */
const SPEC_RETIRED = [
  // GDP tiers, GDP per capita tiers, population tiers
  ...["econ-first-million", "econ-millionaire-nation", "econ-economic-powerhouse"],
  ...["econ-trillion-club", "econ-global-titan"],
  ...["econ-wealthy-citizens", "econ-prosperity-nation", "econ-first-world-status"],
  "econ-ultra-prosperity",
  ...["pop-rising-nation", "gen-population-growth", "pop-major-power", "pop-superpower"],
  "pop-demographic-titan",
  // unwinnable economy
  ...["econ-growth-rocket", "econ-boom-cycle", "econ-full-employment", "econ-price-stability"],
  ...["econ-tax-efficiency", "econ-tier-advancement"],
  // military spend, personnel, branches
  ...["mil-defense-commitment", "mil-strong-defense", "mil-military-superpower"],
  ...["mil-standing-army", "mil-large-force", "mil-massive-force", "mil-global-force"],
  ...["mil-armed-forces", "mil-full-spectrum"],
  // embassy tiers, treaties, trade, alliances
  ...["dip-diplomatic-network", "dip-global-presence", "dip-embassy-network"],
  ...["dip-first-treaty", "dip-treaty-network", "dip-trade-partners", "dip-trade-hub"],
  ...["dip-alliance-maker", "dip-alliance-network"],
  // atomic components, government types
  ...["gov-building-blocks", "gov-sophisticated", "gov-complex-system"],
  ...["gov-democracy", "gov-republic", "gov-monarchy", "gov-federation", "gov-unitary"],
  "gov-parliamentary",
];

const KEPT = [
  "gen-first-country",
  "gov-first-component",
  "dip-first-embassy",
  "mil-first-branch",
  "meme-stonks",
  "meme-1337",
  "meme-bankruptcy",
  "vid-lightswitch",
  "vid-annual",
  "meme-ns-ref",
  "vid-end-of-days",
];

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(getBonusConfig).mockResolvedValue(VAULT_BONUS_DEFAULTS);
  jest.spyOn(console, "log").mockImplementation(() => {});
});

describe("the retired set", () => {
  it("is exactly the spec's Legacy list, and the kept ids are not in it", () => {
    expect([...RETIRED_IDS].sort()).toEqual([...SPEC_RETIRED].sort());
    for (const id of KEPT) expect(RETIRED_IDS.has(id)).toBe(false);
  });

  it("has no rule or condition: a Legacy definition keeps only its display data", () => {
    for (const id of SPEC_RETIRED) {
      const def = getAchievementById(id)!;
      expect([id, def.retired, def.rule, def.condition]).toEqual([id, true, undefined, undefined]);
    }
  });
});

describe("syncAchievements", () => {
  function upserts(db: ReturnType<typeof createMockPrisma>) {
    return new Map<string, { isActive: boolean; iconUrl: string }>(
      db.achievement.upsert.mock.calls.map(([args]: [{ create: { key: string } }]) => [
        args.create.key,
        args.create as never,
      ])
    );
  }

  it("writes isActive false for every retired id and true for the rest, with the icon key", async () => {
    const db = createMockPrisma();
    await syncAchievements(db as never);

    const rows = upserts(db);
    expect(rows.size).toBe(ALL_DEFINITIONS.length);
    for (const def of ALL_DEFINITIONS) {
      expect([def.id, rows.get(def.id)?.isActive]).toEqual([def.id, !def.retired]);
      expect(rows.get(def.id)?.iconUrl).toBe(def.icon);
    }
  });

  it("leaves retired rows that are already inactive alone, and retires the ones still active", async () => {
    const db = createMockPrisma();
    const alreadyRetired = SPEC_RETIRED.slice(0, 40);
    db.achievement.findMany.mockResolvedValue(alreadyRetired.map((key) => ({ key })));

    await syncAchievements(db as never);

    expect(db.achievement.findMany).toHaveBeenCalledWith({
      where: { key: { in: [...RETIRED_IDS] }, isActive: false },
      select: { key: true },
    });
    const rows = upserts(db);
    for (const key of alreadyRetired) expect(rows.has(key)).toBe(false);
    for (const key of SPEC_RETIRED.slice(40)) expect(rows.get(key)?.isActive).toBe(false);
    expect(rows.get("gen-welcome")?.isActive).toBe(true);
  });
});

describe("a retired achievement never evaluates", () => {
  const country = {
    id: "c1",
    currentTotalGdp: 9e12,
    currentGdpPerCapita: 9e5,
    currentPopulation: 9e8,
    economicTier: "Tier 1",
    adjustedGdpGrowth: 20,
    populationGrowthRate: 1,
    actualGdpGrowth: 20,
    createdAt: new Date(),
  };

  it("fails evaluateCondition even when a stale stored rule is met", () => {
    const stale = JSON.stringify({ metric: "adjustedGdpGrowth", operator: ">=", value: 10 });
    expect(
      achievementService.evaluateCondition(
        { key: "econ-growth-rocket", conditionJson: stale },
        { country }
      )
    ).toBe(false);
  });

  it("is not unlocked by checkAndUnlock while its row is still active", async () => {
    const db = createMockPrisma();
    db.user.findUnique.mockResolvedValue({ id: "u1", createdAt: new Date(), countryId: "c1" });
    db.country.findUnique.mockResolvedValue(country);
    db.userAchievement.findMany.mockResolvedValue([]);
    db.militaryBranch.findMany.mockResolvedValue([]);
    db.achievement.findMany.mockResolvedValue([
      {
        key: "econ-growth-rocket",
        title: "Growth Rocket",
        description: "",
        category: "Nation",
        rarity: "Rare",
        points: 50,
        iconUrl: "Rocket",
        triggerType: "ECONOMIC",
        conditionJson: JSON.stringify({ metric: "adjustedGdpGrowth", operator: ">=", value: 10 }),
        rewardsJson: null,
        isActive: true,
      },
    ]);

    const unlocked = await achievementService.checkAndUnlock("clerk_1", "c1", db as never);

    expect(unlocked).toEqual([]);
    expect(db.userAchievement.create).not.toHaveBeenCalled();
  });
});

describe("Legacy unlocks still count", () => {
  it("toward the achievement-hunter tier", async () => {
    const db = createMockPrisma();
    db.user.findUnique.mockResolvedValue({ id: "u1", createdAt: new Date(), countryId: null });
    db.thinkpagesPost.count.mockResolvedValue(0);
    db.cardOwnership.count.mockResolvedValue(0);
    db.cardOwnership.findMany.mockResolvedValue([]);
    // Ten held, all retired: none of them is evaluated again, all of them count
    db.userAchievement.findMany.mockResolvedValue(
      SPEC_RETIRED.slice(0, 10).map((achievementId) => ({ achievementId }))
    );
    db.achievement.findMany.mockResolvedValue([
      {
        key: "gen-achievement-hunter",
        title: "Achievement Hunter",
        description: "",
        category: "General",
        rarity: "Uncommon",
        points: 25,
        iconUrl: "Trophy",
        triggerType: "GENERAL",
        conditionJson: JSON.stringify({ metric: "totalAchievements", operator: ">=", value: 10 }),
        rewardsJson: null,
        isActive: true,
      },
    ]);

    const unlocked = await achievementService.checkAndUnlock("clerk_1", null, db as never);

    expect(unlocked).toEqual(["gen-achievement-hunter"]);
  });
});

describe("vid-end-of-days", () => {
  const TREES = new Set(["Executive", "Politics", "Diplomacy"]);
  const targets = () =>
    ALL_DEFINITIONS.filter(
      (d) => !d.retired && d.id !== "vid-end-of-days" && TREES.has(d.category)
    ).map((d) => d.id);
  const stored = { key: "vid-end-of-days", conditionJson: JSON.stringify({}) };

  it("unlocks when every active Executive, Politics and Diplomacy achievement is held", () => {
    expect(targets().length).toBeGreaterThan(0);
    expect(achievementService.evaluateCondition(stored, { existingKeys: targets() })).toBe(true);
  });

  it("stays locked with one missing, with none held, and ignores Legacy keys", () => {
    const [missing, ...rest] = targets();
    expect(missing).toBeDefined();
    expect(achievementService.evaluateCondition(stored, { existingKeys: rest })).toBe(false);
    expect(achievementService.evaluateCondition(stored, { existingKeys: [] })).toBe(false);
    expect(
      achievementService.evaluateCondition(stored, {
        existingKeys: [...rest, ...SPEC_RETIRED],
      })
    ).toBe(false);
  });

  it("needs no country", () => {
    expect(
      achievementService.evaluateCondition(stored, { existingKeys: targets(), country: undefined })
    ).toBe(true);
  });

  it("cascades: the unlock that completes the set unlocks it in the same evaluation", async () => {
    const db = createMockPrisma();
    const missing = "dip-first-embassy";
    expect(targets()).toContain(missing);
    db.user.findUnique.mockResolvedValue({ id: "u1", createdAt: new Date(), countryId: "c1" });
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
    db.embassy.count.mockResolvedValue(1);
    db.militaryBranch.findMany.mockResolvedValue([]);
    db.governmentComponent.count.mockResolvedValue(0);
    db.countryFollow.count.mockResolvedValue(0);
    db.thinkpagesPost.count.mockResolvedValue(0);
    db.cardOwnership.count.mockResolvedValue(0);
    db.cardOwnership.findMany.mockResolvedValue([]);
    db.userAchievement.findMany.mockResolvedValue(
      targets()
        .filter((id) => id !== missing)
        .map((achievementId) => ({ achievementId }))
    );
    const row = (key: string, conditionJson: string, rarity: string) => ({
      key,
      title: key,
      description: "",
      category: "General",
      rarity,
      points: 10,
      iconUrl: "Trophy",
      triggerType: "X",
      conditionJson,
      rewardsJson: null,
      isActive: true,
    });
    db.achievement.findMany.mockResolvedValue([
      row(missing, JSON.stringify({ metric: "embassyCount", operator: ">=", value: 1 }), "Common"),
      row("vid-end-of-days", JSON.stringify({}), "Legendary"),
    ]);

    const unlocked = await achievementService.checkAndUnlock("clerk_1", "c1", db as never);

    expect(unlocked).toEqual([missing, "vid-end-of-days"]);
  });
});
