import { type PrismaClient } from "@prisma/client";
import { ruleToJson, type AchievementDefinition } from "./definitions";
import { getCardRewardForAchievement } from "./card-rewards";
import { RECRUITER_ACHIEVEMENT_IDS } from "./scope";
import { ALL_DEFINITIONS } from "./sets";

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

/** The Vidmaster achievements' pack: the seeded Lore Master pack (prisma/seeds/data/card-packs.json). */
export const VIDMASTER_REWARD_PACK_ID = "pack_lore_master";

function buildRewards(id: string, rarity: string) {
  if (RECRUITER_ACHIEVEMENT_IDS.has(id)) return { credits: 0, cardIds: [] };
  const cardId = getCardRewardForAchievement(id);
  const rewards: { credits: number; cardIds: string[]; cardPacks?: string[]; titles?: string[] } = {
    credits: CREDITS_BY_RARITY[rarity] || 5,
    cardIds: cardId ? [cardId] : [],
  };
  if (id.startsWith("vid-")) {
    rewards.cardPacks = [VIDMASTER_REWARD_PACK_ID];
    rewards.titles = ["Vidmaster"];
  } else if (TITLE_BY_ID[id]) {
    rewards.titles = [TITLE_BY_ID[id]];
  }
  return rewards;
}

/** Retired (Legacy) definitions, which are marked inactive once and then left alone. */
export const RETIRED_IDS: ReadonlySet<string> = new Set(
  ALL_DEFINITIONS.filter((def) => def.retired).map((def) => def.id)
);

export async function syncAchievements(db: PrismaClient): Promise<void> {
  if (!db?.achievement?.upsert) return;

  console.log("[Achievement Sync] Starting baseline synchronization...");
  // Retired rows already marked inactive are unchanged: skip them so a sync stays cheap
  const retiredDone = new Set(
    (
      await db.achievement.findMany({
        where: { key: { in: [...RETIRED_IDS] }, isActive: false },
        select: { key: true },
      })
    ).map((row) => row.key)
  );
  let syncedCount = 0;

  for (const def of ALL_DEFINITIONS) {
    if (retiredDone.has(def.id)) continue;
    const condition = determineCondition(def);
    const data = {
      title: def.title,
      description: def.description,
      category: def.category,
      rarity: def.rarity,
      points: def.points,
      iconUrl: def.icon,
      triggerType: condition.triggerType,
      conditionJson: JSON.stringify(condition.rules),
      rewardsJson: JSON.stringify(buildRewards(def.id, def.rarity)),
      isActive: !def.retired,
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
    `[Achievement Sync] Synced ${syncedCount} of ${ALL_DEFINITIONS.length} achievements (${retiredDone.size} Legacy already retired).`
  );
}

interface ConditionConfig {
  triggerType: string;
  rules: Partial<ReturnType<typeof ruleToJson>>;
}

/** The trigger and stored rule of a definition; one without a `rule` syncs as CUSTOM and unlocks through its `condition`. */
function determineCondition(def: AchievementDefinition): ConditionConfig {
  if (!def.rule) return { triggerType: "CUSTOM", rules: {} };
  return { triggerType: def.rule[0], rules: ruleToJson(def.rule) };
}
