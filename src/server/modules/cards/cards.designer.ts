/**
 * The Designer: Special card definitions in the database. An event card is tradeable unless the admin binds it; an
 * achievement reward card is always bound and names the achievement that awards it (one card per achievement,
 * `rewardAchievementKey @unique`). The face has no bespoke styling, so a definition is plain card fields and a realm.
 */
import { SpecialCardKind, type PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { RECRUITER_ACHIEVEMENT_IDS } from "~/lib/achievements/scope";
import { ALL_DEFINITIONS } from "~/lib/achievements/sets";
import { CardRarity } from "~/lib/cards/enums";
import { getCurrentIxCardSeason } from "~/lib/cards/season";
import { isMissingRecord, isUniqueViolation } from "~/lib/prisma-error";
import { recordCardAudit, type CardAdminActor } from "./cards.audit";

export const SpecialCardSchema = z
  .object({
    id: z.string().min(1).optional(),
    title: z.string().trim().min(2).max(120),
    description: z.string().trim().max(1000).default(""),
    rarity: z.enum(CardRarity),
    kind: z.enum(SpecialCardKind),
    realmId: z.string().min(1).max(64),
    artwork: z
      .url({ protocol: /^https$/ })
      .max(2000)
      .nullable()
      .default(null),
    isBound: z.boolean(),
    rewardAchievementKey: z.string().min(1).nullable().default(null),
  })
  .refine(
    (card) =>
      card.kind === "EVENT"
        ? card.rewardAchievementKey === null
        : card.rewardAchievementKey !== null && card.isBound,
    {
      message:
        "An achievement reward names its achievement and is always bound; an event card names none",
      path: ["rewardAchievementKey"],
    }
  );
export type SpecialCardInput = z.infer<typeof SpecialCardSchema>;

/** The achievements a reward card can name: every live one, except the recruiter ladder, which pays nothing. */
export function rewardAchievementOptions(): { id: string; title: string }[] {
  return ALL_DEFINITIONS.filter(
    (definition) => !definition.retired && !RECRUITER_ACHIEVEMENT_IDS.has(definition.id)
  ).map((definition) => ({ id: definition.id, title: definition.title }));
}

export function listSpecialCards(db: PrismaClient) {
  return db.card.findMany({
    where: { cardType: "SPECIAL" },
    orderBy: { title: "asc" },
    take: 500,
    select: {
      id: true,
      title: true,
      description: true,
      rarity: true,
      realmId: true,
      artwork: true,
      isBound: true,
      isRetired: true,
      specialKind: true,
      rewardAchievementKey: true,
      _count: { select: { CardOwnership: true } },
    },
  });
}

const cardGone = () =>
  new TRPCError({
    code: "NOT_FOUND",
    message: "That Special card, or its realm, no longer exists",
  });

/** Creates a Special card, approved because an admin made it, or edits one in place (its season and type stay). */
export async function saveSpecialCard(
  db: PrismaClient,
  actor: CardAdminActor,
  input: SpecialCardInput
): Promise<{ id: string }> {
  const key = input.rewardAchievementKey;
  if (key && !rewardAchievementOptions().some((option) => option.id === key)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "No such achievement" });
  }
  const data = {
    title: input.title,
    description: input.description || null,
    rarity: input.rarity,
    realmId: input.realmId,
    artwork: input.artwork,
    artworkSource: input.artwork ? ("UPLOADED" as const) : ("PROCEDURAL" as const),
    isBound: input.isBound,
    specialKind: input.kind,
    rewardAchievementKey: key,
  };
  try {
    return await db.$transaction(async (tx) => {
      const existing = input.id
        ? await tx.card.findUnique({
            where: { id: input.id },
            select: { id: true, cardType: true },
          })
        : null;
      if (input.id && existing?.cardType !== "SPECIAL") throw cardGone();
      const card = existing
        ? await tx.card.update({ where: { id: existing.id }, data, select: { id: true } })
        : await tx.card.create({
            data: {
              ...data,
              cardType: "SPECIAL",
              category: "SPECIAL",
              season: await getCurrentIxCardSeason(tx),
              reviewState: "APPROVED",
            },
            select: { id: true },
          });
      await recordCardAudit(tx, {
        action: "CARD_SPECIAL_SAVE",
        actor: actor.clerkId,
        target: card.id,
        details: `${existing ? "Edited" : "Created"} the Special card "${input.title}"`,
      });
      return card;
    });
  } catch (error) {
    if (isUniqueViolation(error, "rewardAchievementKey")) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "Another card is already this achievement's reward",
      });
    }
    if (isMissingRecord(error)) throw cardGone();
    throw error;
  }
}
