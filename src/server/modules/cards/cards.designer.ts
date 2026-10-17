/**
 * The Designer: Special card definitions in the database. An event card is tradeable unless the admin binds it; an
 * achievement reward card is always bound and names the achievement that awards it (one card per achievement,
 * `rewardAchievementKey @unique`). The face has no bespoke styling, so a definition is plain card fields and a realm.
 */
import { SpecialCardKind, type Prisma, type PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { RECRUITER_ACHIEVEMENT_IDS } from "~/lib/achievements/scope";
import { ALL_DEFINITIONS } from "~/lib/achievements/sets";
import { lacksRarityReason } from "~/lib/cards/curation-limits";
import { CardRarity } from "~/lib/cards/enums";
import { getCurrentIxCardSeason } from "~/lib/cards/season";
import { lockCardSerialsTx } from "~/lib/cards/serial-number";
import { awaitsSpecialCardImport } from "~/lib/cards/special-card-import";
import { computeCardValue, readValuationConfig } from "~/lib/cards/valuation";
import { isMissingRecord, isUniqueViolation } from "~/lib/prisma-error";
import type { CardAdminActor } from "~/server/shared/admin-actor";
import { recordCardAudit } from "./cards.audit";
import {
  HIDDEN_TAKEDOWNS,
  artLicenceFollowsTx,
  assertArtNotHeld,
  lockCardTakedownsTx,
} from "./cards.compliance";

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
    /** Why an edit changes the card's rarity; needed only then, and audited with the override. */
    reason: z.string().trim().max(500).optional(),
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

const refused = (message: string) => new TRPCError({ code: "PRECONDITION_FAILED", message });

/**
 * The card an edit saves over, read under the card's serial lock (mints take it too, so its copy count holds) and
 * then its takedown lock (a hide takes it too, so its art hold holds).
 */
async function editedCard(tx: Prisma.TransactionClient, id: string) {
  await lockCardSerialsTx(tx, id);
  await lockCardTakedownsTx(tx, id);
  const card = await tx.card.findUnique({
    where: { id },
    select: {
      id: true,
      cardType: true,
      rarity: true,
      specialKind: true,
      isBound: true,
      rewardAchievementKey: true,
      artwork: true,
      wikiSource: true,
      artLicence: { select: { status: true } },
      _count: { select: { CardOwnership: true, takedowns: HIDDEN_TAKEDOWNS } },
    },
  });
  if (!card || card.cardType !== "SPECIAL") throw cardGone();
  return card;
}

type EditedSpecialCard = Awaited<ReturnType<typeof editedCard>>;

/**
 * An old seed row waits for the import, which alone gives it a kind. Once players hold copies, the kind, binding and
 * achievement stay: binding lives on the card, so unbinding one would free every copy at once. A rarity change says
 * why, as in the Library. Art a takedown or a restricted licence hides is changed only from Compliance.
 */
function assertEditable(card: EditedSpecialCard, input: SpecialCardInput) {
  if (awaitsSpecialCardImport(card)) {
    throw refused("Run the Special card import before editing this card.");
  }
  // A held Special card with no kind (an old SPECIAL type) opens as an event card; saving it as one is no change.
  const changesKind =
    (card.specialKind ?? "EVENT") !== input.kind ||
    card.isBound !== input.isBound ||
    card.rewardAchievementKey !== input.rewardAchievementKey;
  if (changesKind && card._count.CardOwnership > 0) {
    throw refused("Players hold copies of this card, so its kind and binding are fixed.");
  }
  if (input.rarity !== card.rarity && lacksRarityReason(input.reason)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Say why the rarity changes." });
  }
  if (input.artwork !== card.artwork) assertArtNotHeld(card);
}

/** A newly chosen achievement must be live; a card keeps the one it has after that achievement retires. */
function assertRewardAchievement(key: string | null, storedKey: string | null) {
  if (key && key !== storedKey && !rewardAchievementOptions().some((option) => option.id === key)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "No such achievement" });
  }
}

/**
 * A Special card's value at a rarity, as the revalue sets it (its floor times the Special multiplier), under the
 * config as this transaction reads it.
 */
async function specialCardValueTx(tx: Prisma.TransactionClient, rarity: CardRarity) {
  return computeCardValue({ rarity, cardType: "SPECIAL" }, await readValuationConfig(tx));
}

/**
 * An edit's write. New art takes its licence row and credit with it, and a new rarity its value, as in the Library.
 */
async function updateSpecialCardTx(
  tx: Prisma.TransactionClient,
  card: EditedSpecialCard,
  data: Prisma.CardUncheckedUpdateInput,
  input: Pick<SpecialCardInput, "artwork" | "rarity">
) {
  const artChanged = input.artwork !== card.artwork;
  const revalued =
    input.rarity !== card.rarity ? { marketValue: await specialCardValueTx(tx, input.rarity) } : {};
  const updated = await tx.card.update({
    where: { id: card.id },
    data: { ...data, ...revalued, ...(artChanged ? { artworkCredit: null } : {}) },
    select: { id: true },
  });
  if (artChanged) await artLicenceFollowsTx(tx, card, input.artwork, "Designer");
  return updated;
}

/** The save's audit rows: the save, and a rarity change as the override it is, with its reason (as in the Library). */
async function auditSaveTx(
  tx: Prisma.TransactionClient,
  actor: CardAdminActor,
  cardId: string,
  existing: EditedSpecialCard | null,
  input: SpecialCardInput
) {
  await recordCardAudit(tx, {
    action: "CARD_SPECIAL_SAVE",
    actor: actor.clerkId,
    target: cardId,
    details: `${existing ? "Edited" : "Created"} the Special card "${input.title}"`,
  });
  if (!existing || existing.rarity === input.rarity) return;
  await recordCardAudit(tx, {
    action: "CARD_RARITY_OVERRIDE",
    actor: actor.clerkId,
    target: cardId,
    details: `Rarity ${existing.rarity} → ${input.rarity}: ${input.reason}`,
  });
}

/** Creates a Special card, approved because an admin made it, or edits one in place (its season and type stay). */
export async function saveSpecialCard(
  db: PrismaClient,
  actor: CardAdminActor,
  input: SpecialCardInput
): Promise<{ id: string }> {
  const data = {
    title: input.title,
    description: input.description || null,
    rarity: input.rarity,
    realmId: input.realmId,
    artwork: input.artwork,
    artworkSource: input.artwork ? ("UPLOADED" as const) : ("PROCEDURAL" as const),
    isBound: input.isBound,
    specialKind: input.kind,
    rewardAchievementKey: input.rewardAchievementKey,
  };
  try {
    return await db.$transaction(async (tx) => {
      const existing = input.id ? await editedCard(tx, input.id) : null;
      if (existing) assertEditable(existing, input);
      assertRewardAchievement(input.rewardAchievementKey, existing?.rewardAchievementKey ?? null);
      const card = existing
        ? await updateSpecialCardTx(tx, existing, data, input)
        : await tx.card.create({
            data: {
              ...data,
              marketValue: await specialCardValueTx(tx, input.rarity),
              cardType: "SPECIAL",
              category: "SPECIAL",
              season: await getCurrentIxCardSeason(tx),
              reviewState: "APPROVED",
            },
            select: { id: true },
          });
      await auditSaveTx(tx, actor, card.id, existing, input);
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
