/**
 * The pack editor: odds per rarity, adding up to 100 because the store shows them; a pool filter by realm, type and
 * category; a guaranteed rarity that can be cleared; limits and expiry; and a preview of the approved cards the pack
 * draws from.
 */
import { CardRarity, CardType, PackType, type Prisma, type PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { LoreCategory } from "~/lib/cards/category-enums";
import { isJsonObject } from "~/lib/cards/ns-facts";
import { PACK_ODDS_FIELDS, PackOddsSchema, type PackOdds } from "~/lib/cards/pack-odds";
import { packPoolWhere, packThemePool } from "~/lib/cards/pack-service";
import { MAX_CARD_SEASON } from "~/lib/cards/season";
import { recordCardAudit, type CardAdminActor } from "./cards.audit";

export const PackPoolSchema = z.object({
  realmIds: z.array(z.string().min(1).max(64)).max(50),
  categories: z.array(z.nativeEnum(LoreCategory)).max(20),
  cardTypes: z.array(z.nativeEnum(CardType)).max(5),
});
export type PackPool = z.infer<typeof PackPoolSchema>;

export const PackSeasonSchema = z.number().int().min(1).max(MAX_CARD_SEASON).nullable();

export const PackEditorSchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).nullable(),
  artwork: z.string().trim().max(500).nullable(),
  packType: z.nativeEnum(PackType),
  priceCredits: z.number().int().positive().max(1_000_000),
  cardCount: z.number().int().min(1).max(20),
  guaranteedRarity: z.nativeEnum(CardRarity).nullable(),
  isActive: z.boolean(),
  odds: PackOddsSchema,
  season: PackSeasonSchema,
  cardType: z.nativeEnum(CardType).nullable(),
  pool: PackPoolSchema,
  limitedQuantity: z.number().int().positive().nullable(),
  purchaseLimit: z.number().int().positive().nullable(),
  expiresAt: z.date().nullable(),
});
export type PackEditorInput = z.infer<typeof PackEditorSchema>;

/** Every pack, on-sale first, with how many were issued and the pool the editor shows. */
export async function listPacks(db: PrismaClient) {
  const packs = await db.cardPack.findMany({
    orderBy: [{ isActive: "desc" }, { packType: "asc" }, { priceCredits: "asc" }],
    include: { _count: { select: { UserPack: true } } },
  });
  return packs.map((pack) => ({ ...pack, pool: packThemePool(pack.themeFilter) }));
}

/** The stored theme with the editor's pool keys replaced; keys the editor does not show are kept. */
function mergedTheme(existing: Prisma.JsonValue | null, pool: PackPool): Prisma.InputJsonObject {
  return {
    ...(isJsonObject(existing) ? existing : {}),
    realmIds: pool.realmIds,
    categories: pool.categories,
    cardTypes: pool.cardTypes,
  };
}

const packGone = () => new TRPCError({ code: "NOT_FOUND", message: "That pack no longer exists." });

export async function savePack(
  db: PrismaClient,
  actor: CardAdminActor,
  input: PackEditorInput
): Promise<{ id: string }> {
  return db.$transaction(async (tx) => {
    const existing = input.id
      ? await tx.cardPack.findUnique({
          where: { id: input.id },
          select: { id: true, themeFilter: true },
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
      guaranteedRarity: input.guaranteedRarity,
      isActive: input.isActive,
      ...input.odds,
      season: input.season,
      cardType: input.cardType,
      themeFilter: mergedTheme(existing?.themeFilter ?? null, input.pool),
      limitedQuantity: input.limitedQuantity,
      purchaseLimit: input.purchaseLimit,
      expiresAt: input.expiresAt,
      // The column has no @updatedAt
      updatedAt: new Date(),
    };
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

/** Puts a pack on or off sale; a pack already in that state writes and audits nothing. */
export async function setPackActive(
  db: PrismaClient,
  actor: CardAdminActor,
  input: { packId: string; isActive: boolean }
): Promise<void> {
  await db.$transaction(async (tx) => {
    const pack = await tx.cardPack.findUnique({
      where: { id: input.packId },
      select: { id: true, name: true, isActive: true },
    });
    if (!pack) throw packGone();
    if (pack.isActive === input.isActive) return;
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

/** How many approved cards of each rarity the pack would draw from, and a few of the newest. */
export async function previewPackPool(
  db: PrismaClient,
  input: { cardType: CardType | null; season: number | null; pool: PackPool; odds: PackOdds }
) {
  const where = await packPoolWhere(db, {
    cardType: input.cardType,
    season: input.season,
    themeFilter: input.pool,
  });
  const [counts, samples] = await Promise.all([
    db.card.groupBy({ by: ["rarity"], where, _count: { _all: true } }),
    db.card.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 12,
      select: { id: true, title: true, rarity: true, realm: { select: { name: true } } },
    }),
  ]);
  const byRarity = new Map(counts.map((row) => [row.rarity, row._count._all]));
  return {
    total: counts.reduce((sum, row) => sum + row._count._all, 0),
    // A rarity with odds but no card falls back to a neighbouring tier when the pack opens
    byRarity: PACK_ODDS_FIELDS.map(([rarity, field]) => {
      const count = byRarity.get(rarity) ?? 0;
      return {
        rarity,
        count,
        odds: input.odds[field],
        fallsBack: input.odds[field] > 0 && count === 0,
      };
    }),
    samples: samples.map((card) => ({
      id: card.id,
      title: card.title,
      rarity: card.rarity,
      realmName: card.realm.name,
    })),
  };
}
