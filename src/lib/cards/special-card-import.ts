/**
 * The five Special cards the CLI seed used to create, now a one-time import. Each is an achievement reward: bound, in
 * Ixnay, naming its achievement. The plan creates the missing ones and points existing ones at their achievement; it
 * never overwrites a title, rarity or art an admin edited, and leaves an achievement whose reward an admin already
 * made in the Designer to that card.
 */
import type { SpecialCardKind } from "@prisma/client";
import type { CardRarity } from "~/lib/cards/enums";

export interface LegacySpecialCard {
  id: string;
  title: string;
  description: string;
  rarity: CardRarity;
  achievementKey: string;
}

export const LEGACY_SPECIAL_CARDS: readonly LegacySpecialCard[] = [
  {
    id: "card-achievement-first-nation",
    title: "First Nation",
    description: "Commemorates claiming your first country.",
    rarity: "COMMON",
    achievementKey: "gen-first-country",
  },
  {
    id: "card-achievement-veteran",
    title: "Veteran",
    description: "Commemorates one year of activity on IxStats.",
    rarity: "EPIC",
    achievementKey: "gen-one-year",
  },
  {
    id: "card-achievement-completionist",
    title: "Completionist",
    description: "Commemorates unlocking 50 achievements.",
    rarity: "EPIC",
    achievementKey: "gen-achievement-legend",
  },
  {
    id: "card-achievement-influencer",
    title: "Influencer",
    description: "Commemorates reaching 100 followers.",
    rarity: "RARE",
    achievementKey: "social-popular",
  },
  {
    id: "card-achievement-thought-leader",
    title: "Thought Leader",
    description: "Commemorates publishing 50 ThinkPages.",
    rarity: "RARE",
    achievementKey: "social-prolific-author",
  },
];

export interface ExistingSpecialCard {
  specialKind: SpecialCardKind | null;
  rewardAchievementKey: string | null;
  isBound: boolean;
}

export interface SpecialCardImportPlan {
  creates: LegacySpecialCard[];
  updates: {
    id: string;
    data: { specialKind: "ACHIEVEMENT_REWARD"; rewardAchievementKey: string; isBound: true };
  }[];
  /** Legacy cards the import leaves alone, and why. */
  skipped: { id: string; achievementKey: string; reason: string }[];
  /** The legacy cards that reward their achievement once the plan is applied: the ones the backfill awards. */
  rewards: { cardId: string; achievementKey: string }[];
}

/**
 * `existing` holds the legacy cards already in the database, by id; `rewardHolders` names the card that rewards each
 * of their achievements now, by achievement key. A legacy card with no kind is the old seed's row, so the import
 * points it at its achievement; one with a kind was saved in the Designer, and stays as the admin left it.
 */
export function planSpecialCardImport(
  existing: ReadonlyMap<string, ExistingSpecialCard>,
  rewardHolders: ReadonlyMap<string, string> = new Map()
): SpecialCardImportPlan {
  const plan: SpecialCardImportPlan = { creates: [], updates: [], skipped: [], rewards: [] };
  for (const card of LEGACY_SPECIAL_CARDS) {
    const { id, achievementKey } = card;
    const holder = rewardHolders.get(achievementKey);
    const row = existing.get(id);
    if (holder && holder !== id) {
      plan.skipped.push({ id, achievementKey, reason: `card ${holder} already rewards it` });
      continue;
    }
    if (!row) {
      plan.creates.push(card);
    } else if (row.specialKind === null) {
      const data = {
        specialKind: "ACHIEVEMENT_REWARD",
        rewardAchievementKey: achievementKey,
        isBound: true,
      } as const;
      plan.updates.push({ id, data });
    } else if (row.rewardAchievementKey !== achievementKey) {
      plan.skipped.push({ id, achievementKey, reason: "an admin changed it in the Designer" });
      continue;
    }
    plan.rewards.push({ cardId: id, achievementKey });
  }
  return plan;
}
