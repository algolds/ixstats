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

import { ACHIEVEMENT_ICON_MAP } from "~/components/achievements/constants";
import { METRIC_LOADERS } from "~/lib/achievements/metrics/registry";
import { PLATFORM_LOADERS } from "~/lib/achievements/metrics/platform";
import { achievementRequiresCountry } from "~/lib/achievements/scope";
import { achievementService } from "~/lib/achievements/service";
import { ALL_DEFINITIONS } from "~/lib/achievements/sets";
import { PLATFORM_DEFINITIONS } from "~/lib/achievements/sets/platform";

const SPEC: Record<string, { category: string; rarity: string }> = {
  "wiki-first-edit": { category: "Wiki", rarity: "Common" },
  "wiki-edits-10": { category: "Wiki", rarity: "Uncommon" },
  "wiki-edits-100": { category: "Wiki", rarity: "Rare" },
  "wiki-edits-1000": { category: "Wiki", rarity: "Epic" },
  "wiki-first-article": { category: "Wiki", rarity: "Common" },
  "wiki-articles-10": { category: "Wiki", rarity: "Rare" },
  "wiki-fifty-pages": { category: "Wiki", rarity: "Rare" },
  "social-first-thread": { category: "Social", rarity: "Common" },
  "social-threads-10": { category: "Social", rarity: "Uncommon" },
  "social-replies-100": { category: "Social", rarity: "Rare" },
  "social-replies-received-50": { category: "Social", rarity: "Rare" },
  "social-found-thinktank": { category: "Social", rarity: "Uncommon" },
  "social-join-thinktank": { category: "Social", rarity: "Common" },
  "social-posting-streak-7": { category: "Social", rarity: "Uncommon" },
  "cards-first-pack": { category: "Cards", rarity: "Common" },
  "cards-packs-25": { category: "Cards", rarity: "Uncommon" },
  "cards-packs-100": { category: "Cards", rarity: "Rare" },
  "cards-first-trade": { category: "Cards", rarity: "Common" },
  "cards-trades-10": { category: "Cards", rarity: "Uncommon" },
  "cards-first-sale": { category: "Cards", rarity: "Uncommon" },
  "cards-first-legendary": { category: "Cards", rarity: "Rare" },
  "cards-deck-10k": { category: "Cards", rarity: "Rare" },
  "cards-deck-50k": { category: "Cards", rarity: "Epic" },
  "cards-claim-7": { category: "Cards", rarity: "Uncommon" },
  "cards-claim-30": { category: "Cards", rarity: "Rare" },
  "cards-claim-100": { category: "Cards", rarity: "Epic" },
  "lorewards-first": { category: "Lorewards", rarity: "Uncommon" },
  "lorewards-daily-5": { category: "Lorewards", rarity: "Uncommon" },
  "lorewards-daily-25": { category: "Lorewards", rarity: "Rare" },
  "lorewards-daily-100": { category: "Lorewards", rarity: "Legendary" },
  "lorewards-first-weekly": { category: "Lorewards", rarity: "Rare" },
  "lorewards-first-monthly": { category: "Lorewards", rarity: "Epic" },
  "lorewards-streak-7": { category: "Lorewards", rarity: "Epic" },
  "lorewards-first-runner-up": { category: "Lorewards", rarity: "Uncommon" },
  "gen-renaissance": { category: "General", rarity: "Epic" },
  "gen-first-onoma": { category: "General", rarity: "Common" },
  "gen-first-vexel": { category: "General", rarity: "Common" },
  "gen-first-map-edit": { category: "General", rarity: "Uncommon" },
};

const PRODUCED = METRIC_LOADERS.filter((l) => l.scope === "account").flatMap((l) => l.keys);
const RULE_DEFINITIONS = PLATFORM_DEFINITIONS.filter((d) => d.rule);

const unlocks = (id: string, metrics: Record<string, number>) =>
  achievementService.evaluateCondition({ key: id, conditionJson: null }, { metrics });

describe("platform definitions", () => {
  it("are registered with the spec's categories, rarities and an icon the UI draws", () => {
    expect(PLATFORM_DEFINITIONS.map((d) => d.id).sort()).toEqual(Object.keys(SPEC).sort());
    for (const def of PLATFORM_DEFINITIONS) {
      expect(ALL_DEFINITIONS).toContain(def);
      expect({ category: def.category, rarity: def.rarity }).toEqual(SPEC[def.id]);
      expect(def.icon in ACHIEVEMENT_ICON_MAP).toBe(true);
      expect(def.description).not.toMatch(/[—–]/);
      expect(def.retired).toBeUndefined();
    }
  });

  it("drops the sets achievements (no set concept) and adds no ids twice", () => {
    const ids = ALL_DEFINITIONS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.filter((id) => /set/i.test(id))).toEqual([]);
  });

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

describe("platform achievement copy", () => {
  it("calls the wiki the wiki, never IxWiki", () => {
    const wiki = PLATFORM_DEFINITIONS.filter((d) => d.id.startsWith("wiki-"));
    expect(wiki.length).toBeGreaterThan(0);
    for (const def of wiki) {
      expect(def.description).toMatch(/on the wiki/);
      expect(def.description).not.toMatch(/IxWiki/i);
    }
  });
});

function getRule(id: string) {
  return PLATFORM_DEFINITIONS.find((d) => d.id === id)?.rule;
}
