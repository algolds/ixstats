import { type PrismaClient } from "@prisma/client";
import { ACHIEVEMENT_DEFINITIONS, type AchievementRarity } from "./definitions";
import { getCardRewardForAchievement } from "./card-rewards";
import { SCALE_METRIC_BY_ID, RARITY_PERCENTILE } from "./scaling";

export async function syncAchievements(db: PrismaClient): Promise<void> {
  console.log("[Achievement Sync] Starting baseline synchronization...");
  let syncedCount = 0;

  for (const def of ACHIEVEMENT_DEFINITIONS) {
    const cardId = getCardRewardForAchievement(def.id);
    const credits = getCreditsForRarity(def.rarity);

    // Rewards JSON structure
    // eslint-disable-next-line prefer-const
    let rewards: any = {
      credits,
      cardIds: cardId ? [cardId] : [],
    };

    if (def.id.startsWith("vid-")) {
      rewards.cardPacks = ["vidmaster-lore-pack"];
      rewards.titles = ["Vidmaster"];
    } else if (def.id === "collect-lore-keeper") {
      rewards.titles = ["Lore Keeper"];
    } else if (def.id === "collect-archaeologist") {
      rewards.titles = ["Archaeologist"];
    } else if (def.id === "collect-diplomat") {
      rewards.titles = ["Diplomat"];
    }

    // Build trigger condition JSON based on standard baseline definition keys
    const condition = determineCondition(def.id, def.rarity);

    try {
      await db.achievement.upsert({
        where: { key: def.id },
        update: {
          title: def.title,
          description: def.description,
          category: def.category,
          rarity: def.rarity,
          points: def.points,
          iconUrl: def.iconUrl,
          triggerType: condition.triggerType,
          conditionJson: JSON.stringify(condition.rules),
          rewardsJson: JSON.stringify(rewards),
          isActive: true,
        },
        create: {
          key: def.id,
          title: def.title,
          description: def.description,
          category: def.category,
          rarity: def.rarity,
          points: def.points,
          iconUrl: def.iconUrl,
          triggerType: condition.triggerType,
          conditionJson: JSON.stringify(condition.rules),
          rewardsJson: JSON.stringify(rewards),
          isActive: true,
        },
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

function getCreditsForRarity(rarity: string): number {
  const rarityRewards: Record<string, number> = {
    Common: 5,
    Uncommon: 10,
    Rare: 25,
    Epic: 50,
    Legendary: 100,
  };
  return rarityRewards[rarity] || 5;
}

interface ConditionConfig {
  triggerType: string;
  rules: any;
}

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

  if (id.startsWith("econ-")) {
    if (id === "econ-growth-rocket") {
      return {
        triggerType: "ECONOMIC",
        rules: { metric: "adjustedGdpGrowth", operator: ">=", value: 10.0 },
      };
    }
    if (id === "econ-boom-cycle") {
      return {
        triggerType: "ECONOMIC",
        rules: { metric: "adjustedGdpGrowth", operator: ">=", value: 15.0 },
      };
    }
    if (id === "econ-full-employment") {
      return {
        triggerType: "ECONOMIC",
        rules: { metric: "unemploymentRate", operator: "<", value: 3.0 },
      };
    }
    if (id === "econ-price-stability") {
      return {
        triggerType: "ECONOMIC",
        rules: { metric: "inflationRate", operator: "<", value: 2.0 },
      };
    }
    if (id === "econ-tax-efficiency") {
      return {
        triggerType: "ECONOMIC",
        rules: { metric: "taxRevenueGDPPercent", operator: ">=", value: 30.0 },
      };
    }
    if (id === "econ-tier-advancement") {
      return {
        triggerType: "ECONOMIC",
        rules: { metric: "economicTier", operator: "==", value: "Tier 1" },
      };
    }
  }

  if (id.startsWith("mil-")) {
    if (id === "mil-first-branch") {
      return {
        triggerType: "MILITARY",
        rules: { metric: "militaryBranchCount", operator: ">=", value: 1 },
      };
    }
    if (id === "mil-armed-forces") {
      return {
        triggerType: "MILITARY",
        rules: { metric: "militaryBranchCount", operator: ">=", value: 3 },
      };
    }
    if (id === "mil-full-spectrum") {
      return {
        triggerType: "MILITARY",
        rules: { metric: "militaryBranchCount", operator: ">=", value: 5 },
      };
    }
    if (id === "mil-defense-commitment") {
      return {
        triggerType: "MILITARY",
        rules: { metric: "militarySpendingPercent", operator: ">=", value: 1.0 },
      };
    }
    if (id === "mil-strong-defense") {
      return {
        triggerType: "MILITARY",
        rules: { metric: "militarySpendingPercent", operator: ">=", value: 3.0 },
      };
    }
    if (id === "mil-military-superpower") {
      return {
        triggerType: "MILITARY",
        rules: { metric: "militarySpendingPercent", operator: ">=", value: 5.0 },
      };
    }
    if (id === "mil-standing-army") {
      return {
        triggerType: "MILITARY",
        rules: { metric: "totalMilitaryPersonnel", operator: ">=", value: 10_000 },
      };
    }
    if (id === "mil-large-force") {
      return {
        triggerType: "MILITARY",
        rules: { metric: "totalMilitaryPersonnel", operator: ">=", value: 100_000 },
      };
    }
    if (id === "mil-massive-force") {
      return {
        triggerType: "MILITARY",
        rules: { metric: "totalMilitaryPersonnel", operator: ">=", value: 1_000_000 },
      };
    }
    if (id === "mil-global-force") {
      return {
        triggerType: "MILITARY",
        rules: { metric: "totalMilitaryPersonnel", operator: ">=", value: 5_000_000 },
      };
    }
  }

  if (id.startsWith("dip-")) {
    if (id === "dip-first-embassy") {
      return {
        triggerType: "DIPLOMATIC",
        rules: { metric: "embassyCount", operator: ">=", value: 1 },
      };
    }
    if (id === "dip-diplomatic-network") {
      return {
        triggerType: "DIPLOMATIC",
        rules: { metric: "embassyCount", operator: ">=", value: 5 },
      };
    }
    if (id === "dip-global-presence") {
      return {
        triggerType: "DIPLOMATIC",
        rules: { metric: "embassyCount", operator: ">=", value: 10 },
      };
    }
    if (id === "dip-embassy-network") {
      return {
        triggerType: "DIPLOMATIC",
        rules: { metric: "embassyCount", operator: ">=", value: 25 },
      };
    }
    if (id === "dip-first-treaty") {
      return {
        triggerType: "DIPLOMATIC",
        rules: { metric: "treatyCount", operator: ">=", value: 1 },
      };
    }
    if (id === "dip-treaty-network") {
      return {
        triggerType: "DIPLOMATIC",
        rules: { metric: "treatyCount", operator: ">=", value: 10 },
      };
    }
    if (id === "dip-trade-partners") {
      return {
        triggerType: "DIPLOMATIC",
        rules: { metric: "tradePartnerCount", operator: ">=", value: 25 },
      };
    }
    if (id === "dip-trade-hub") {
      return {
        triggerType: "DIPLOMATIC",
        rules: { metric: "tradePartnerCount", operator: ">=", value: 50 },
      };
    }
    if (id === "dip-alliance-maker") {
      return {
        triggerType: "DIPLOMATIC",
        rules: { metric: "allianceCount", operator: ">=", value: 5 },
      };
    }
    if (id === "dip-alliance-network") {
      return {
        triggerType: "DIPLOMATIC",
        rules: { metric: "allianceCount", operator: ">=", value: 10 },
      };
    }
  }

  if (id.startsWith("gov-")) {
    if (id === "gov-first-component") {
      return {
        triggerType: "GOVERNMENT",
        rules: { metric: "atomicComponentCount", operator: ">=", value: 1 },
      };
    }
    if (id === "gov-building-blocks") {
      return {
        triggerType: "GOVERNMENT",
        rules: { metric: "atomicComponentCount", operator: ">=", value: 5 },
      };
    }
    if (id === "gov-sophisticated") {
      return {
        triggerType: "GOVERNMENT",
        rules: { metric: "atomicComponentCount", operator: ">=", value: 10 },
      };
    }
    if (id === "gov-complex-system") {
      return {
        triggerType: "GOVERNMENT",
        rules: { metric: "atomicComponentCount", operator: ">=", value: 15 },
      };
    }
    if (id === "gov-democracy") {
      return {
        triggerType: "GOVERNMENT",
        rules: { metric: "governmentType", operator: "contains", value: "democracy" },
      };
    }
    if (id === "gov-republic") {
      return {
        triggerType: "GOVERNMENT",
        rules: { metric: "governmentType", operator: "contains", value: "republic" },
      };
    }
    if (id === "gov-monarchy") {
      return {
        triggerType: "GOVERNMENT",
        rules: { metric: "governmentType", operator: "contains", value: "monarchy" },
      };
    }
    if (id === "gov-federation") {
      return {
        triggerType: "GOVERNMENT",
        rules: { metric: "governmentType", operator: "contains", value: "federal" },
      };
    }
    if (id === "gov-unitary") {
      return {
        triggerType: "GOVERNMENT",
        rules: { metric: "governmentType", operator: "contains", value: "unitary" },
      };
    }
    if (id === "gov-parliamentary") {
      return {
        triggerType: "GOVERNMENT",
        rules: { metric: "governmentType", operator: "contains", value: "parliament" },
      };
    }
  }

  if (id.startsWith("social-")) {
    if (id === "social-first-thinkpage") {
      return {
        triggerType: "SOCIAL",
        rules: { metric: "thinkpageCount", operator: ">=", value: 1 },
      };
    }
    if (id === "social-thinkpage-author") {
      return {
        triggerType: "SOCIAL",
        rules: { metric: "thinkpageCount", operator: ">=", value: 10 },
      };
    }
    if (id === "social-prolific-author") {
      return {
        triggerType: "SOCIAL",
        rules: { metric: "thinkpageCount", operator: ">=", value: 50 },
      };
    }
    if (id === "social-popular") {
      return {
        triggerType: "SOCIAL",
        rules: { metric: "followerCount", operator: ">=", value: 100 },
      };
    }
    if (id === "social-trending") {
      return {
        triggerType: "SOCIAL",
        rules: { metric: "trendingPostCount", operator: ">=", value: 1 },
      };
    }
  }

  if (id.startsWith("gen-")) {
    if (id === "gen-welcome") {
      return {
        triggerType: "GENERAL",
        rules: { metric: "always_true", operator: "==", value: true },
      };
    }
    if (id === "gen-first-country") {
      return {
        triggerType: "GENERAL",
        rules: { metric: "countryClaimed", operator: "==", value: true },
      };
    }
    if (id === "gen-one-week") {
      return { triggerType: "GENERAL", rules: { metric: "daysActive", operator: ">=", value: 7 } };
    }
    if (id === "gen-one-month") {
      return { triggerType: "GENERAL", rules: { metric: "daysActive", operator: ">=", value: 30 } };
    }
    if (id === "gen-three-months") {
      return { triggerType: "GENERAL", rules: { metric: "daysActive", operator: ">=", value: 90 } };
    }
    if (id === "gen-one-year") {
      return {
        triggerType: "GENERAL",
        rules: { metric: "daysActive", operator: ">=", value: 365 },
      };
    }
    if (id === "gen-achievement-hunter") {
      return {
        triggerType: "GENERAL",
        rules: { metric: "totalAchievements", operator: ">=", value: 10 },
      };
    }
    if (id === "gen-achievement-master") {
      return {
        triggerType: "GENERAL",
        rules: { metric: "totalAchievements", operator: ">=", value: 25 },
      };
    }
    if (id === "gen-achievement-legend") {
      return {
        triggerType: "GENERAL",
        rules: { metric: "totalAchievements", operator: ">=", value: 50 },
      };
    }
    if (id.startsWith("vid-")) {
      if (id === "vid-end-of-days") {
        return {
          triggerType: "GENERAL",
          rules: { metric: "totalAchievements", operator: ">=", value: 30 },
        };
      }
      if (id === "vid-annual") {
        return {
          triggerType: "GENERAL",
          rules: { metric: "daysActive", operator: ">=", value: 365 },
        };
      }
      if (id === "vid-lightswitch") {
        return {
          triggerType: "DIPLOMATIC",
          rules: { metric: "embassyCount", operator: ">=", value: 25 },
        };
      }
    }
    if (id.startsWith("meme-")) {
      if (id === "meme-stonks") {
        return {
          triggerType: "ECONOMIC",
          rules: { metric: "adjustedGdpGrowth", operator: "<", value: 0 },
        };
      }
      if (id === "meme-1337") {
        return {
          triggerType: "GENERAL",
          rules: { metric: "currentGdpPerCapita", operator: "==", value: 1337 },
        };
      }
      if (id === "meme-bankruptcy") {
        return {
          triggerType: "ECONOMIC",
          rules: { metric: "currentGdpPerCapita", operator: "<=", value: 1.0 },
        };
      }
      if (id === "meme-ns-ref") {
        return {
          triggerType: "GENERAL",
          rules: { metric: "totalAchievements", operator: ">=", value: 40 },
        };
      }
    }
    if (id.startsWith("lore-")) {
      if (id === "lore-scholar") {
        return {
          triggerType: "SOCIAL",
          rules: { metric: "thinkpageCount", operator: ">=", value: 5 },
        };
      }
      if (id === "lore-collector") {
        return {
          triggerType: "SOCIAL",
          rules: { metric: "followerCount", operator: ">=", value: 30 },
        };
      }
    }
    if (id.startsWith("collect-")) {
      if (id === "collect-lore-keeper") {
        return {
          triggerType: "GENERAL",
          rules: { metric: "loreCardCount", operator: ">=", value: 50 },
        };
      }
      if (id === "collect-archaeologist") {
        return {
          triggerType: "GENERAL",
          rules: { metric: "retiredCardCount", operator: ">=", value: 10 },
        };
      }
      if (id === "collect-diplomat") {
        return {
          triggerType: "DIPLOMATIC",
          rules: { metric: "distinctCountryIdCount", operator: ">=", value: 20 },
        };
      }
    }
  }

  return { triggerType: "CUSTOM", rules: {} };
}
