import { type PrismaClient } from "@prisma/client";
import { ACHIEVEMENT_DEFINITIONS, type AchievementRarity } from "./definitions";
import { getCardRewardForAchievement } from "./card-rewards";
import { SCALE_METRIC_BY_ID, RARITY_PERCENTILE } from "./scaling";

const CREDITS_BY_RARITY: Record<string, number> = {
  Common: 5,
  Uncommon: 10,
  Rare: 25,
  Epic: 50,
  Legendary: 100,
};

const TITLE_BY_ID: Record<string, string> = {
  "collect-lore-keeper": "Lore Keeper",
  "collect-archaeologist": "Archaeologist",
  "collect-diplomat": "Diplomat",
};

function buildRewards(id: string, rarity: string) {
  const cardId = getCardRewardForAchievement(id);
  const rewards: { credits: number; cardIds: string[]; cardPacks?: string[]; titles?: string[] } = {
    credits: CREDITS_BY_RARITY[rarity] || 5,
    cardIds: cardId ? [cardId] : [],
  };
  if (id.startsWith("vid-")) {
    rewards.cardPacks = ["vidmaster-lore-pack"];
    rewards.titles = ["Vidmaster"];
  } else if (TITLE_BY_ID[id]) {
    rewards.titles = [TITLE_BY_ID[id]];
  }
  return rewards;
}

export async function syncAchievements(db: PrismaClient): Promise<void> {
  if (!db?.achievement?.upsert) return;

  console.log("[Achievement Sync] Starting baseline synchronization...");
  let syncedCount = 0;

  for (const def of ACHIEVEMENT_DEFINITIONS) {
    const condition = determineCondition(def.id, def.rarity);
    const data = {
      title: def.title,
      description: def.description,
      category: def.category,
      rarity: def.rarity,
      points: def.points,
      iconUrl: def.iconUrl,
      triggerType: condition.triggerType,
      conditionJson: JSON.stringify(condition.rules),
      rewardsJson: JSON.stringify(buildRewards(def.id, def.rarity)),
      isActive: true,
    };

    try {
      await db.achievement.upsert({
        where: { key: def.id },
        update: data,
        create: { key: def.id, ...data },
      });
      syncedCount++;
    } catch (error) {
      console.error(`[Achievement Sync] Failed to sync ${def.id}:`, error);
    }
  }

  console.log(
    `[Achievement Sync] Completed syncing ${syncedCount}/${ACHIEVEMENT_DEFINITIONS.length} achievements.`
  );
}

interface ConditionConfig {
  triggerType: string;
  rules: any;
}

type FixedCondition = [
  triggerType: string,
  metric: string,
  operator: string,
  value: number | string | boolean,
];

/** Baseline trigger per achievement id: [trigger type, metric, operator, threshold]. */
const FIXED_CONDITIONS: Record<string, FixedCondition> = {
  "econ-growth-rocket": ["ECONOMIC", "adjustedGdpGrowth", ">=", 10],
  "econ-boom-cycle": ["ECONOMIC", "adjustedGdpGrowth", ">=", 15],
  "econ-full-employment": ["ECONOMIC", "unemploymentRate", "<", 3],
  "econ-price-stability": ["ECONOMIC", "inflationRate", "<", 2],
  "econ-tax-efficiency": ["ECONOMIC", "taxRevenueGDPPercent", ">=", 30],
  "econ-tier-advancement": ["ECONOMIC", "economicTier", "==", "Tier 1"],
  "mil-first-branch": ["MILITARY", "militaryBranchCount", ">=", 1],
  "mil-armed-forces": ["MILITARY", "militaryBranchCount", ">=", 3],
  "mil-full-spectrum": ["MILITARY", "militaryBranchCount", ">=", 5],
  "mil-defense-commitment": ["MILITARY", "militarySpendingPercent", ">=", 1],
  "mil-strong-defense": ["MILITARY", "militarySpendingPercent", ">=", 3],
  "mil-military-superpower": ["MILITARY", "militarySpendingPercent", ">=", 5],
  "mil-standing-army": ["MILITARY", "totalMilitaryPersonnel", ">=", 10000],
  "mil-large-force": ["MILITARY", "totalMilitaryPersonnel", ">=", 100000],
  "mil-massive-force": ["MILITARY", "totalMilitaryPersonnel", ">=", 1000000],
  "mil-global-force": ["MILITARY", "totalMilitaryPersonnel", ">=", 5000000],
  "dip-first-embassy": ["DIPLOMATIC", "embassyCount", ">=", 1],
  "dip-diplomatic-network": ["DIPLOMATIC", "embassyCount", ">=", 5],
  "dip-global-presence": ["DIPLOMATIC", "embassyCount", ">=", 10],
  "dip-embassy-network": ["DIPLOMATIC", "embassyCount", ">=", 25],
  "dip-first-treaty": ["DIPLOMATIC", "treatyCount", ">=", 1],
  "dip-treaty-network": ["DIPLOMATIC", "treatyCount", ">=", 10],
  "dip-trade-partners": ["DIPLOMATIC", "tradePartnerCount", ">=", 25],
  "dip-trade-hub": ["DIPLOMATIC", "tradePartnerCount", ">=", 50],
  "dip-alliance-maker": ["DIPLOMATIC", "allianceCount", ">=", 5],
  "dip-alliance-network": ["DIPLOMATIC", "allianceCount", ">=", 10],
  "gov-first-component": ["GOVERNMENT", "atomicComponentCount", ">=", 1],
  "gov-building-blocks": ["GOVERNMENT", "atomicComponentCount", ">=", 5],
  "gov-sophisticated": ["GOVERNMENT", "atomicComponentCount", ">=", 10],
  "gov-complex-system": ["GOVERNMENT", "atomicComponentCount", ">=", 15],
  "gov-democracy": ["GOVERNMENT", "governmentType", "contains", "democracy"],
  "gov-republic": ["GOVERNMENT", "governmentType", "contains", "republic"],
  "gov-monarchy": ["GOVERNMENT", "governmentType", "contains", "monarchy"],
  "gov-federation": ["GOVERNMENT", "governmentType", "contains", "federal"],
  "gov-unitary": ["GOVERNMENT", "governmentType", "contains", "unitary"],
  "gov-parliamentary": ["GOVERNMENT", "governmentType", "contains", "parliament"],
  "social-first-thinkpage": ["SOCIAL", "thinkpageCount", ">=", 1],
  "social-thinkpage-author": ["SOCIAL", "thinkpageCount", ">=", 10],
  "social-prolific-author": ["SOCIAL", "thinkpageCount", ">=", 50],
  "social-popular": ["SOCIAL", "followerCount", ">=", 100],
  "social-trending": ["SOCIAL", "trendingPostCount", ">=", 1],
  "gen-welcome": ["GENERAL", "always_true", "==", true],
  "gen-first-country": ["GENERAL", "countryClaimed", "==", true],
  "gen-one-week": ["GENERAL", "daysActive", ">=", 7],
  "gen-one-month": ["GENERAL", "daysActive", ">=", 30],
  "gen-three-months": ["GENERAL", "daysActive", ">=", 90],
  "gen-one-year": ["GENERAL", "daysActive", ">=", 365],
  "gen-achievement-hunter": ["GENERAL", "totalAchievements", ">=", 10],
  "gen-achievement-master": ["GENERAL", "totalAchievements", ">=", 25],
  "gen-achievement-legend": ["GENERAL", "totalAchievements", ">=", 50],
};

function determineCondition(id: string, rarity?: AchievementRarity): ConditionConfig {
  // Scale-based achievements (population / GDP / GDP-per-capita) are dynamic:
  // the threshold is a percentile of the live country distribution, picked by
  // rarity. No hardcoded absolute values — see achievement-scaling.ts.
  const scaleMetric = SCALE_METRIC_BY_ID[id];
  if (scaleMetric && rarity) {
    return {
      triggerType: scaleMetric === "currentPopulation" ? "GENERAL" : "ECONOMIC",
      rules: { metric: scaleMetric, operator: ">=", percentile: RARITY_PERCENTILE[rarity] },
    };
  }

  const fixed = FIXED_CONDITIONS[id];
  if (!fixed) return { triggerType: "CUSTOM", rules: {} };
  const [triggerType, metric, operator, value] = fixed;
  return { triggerType, rules: { metric, operator, value } };
}
