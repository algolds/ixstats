/** @jest-environment node */
/**
 * The Executive and Politics sets: every rule reads a metric a registered loader produces, every
 * loader key is used, rarities follow the spec, and each rule unlocks exactly at its threshold.
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

import { ACHIEVEMENT_ICON_MAP } from "~/components/achievements/constants";
import { METRIC_LOADERS } from "~/lib/achievements/metrics/registry";
import { achievementRequiresCountry } from "~/lib/achievements/scope";
import { achievementService } from "~/lib/achievements/service";
import { ALL_DEFINITIONS } from "~/lib/achievements/sets";
import { EXECUTIVE_DEFINITIONS } from "~/lib/achievements/sets/executive";
import { POLITICS_DEFINITIONS } from "~/lib/achievements/sets/politics";

const DEFINITIONS = [...EXECUTIVE_DEFINITIONS, ...POLITICS_DEFINITIONS];

const KEYS = [
  "directivesCommitted",
  "directivesCompletedCategories",
  "directiveWeeks",
  "directiveChainDepth",
  "directivesDisciplineOk",
  "issuesAnswered",
  "issues100Over12Weeks",
  "issues250Over26Weeks",
  "issueDomainsAt15",
  "criticalStableGains",
  "issueCoverage6mOk",
  "issueLongestWeeks",
  "brokersSatisfied",
  "budgetCurrentYear",
  "fiscalSteward18m",
  "electionsHeld",
  "lawMonths",
  "lawsPassed",
  "meetingsWithDecisions",
  "officials6m",
  "fullTerm",
  "peacefulTransitions",
];

const RARITY: Record<string, string> = {
  "exec-first-directive": "Common",
  "exec-first-issue": "Common",
  "exec-first-budget": "Common",
  "exec-steady-hand": "Rare",
  "exec-head-of-state": "Epic",
  "exec-every-corner": "Rare",
  "exec-crisis-manager": "Epic",
  "exec-nothing-unanswered": "Epic",
  "exec-never-off-duty": "Legendary",
  "exec-full-portfolio": "Rare",
  "exec-steady-cadence": "Rare",
  "exec-long-campaign": "Epic",
  "exec-discipline": "Rare",
  "exec-grand-coalition": "Epic",
  "exec-all-five-estates": "Legendary",
  "exec-fiscal-steward": "Epic",
  "pol-first-election": "Common",
  "pol-first-law": "Common",
  "pol-lawgiver": "Epic",
  "pol-council-of-state": "Rare",
  "pol-seasoned-cabinet": "Rare",
  "pol-full-term": "Epic",
  "pol-peaceful-transitions": "Legendary",
};

describe("Executive and Politics definitions", () => {
  it("are registered, with the spec's rarities, categories and an icon the UI draws", () => {
    expect(DEFINITIONS.map((d) => d.id).sort()).toEqual(Object.keys(RARITY).sort());
    for (const def of DEFINITIONS) {
      expect(ALL_DEFINITIONS).toContain(def);
      expect([def.id, def.rarity]).toEqual([def.id, RARITY[def.id]]);
      expect(def.category).toBe(def.id.startsWith("exec-") ? "Executive" : "Politics");
      expect(def.icon in ACHIEVEMENT_ICON_MAP).toBe(true);
      expect(def.description).not.toMatch(/[—–]/);
    }
  });

  it("read the 22 loader keys, each from a registered country loader, and every key is used", () => {
    const produced = METRIC_LOADERS.filter((l) => l.scope === "country").flatMap((l) => l.keys);
    const used = DEFINITIONS.map((d) => d.rule![1]);
    for (const metric of used) expect(produced).toContain(metric);
    expect(new Set(used)).toEqual(new Set(KEYS));
    for (const key of KEYS) expect(produced.filter((k) => k === key)).toHaveLength(1);
  });

  it("need a country", () => {
    for (const def of DEFINITIONS) {
      expect(achievementRequiresCountry({ key: def.id })).toBe(true);
    }
  });

  it.each(DEFINITIONS.map((d) => [d.id, d] as const))(
    "%s unlocks at its threshold, not below",
    (id, def) => {
      const [, metric, , value] = def.rule!;
      const country = { id: "c1" } as never;
      const stored = { key: id, conditionJson: null };
      const unlocks = (n: number) =>
        achievementService.evaluateCondition(stored, { country, metrics: { [metric]: n } });

      expect(unlocks(Number(value))).toBe(true);
      expect(unlocks(Number(value) - 1)).toBe(false);
    }
  );
});
