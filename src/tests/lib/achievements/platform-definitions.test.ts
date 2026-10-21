/** @jest-environment node */
/**
 * The platform set (Wiki, Community, Cards, Lorewards, General): every rule reads a key a registered
 * account loader produces (the map-edit key belongs to the nation loaders), the dropped sets
 * achievements are absent, the registries carry the set, and each unlocks exactly at its threshold
 * for a user with no country.
 */
jest.mock("~/lib/vault/vault-bonus", () => ({
  ...jest.requireActual("~/lib/vault/vault-bonus"),
  getBonusConfig: jest.fn(),
  grantBonus: jest.fn(),
}));
jest.mock("~/lib/cards/card-service", () => ({ awardAchievementCard: jest.fn() }));
jest.mock("~/lib/activity", () => ({
  ActivityHooks: { User: { onAchievementUnlocked: jest.fn() } },
}));
jest.mock("~/lib/notifications/hooks", () => ({
  notificationHooks: { onAchievementUnlock: jest.fn() },
}));
import { METRIC_LOADERS } from "~/lib/achievements/metrics/registry";
import { PLATFORM_LOADERS } from "~/lib/achievements/metrics/platform";
import { achievementRequiresCountry } from "~/lib/achievements/scope";
import { achievementService } from "~/lib/achievements/service";
import { PLATFORM_DEFINITIONS } from "~/lib/achievements/sets/platform";
const PRODUCED = METRIC_LOADERS.filter((l) => l.scope === "account").flatMap((l) => l.keys);
const RULE_DEFINITIONS = PLATFORM_DEFINITIONS.filter((d) => d.rule);

const unlocks = (id: string, metrics: Record<string, number>) =>
  achievementService.evaluateCondition({ key: id, conditionJson: null }, { metrics });

describe("platform definitions", () => {
  it("registers every platform loader", () => {
    for (const loader of PLATFORM_LOADERS) expect(METRIC_LOADERS).toContain(loader);
  });

  it("rules read a key an account loader produces, and every platform key is used", () => {
    const used = RULE_DEFINITIONS.map((d) => d.rule![1]);
    for (const metric of used) {
      // includes mapEditsApproved, which the nation loaders own
      expect(PRODUCED).toContain(metric);
    }
    // lorewardDailyWins etc. also feed the "First Loreward" condition
    const platformKeys = PLATFORM_LOADERS.flatMap((l) => l.keys);
    expect(platformKeys.filter((k) => !used.includes(k))).toEqual([]);
  });

  it("evaluate without a country", () => {
    for (const def of PLATFORM_DEFINITIONS) {
      expect(achievementRequiresCountry({ key: def.id })).toBe(false);
    }
  });

  it.each(RULE_DEFINITIONS.map((d) => [d.id, d] as const))(
    "%s unlocks at its threshold, not below",
    (id, def) => {
      const [, metric, , value] = def.rule!;
      expect(unlocks(id, { [metric]: Number(value) })).toBe(true);
      expect(unlocks(id, { [metric]: Number(value) - 1 })).toBe(false);
    }
  );

  it("reads the trophy-excluding deck value, 10k and 50k", () => {
    expect(getRule("cards-deck-10k")).toEqual(["CARDS", "deckValueExTrophy", ">=", 10_000]);
    expect(getRule("cards-deck-50k")).toEqual(["CARDS", "deckValueExTrophy", ">=", 50_000]);
  });

  it("First Loreward unlocks on any win: daily, weekly or monthly", () => {
    const none = { lorewardDailyWins: 0, lorewardWeeklyWins: 0, lorewardMonthlyWins: 0 };
    expect(unlocks("lorewards-first", none)).toBe(false);
    expect(unlocks("lorewards-first", { ...none, lorewardDailyWins: 1 })).toBe(true);
    expect(unlocks("lorewards-first", { ...none, lorewardWeeklyWins: 1 })).toBe(true);
    expect(unlocks("lorewards-first", { ...none, lorewardMonthlyWins: 1 })).toBe(true);
    // a runner-up place alone is not a win
    expect(unlocks("lorewards-first", { ...none, lorewardRunnerUps: 3 })).toBe(false);
    expect(
      achievementService.evaluateCondition({ key: "lorewards-first", conditionJson: null }, {})
    ).toBe(false);
  });
});

function getRule(id: string) {
  return PLATFORM_DEFINITIONS.find((d) => d.id === id)?.rule;
}
