/** @jest-environment node */
/**
 * Achievements that used to be synced as CUSTOM with an empty rule: each now has a real
 * baseline rule, or (when one metric comparison cannot express it) is evaluated through its
 * definition condition. Every one must be able to unlock.
 */

jest.mock("~/lib/vault/vault-bonus", () => ({
  ...jest.requireActual("~/lib/vault/vault-bonus"),
  getBonusConfig: jest.fn(),
  grantBonus: jest.fn(),
}));
jest.mock("~/lib/cards/card-service", () => ({ awardAchievementCard: jest.fn() }));
jest.mock("~/lib/activity", () => ({ ActivityHooks: { User: {} } }));
jest.mock("~/lib/notifications/hooks", () => ({ notificationHooks: {} }));
jest.mock("~/lib/achievements/scaling", () => ({
  ...jest.requireActual("~/lib/achievements/scaling"),
  getScaleThresholds: jest.fn().mockResolvedValue({}),
}));

import type { ExtendedAchievementData } from "~/lib/achievements/definitions";
import { syncAchievements } from "~/lib/achievements/sync";
import { achievementService } from "~/lib/achievements/service";
import { createMockPrisma } from "~/tests/helpers/mock-db";

type Row = { key: string; triggerType: string; conditionJson: string };

async function syncedRows(): Promise<Map<string, Row>> {
  const db = createMockPrisma();
  jest.spyOn(console, "log").mockImplementation(() => {});
  await syncAchievements(db as never);
  return new Map(
    db.achievement.upsert.mock.calls.map(([args]: any[]) => [args.create.key, args.create as Row])
  );
}

const COUNTRY = {
  id: "c1",
  currentTotalGdp: 1_000_000,
  currentGdpPerCapita: 5000,
  currentPopulation: 1000,
  economicTier: "Tier 3",
  adjustedGdpGrowth: 2,
  populationGrowthRate: 1,
  actualGdpGrowth: 2,
  unemploymentRate: 5,
  inflationRate: 2,
  taxRevenueGDPPercent: 20,
  lifeExpectancy: 70,
  literacyRate: 90,
  createdAt: new Date(),
};

function data(over: Partial<ExtendedAchievementData>, country = {}): ExtendedAchievementData {
  return { country: { ...COUNTRY, ...country }, ...over } as ExtendedAchievementData;
}

const RULE_BACKED: Array<[string, Partial<ExtendedAchievementData>, object]> = [
  ["vid-end-of-days", { totalAchievements: 30 }, {}],
  ["meme-stonks", {}, { adjustedGdpGrowth: -1 }],
  ["meme-bankruptcy", {}, { currentGdpPerCapita: 0 }],
  ["meme-ns-ref", { totalAchievements: 40 }, {}],
  ["lore-scholar", { thinkpageCount: 5 }, {}],
  ["lore-collector", { followerCount: 30 }, {}],
  ["collect-lore-keeper", { loreCardCount: 50 }, {}],
  ["collect-archaeologist", { retiredCardCount: 10 }, {}],
  ["collect-diplomat", { distinctCountryIdCount: 20 }, {}],
];

// Compound or derived checks, evaluated by the definition condition
const DEFINITION_BACKED: Array<[string, Partial<ExtendedAchievementData>, object]> = [
  ["vid-annual", { daysActive: 365 }, {}],
  ["vid-lightswitch", { embassyCount: 25, totalMilitaryPersonnel: 0 }, {}],
  ["meme-1337", {}, { currentGdpPerCapita: 1337.4 }],
];

describe("formerly CUSTOM achievements", () => {
  it.each(RULE_BACKED)("%s syncs a real rule and unlocks", async (key, extra, country) => {
    const rows = await syncedRows();
    const row = rows.get(key)!;
    expect(row.triggerType).not.toBe("CUSTOM");
    expect(JSON.parse(row.conditionJson).metric).toEqual(expect.any(String));
    expect(achievementService.evaluateCondition(row, data(extra, country))).toBe(true);
  });

  it.each(RULE_BACKED)("%s stays locked below its threshold", async (key) => {
    const row = (await syncedRows()).get(key)!;
    const locked = data(
      {
        totalAchievements: 0,
        thinkpageCount: 0,
        followerCount: 0,
        loreCardCount: 0,
        retiredCardCount: 0,
        distinctCountryIdCount: 0,
      },
      { adjustedGdpGrowth: 3, currentGdpPerCapita: 5000 }
    );
    expect(achievementService.evaluateCondition(row, locked)).toBe(false);
  });

  it.each(DEFINITION_BACKED)("%s unlocks through its definition condition", async (key, extra, country) => {
    const row = (await syncedRows()).get(key)!;
    expect(achievementService.evaluateCondition(row, data(extra, country))).toBe(true);
  });

  it("vid-lightswitch needs zero military personnel, not just 25 embassies", async () => {
    const row = (await syncedRows()).get("vid-lightswitch")!;
    expect(
      achievementService.evaluateCondition(row, data({ embassyCount: 25, totalMilitaryPersonnel: 5 }))
    ).toBe(false);
  });
});
