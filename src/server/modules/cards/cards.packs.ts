/**
 * The pack editor: odds per rarity, adding up to 100 because the store shows them; the pack's card type and a pool
 * filter by realm, type and category; a guaranteed rarity that can be cleared; limits and expiry; and a preview of the
 * approved cards the pack draws from. A pack goes on sale only while its pool has a card of every rarity it shows or
 * guarantees, as it could be neither sold nor opened otherwise.
 */
import { CardRarity, CardType, PackType, type Prisma, type PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { LoreCategory } from "~/lib/cards/category-enums";
import { ADMIN_RARITY_LABEL } from "~/lib/cards/face/labels";
import {
  PACK_CARD_TYPES,
  PACK_MAX_CARDS,
  PACK_MAX_LIMIT,
  PACK_MAX_PRICE,
  PACK_ODDS_FIELDS,
  PackOddsSchema,
  rarityList,
} from "~/lib/cards/pack-odds";
import { mergePackTheme, missingRarities, packThemePool } from "~/lib/cards/pack-service";
import { MAX_CARD_SEASON } from "~/lib/cards/season";
import type { CardAdminActor } from "~/server/shared/admin-actor";
import { recordCardAudit } from "./cards.audit";

const PackPoolSchema = z.object({
  realmIds: z.array(z.string().min(1).max(64)).max(50),
  categories: z.array(z.nativeEnum(LoreCategory)).max(20),
  cardTypes: z.array(z.nativeEnum(CardType)).max(5),
});

const PackSeasonSchema = z.number().int().min(1).max(MAX_CARD_SEASON).nullable();

/** A whole number from 1 to `max`; every failure carries `message` (the editor checks the same bounds first). */
const wholeNumber = (max: number, message: string) =>
  z.number().int(message).min(1, message).max(max, message);
const LIMIT_RANGE = `a whole number from 1 to ${PACK_MAX_LIMIT.toLocaleString("en")}`;

export const PackEditorSchema = z
  .object({
    id: z.string().min(1).optional(),
    name: z.string().trim().min(1).max(100),
    description: z.string().trim().max(500).nullable(),
    artwork: z.string().trim().max(500).nullable(),
    packType: z.nativeEnum(PackType),
    priceCredits: wholeNumber(
      PACK_MAX_PRICE,
      `The price is a whole number from 1 to ${PACK_MAX_PRICE.toLocaleString("en")} IxC`
    ),
    cardCount: wholeNumber(PACK_MAX_CARDS, `A pack holds 1 to ${PACK_MAX_CARDS} cards`),
    cardType: z
      .nativeEnum(CardType)
      .nullable()
      .refine((type) => type === null || PACK_CARD_TYPES.includes(type), {
        message: "A pack draws Lore, Nation or NationStates cards, or any of them",
      }),
    guaranteedRarity: z.nativeEnum(CardRarity).nullable(),
    isActive: z.boolean(),
    odds: PackOddsSchema,
    pool: PackPoolSchema,
    limitedQuantity: wholeNumber(
      PACK_MAX_LIMIT,
      `Total stock is blank or ${LIMIT_RANGE}`
    ).nullable(),
    purchaseLimit: wholeNumber(
      PACK_MAX_LIMIT,
      `The per-player limit is blank or ${LIMIT_RANGE}`
    ).nullable(),
    expiresAt: z.date().nullable(),
  })
  // The pack's own season retargets its pool, and the editor has no field for it, so a save refuses it rather than
  // writing what a client sent: a create takes the column default, an update leaves it alone.
  .strict();
export type PackEditorInput = z.infer<typeof PackEditorSchema>;

/** Every pack, on-sale first, with how many were issued and the pool the editor shows. */
export async function listPacks(db: PrismaClient) {
  const packs = await db.cardPack.findMany({
    orderBy: [{ isActive: "desc" }, { packType: "asc" }, { priceCredits: "asc" }],
    include: { _count: { select: { UserPack: true } } },
  });
  return packs.map((pack) => ({ ...pack, pool: packThemePool(pack.themeFilter) }));
}

const packGone = () => new TRPCError({ code: "NOT_FOUND", message: "That pack no longer exists." });

/**
 * Refuses a pack going on sale while its pool, read in the caller's transaction, has no card of a rarity it gives odds
 * for or guarantees: the store would refuse to sell it and a bought one would never open.
 */
async function assertDeliverable(
  tx: Prisma.TransactionClient,
  pack: Parameters<typeof missingRarities>[1]
): Promise<void> {
  const { missing } = await missingRarities(tx, pack);
  if (missing.length > 0) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: `This pack can't go on sale: it has no ${rarityList(missing, ADMIN_RARITY_LABEL)} cards to give. Set those odds to 0, clear the guarantee or widen the pool.`,
    });
  }
}

export async function savePack(
  db: PrismaClient,
  actor: CardAdminActor,
  input: PackEditorInput
): Promise<{ id: string }> {
  return db.$transaction(async (tx) => {
    const existing = input.id
      ? await tx.cardPack.findUnique({
          where: { id: input.id },
          select: { id: true, themeFilter: true, season: true },
        })
      : null;
    // An id that matches nothing is a pack deleted under the editor; saving must not quietly make a new one
    if (input.id && !existing) throw packGone();
    const data = {
      name: input.name,
      description: input.description,
      artwork: input.artwork,
      packType: input.packType,
      priceCredits: input.priceCredits,
      cardCount: input.cardCount,
      cardType: input.cardType,
      guaranteedRarity: input.guaranteedRarity,
      isActive: input.isActive,
      ...input.odds,
      themeFilter: mergePackTheme(existing?.themeFilter ?? null, input.pool),
      limitedQuantity: input.limitedQuantity,
      purchaseLimit: input.purchaseLimit,
      expiresAt: input.expiresAt,
      // The column has no @updatedAt
      updatedAt: new Date(),
    };
    // Checked against the pool as it will be stored; saving off sale is always allowed
    if (input.isActive) {
      await assertDeliverable(tx, {
        cardType: input.cardType,
        season: existing?.season ?? null,
        themeFilter: data.themeFilter,
        ...input.odds,
        guaranteedRarity: input.guaranteedRarity,
      });
    }
    const pack = existing
      ? await tx.cardPack.update({ where: { id: existing.id }, data })
      : await tx.cardPack.create({ data });
    await recordCardAudit(tx, {
      action: "CARD_PACK_SAVE",
      actor: actor.clerkId,
      target: pack.id,
      details: `${existing ? "Edited" : "Created"} the pack "${input.name}"`,
    });
    return { id: pack.id };
  });
}

/**
 * Puts a pack on or off sale; a pack already in that state writes and audits nothing. Off sale is always allowed; on
 * sale needs a pool that can give every rarity the pack shows or guarantees.
 */
export async function setPackActive(
  db: PrismaClient,
  actor: CardAdminActor,
  input: { packId: string; isActive: boolean }
): Promise<void> {
  await db.$transaction(async (tx) => {
    const pack = await tx.cardPack.findUnique({ where: { id: input.packId } });
    if (!pack) throw packGone();
    if (pack.isActive === input.isActive) return;
    if (input.isActive) await assertDeliverable(tx, pack);
    await tx.cardPack.update({
      where: { id: pack.id },
      data: { isActive: input.isActive, updatedAt: new Date() },
    });
    await recordCardAudit(tx, {
      action: "CARD_PACK_SAVE",
      actor: actor.clerkId,
      target: pack.id,
      details: input.isActive
        ? `Put the pack "${pack.name}" on sale`
        : `Took the pack "${pack.name}" off sale`,
    });
  });
}

export const PackPreviewSchema = z.object({
  // The pack being edited, whose stored theme is merged in and whose unopened copies are counted; null for a new pack
  packId: z.string().min(1).max(64).nullable(),
  cardType: z.nativeEnum(CardType).nullable(),
  season: PackSeasonSchema,
  pool: PackPoolSchema,
  odds: PackOddsSchema,
  guaranteedRarity: z.nativeEnum(CardRarity).nullable(),
});

/**
 * How many approved cards of each rarity the pack would draw from, and some of them; the rarities it shows or
 * guarantees with no card, which keep it off sale; and how many unopened copies players hold. A stored pack previews
 * the theme its save would write, so the preview and the save's check count the same pool. The sample is unordered,
 * so the read stops after 12 index rows instead of sorting the whole pool.
 */
export async function previewPackPool(db: PrismaClient, input: z.infer<typeof PackPreviewSchema>) {
  const stored = input.packId
    ? await db.cardPack.findUnique({ where: { id: input.packId }, select: { themeFilter: true } })
    : null;
  const {
    where,
    counts,
    missing: undeliverable,
  } = await missingRarities(db, {
    cardType: input.cardType,
    season: input.season,
    themeFilter: mergePackTheme(stored?.themeFilter ?? null, input.pool),
    ...input.odds,
    guaranteedRarity: input.guaranteedRarity,
  });
  const [samples, unopened] = await Promise.all([
    db.card.findMany({
      where,
      take: 12,
      select: { id: true, title: true, rarity: true, realm: { select: { name: true } } },
    }),
    input.packId ? db.userPack.count({ where: { packId: input.packId, isOpened: false } }) : 0,
  ]);
  const byRarity = PACK_ODDS_FIELDS.map(([rarity, field]) => ({
    rarity,
    count: counts[rarity] ?? 0,
    odds: input.odds[field],
    // Shown or guaranteed with no card: the pack can't go on sale, and an unopened one can't be opened
    empty: undeliverable.includes(rarity),
  }));
  return {
    total: byRarity.reduce((sum, row) => sum + row.count, 0),
    byRarity,
    undeliverable,
    unopened,
    samples: samples.map((card) => ({
      id: card.id,
      title: card.title,
      rarity: card.rarity,
      realmName: card.realm.name,
    })),
  };
}
