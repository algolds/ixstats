/**
 * Achievement unlock: records a UserAchievement and pays out its rewards.
 */

import { type Achievement, type PrismaClient } from "@prisma/client";
import { achievementBonus, getBonusConfig, grantBonus } from "~/lib/vault/vault-bonus";
import { awardAchievementCard } from "~/lib/cards/card-service";
import { isUniqueViolation } from "~/lib/prisma-error";
import { RECRUITER_ACHIEVEMENT_IDS } from "./scope";

/**
 * Records an unlock for the user and pays out its credits, its reward card and packs.
 * Returns false when the user already holds the achievement (a concurrent unlock won the race).
 */
export async function unlockAchievement(
  db: PrismaClient,
  userId: string,
  achievement: Achievement
): Promise<boolean> {
  // Recruiting pays nothing: no IxCredits and no reward card
  const paysNothing = RECRUITER_ACHIEVEMENT_IDS.has(achievement.key);
  // Credit reward scales by rarity (consistent curve, admin-tunable in vault-bonus)
  const creditReward = paysNothing
    ? 0
    : achievementBonus(await getBonusConfig(db), achievement.rarity);
  let packIds: string[] = [];
  let titles: string[] = [];

  if (achievement.rewardsJson) {
    try {
      const rewards = JSON.parse(achievement.rewardsJson);
      if (rewards) {
        if (Array.isArray(rewards.cardPacks)) packIds = rewards.cardPacks;
        if (Array.isArray(rewards.titles)) titles = rewards.titles;
      }
    } catch (err) {
      console.error(`[Achievement Service] Failed to parse rewards for ${achievement.key}:`, err);
    }
  }

  // The reward card is the live, approved Special card that names this achievement (the Designer sets it)
  const rewardCard = paysNothing
    ? null
    : await db.card.findUnique({
        where: { rewardAchievementKey: achievement.key },
        select: { id: true, cardType: true, isRetired: true, reviewState: true },
      });
  const cardIds =
    rewardCard?.cardType === "SPECIAL" &&
    !rewardCard.isRetired &&
    rewardCard.reviewState === "APPROVED"
      ? [rewardCard.id]
      : [];

  // Create UserAchievement record (references Achievement.key)
  try {
    await db.userAchievement.create({
      data: {
        userId,
        achievementId: achievement.key,
        title: achievement.title,
        description: achievement.description,
        category: achievement.category,
        rarity: achievement.rarity,
        iconUrl: achievement.iconUrl,
        metadata: JSON.stringify({
          points: achievement.points,
          unlockedAt: new Date().toISOString(),
          titles,
          rewards: { credits: creditReward, cardIds, packIds, titles },
        }),
      },
    });
  } catch (createErr) {
    if (isUniqueViolation(createErr)) return false;
    throw createErr;
  }

  // Award IxCredits (EARN_BONUS — uncapped; one-time per achievement)
  if (creditReward > 0) {
    try {
      await grantBonus(db, userId, `bonus:achievement:${achievement.key}`, creditReward, {
        oneTime: true,
        metadata: {
          achievementId: achievement.key,
          achievementName: achievement.title,
          achievementTier: achievement.rarity,
          achievementCategory: achievement.category,
        },
      });
    } catch (creditError) {
      console.error(
        `[Achievement Service] Error awarding credits for "${achievement.title}":`,
        creditError
      );
    }
  }

  for (const cardId of cardIds) {
    try {
      await awardAchievementCard(db, userId, cardId, achievement.key, achievement.title);
    } catch (cardError) {
      console.error(`[Achievement Service] Error awarding card ${cardId}:`, cardError);
    }
  }

  for (const packId of packIds) {
    try {
      await db.userPack.create({
        data: { userId, packId, isOpened: false, acquiredMethod: "ACHIEVEMENT" },
      });
    } catch (packError) {
      console.error(`[Achievement Service] Error awarding pack ${packId}:`, packError);
    }
  }

  return true;
}
