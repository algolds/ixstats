// scripts/cards/import-special-cards.ts
/**
 * One-off: the CLI achievement card seed becomes this import. Creates the five Special reward cards if missing, points
 * the old seed's rows at their achievement, then awards each live card to every player who already holds its
 * achievement but not the card (the old seed's backfill; a retired card is never awarded).
 *
 *   bun scripts/cards/import-special-cards.ts            # dry run: prints the plan, writes nothing
 *   bun scripts/cards/import-special-cards.ts --apply
 *
 * Idempotent: a second run plans nothing and awards nothing.
 */
import { PrismaClient } from "@prisma/client";
import { awardAchievementCard } from "~/lib/cards/card-service";
import { LEGACY_SPECIAL_CARDS, planSpecialCardImport } from "~/lib/cards/special-card-import";
import { DEFAULT_REALM_ID } from "~/lib/realms/realm-ids";

const db = new PrismaClient();
const APPLY = process.argv.includes("--apply");

async function importCards() {
  const [rows, holders] = await Promise.all([
    db.card.findMany({
      where: { id: { in: LEGACY_SPECIAL_CARDS.map((card) => card.id) } },
      select: {
        id: true,
        specialKind: true,
        rewardAchievementKey: true,
        isBound: true,
        isRetired: true,
      },
    }),
    db.card.findMany({
      where: {
        rewardAchievementKey: { in: LEGACY_SPECIAL_CARDS.map((card) => card.achievementKey) },
      },
      select: { id: true, rewardAchievementKey: true },
    }),
  ]);
  const plan = planSpecialCardImport(
    new Map(rows.map((row) => [row.id, row])),
    new Map(
      holders.flatMap((row) =>
        row.rewardAchievementKey ? [[row.rewardAchievementKey, row.id] as const] : []
      )
    )
  );
  console.log(
    `${plan.creates.length} Special cards to create, ${plan.updates.length} to point at their achievement.`
  );
  for (const skip of plan.skipped) {
    console.log(`Left alone: ${skip.id} (${skip.achievementKey}), ${skip.reason}.`);
  }
  if (APPLY) {
    for (const card of plan.creates) {
      await db.card.create({
        data: {
          id: card.id,
          title: card.title,
          description: card.description,
          rarity: card.rarity,
          cardType: "SPECIAL",
          category: "SPECIAL",
          realmId: DEFAULT_REALM_ID,
          isBound: true,
          specialKind: "ACHIEVEMENT_REWARD",
          rewardAchievementKey: card.achievementKey,
          reviewState: "APPROVED",
        },
      });
    }
    for (const update of plan.updates) {
      await db.card.update({ where: { id: update.id }, data: update.data });
    }
  }
  return plan.rewards;
}

async function backfillUnlocks(rewards: Awaited<ReturnType<typeof importCards>>) {
  let awarded = 0;
  for (const { cardId, achievementKey } of rewards) {
    const unlocks = await db.userAchievement.findMany({
      where: { achievementId: achievementKey },
      select: { userId: true, title: true },
    });
    for (const unlock of unlocks) {
      // UserAchievement.userId is the Clerk id; copies use the database id
      const user = await db.user.findFirst({
        where: { OR: [{ id: unlock.userId }, { clerkUserId: unlock.userId }] },
        select: { id: true },
      });
      if (!user) continue;
      const owned = await db.cardOwnership.findFirst({
        where: { ownerId: user.id, cardId },
        select: { id: true },
      });
      if (owned) continue;
      awarded++;
      if (APPLY) await awardAchievementCard(db, user.id, cardId, achievementKey, unlock.title);
    }
  }
  console.log(`${awarded} earlier unlocks ${APPLY ? "awarded" : "to award"}.`);
}

async function main() {
  await backfillUnlocks(await importCards());
  if (!APPLY) console.log("Dry run: nothing written. Re-run with --apply.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => void db.$disconnect());
