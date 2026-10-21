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
import { METRIC_LOADERS } from "~/lib/achievements/metrics/registry";
import { achievementRequiresCountry } from "~/lib/achievements/scope";
import { achievementService } from "~/lib/achievements/service";
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
describe("Executive and Politics definitions", () => {
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
