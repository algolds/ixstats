// src/lib/cards/hub/showcases.ts
import { TRPCError } from "@trpc/server";
import type { Prisma, PrismaClient } from "@prisma/client";
import { z } from "zod";
import { DISPLAY_SIZE, SHOWCASE_LIMITS } from "~/lib/cards/face/showcase-limits";
import type { CardFaceData } from "~/lib/cards/face/types";
import { displayedCopies } from "./displayed";
import { CARD_FACE_SELECT, COPY_FACE_SELECT, toCardFace } from "./faces";
import type { PlayerRules } from "./players";

type ShowcaseDb = Pick<
  PrismaClient,
  "cardCollection" | "cardCollectionItem" | "cardOwnership" | "$transaction"
>;

/** Showcases are stored as `CardCollection` rows holding copies (`CardCollectionItem`). */
export { SHOWCASE_LIMITS };

export const ShowcaseFieldsSchema = z.object({
  name: z.string().trim().min(1).max(SHOWCASE_LIMITS.name),
  description: z.string().trim().max(SHOWCASE_LIMITS.description).optional(),
  isPublic: z.boolean().default(false),
});
export type ShowcaseFields = z.infer<typeof ShowcaseFieldsSchema>;

export interface ShowcaseSummary {
  id: string;
  name: string;
  description: string | null;
  isPublic: boolean;
  pinned: boolean;
  itemCount: number;
  cover: CardFaceData | null;
}

export interface ShowcaseItem {
  itemId: string;
  face: CardFaceData;
}

export interface ShowcaseView {
  id: string;
  name: string;
  description: string | null;
  isPublic: boolean;
  pinned: boolean;
  /** Another player's showcase names its owner by passport handle; null on the viewer's own. */
  ownerHandle: string | null;
  isOwner: boolean;
  items: ShowcaseItem[];
}

const ITEM_SELECT = {
  id: true,
  cardOwnership: { select: { ...COPY_FACE_SELECT, cards: { select: CARD_FACE_SELECT } } },
} satisfies Prisma.CardCollectionItemSelect;
type ItemRow = Prisma.CardCollectionItemGetPayload<{ select: typeof ITEM_SELECT }>;

/** A showcase shows its cards' art to anyone allowed to see it (spec §2.3 Discovery); a retired card shows none. */
const itemFace = (item: ItemRow) =>
  toCardFace(item.cardOwnership.cards, { revealArt: true, copy: item.cardOwnership });

/** A pin counts only on a public showcase: a private one is never shown to others (`displayedCopies`). */
const pinTime = (row: { isPublic: boolean; pinnedAt: Date | null }) =>
  row.isPublic && row.pinnedAt ? row.pinnedAt.getTime() : 0;

async function ownShowcase(db: ShowcaseDb, userId: string, id: string) {
  const showcase = await db.cardCollection.findFirst({
    where: { id, userId },
    select: { id: true, isPublic: true, _count: { select: { items: true } } },
  });
  if (!showcase) throw new TRPCError({ code: "NOT_FOUND", message: "Showcase not found." });
  return showcase;
}

export async function listMyShowcases(db: ShowcaseDb, userId: string): Promise<ShowcaseSummary[]> {
  const rows = await db.cardCollection.findMany({
    where: { userId },
    orderBy: [{ pinnedAt: { sort: "desc", nulls: "last" } }, { updatedAt: "desc" }],
    select: {
      id: true,
      name: true,
      description: true,
      isPublic: true,
      pinnedAt: true,
      _count: { select: { items: true } },
      items: { take: 1, orderBy: { addedAt: "asc" }, select: ITEM_SELECT },
    },
  });
  // Pinning clears the others, but two tabs can race: the latest public pin is the pinned one.
  const latest = Math.max(0, ...rows.map(pinTime));
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    isPublic: r.isPublic,
    pinned: latest > 0 && pinTime(r) === latest,
    itemCount: r._count.items,
    cover: r.items[0] ? itemFace(r.items[0]) : null,
  }));
}

/**
 * A showcase as the viewer may see it: its owner always; anyone else while it is public and its owner shows Vault
 * cards. Others never see its retired copies, as the display leaves them out; its owner sees their placeholder faces.
 */
export async function getShowcase(
  db: ShowcaseDb,
  viewerId: string,
  id: string,
  rules: PlayerRules
): Promise<ShowcaseView | null> {
  const row = await db.cardCollection.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      description: true,
      isPublic: true,
      pinnedAt: true,
      userId: true,
      items: { orderBy: { addedAt: "asc" }, take: SHOWCASE_LIMITS.items, select: ITEM_SELECT },
    },
  });
  if (!row) return null;
  const isOwner = row.userId === viewerId;
  if (!isOwner && !row.isPublic) return null;
  const owner = isOwner ? null : (await rules.playersOf([row.userId])).get(row.userId);
  if (!isOwner && !owner?.showsVault) return null;
  const items = isOwner ? row.items : row.items.filter((i) => !i.cardOwnership.cards.isRetired);
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    isPublic: row.isPublic,
    pinned: pinTime(row) > 0,
    ownerHandle: owner?.handle ?? null,
    isOwner,
    items: items.map((item) => ({ itemId: item.id, face: itemFace(item) })),
  };
}

export async function createShowcase(db: ShowcaseDb, userId: string, fields: ShowcaseFields) {
  const count = await db.cardCollection.count({ where: { userId } });
  if (count >= SHOWCASE_LIMITS.perPlayer) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: `You can keep up to ${SHOWCASE_LIMITS.perPlayer} showcases.`,
    });
  }
  return db.cardCollection.create({
    data: {
      userId,
      name: fields.name,
      description: fields.description || null,
      isPublic: fields.isPublic,
    },
    select: { id: true },
  });
}

/** Making a showcase private also unpins it, so it never stays the player's display. */
export async function updateShowcase(
  db: ShowcaseDb,
  userId: string,
  id: string,
  fields: ShowcaseFields
) {
  await ownShowcase(db, userId, id);
  await db.cardCollection.update({
    where: { id },
    data: {
      name: fields.name,
      description: fields.description || null,
      isPublic: fields.isPublic,
      ...(fields.isPublic ? {} : { pinnedAt: null }),
      updatedAt: new Date(),
    },
  });
}

export async function deleteShowcase(db: ShowcaseDb, userId: string, id: string) {
  await ownShowcase(db, userId, id);
  await db.cardCollection.delete({ where: { id } });
}

/** Adds copies the player holds; a copy already in the showcase is skipped. */
export async function addToShowcase(
  db: ShowcaseDb,
  userId: string,
  id: string,
  ownershipIds: readonly string[]
): Promise<{ added: number }> {
  const showcase = await ownShowcase(db, userId, id);
  const unique = [...new Set(ownershipIds)];
  const held = await db.cardOwnership.findMany({
    where: { id: { in: unique }, ownerId: userId },
    select: { id: true },
  });
  if (held.length !== unique.length) {
    throw new TRPCError({ code: "NOT_FOUND", message: "A card you picked is no longer yours." });
  }
  if (showcase._count.items + unique.length > SHOWCASE_LIMITS.items) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: `A showcase holds up to ${SHOWCASE_LIMITS.items} cards.`,
    });
  }
  const result = await db.cardCollectionItem.createMany({
    data: unique.map((cardOwnershipId) => ({ collectionId: id, cardOwnershipId })),
    skipDuplicates: true,
  });
  await db.cardCollection.update({ where: { id }, data: { updatedAt: new Date() } });
  return { added: result.count };
}

export async function removeFromShowcase(
  db: ShowcaseDb,
  userId: string,
  id: string,
  ownershipId: string
) {
  await ownShowcase(db, userId, id);
  await db.cardCollectionItem.deleteMany({
    where: { collectionId: id, cardOwnershipId: ownershipId },
  });
  await db.cardCollection.update({ where: { id }, data: { updatedAt: new Date() } });
}

/**
 * One pinned showcase per player: pinning clears the others, and unpinning clears only this one, so an unpin from a
 * stale screen never takes the pin off another showcase. Only a public showcase pins; the pin re-checks it in the
 * same transaction, so a showcase made private meanwhile stays unpinned and `pinned` comes back false.
 */
export async function pinShowcase(
  db: ShowcaseDb,
  userId: string,
  id: string,
  pinned: boolean
): Promise<{ pinned: boolean }> {
  const showcase = await ownShowcase(db, userId, id);
  if (pinned && !showcase.isPublic) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Make the showcase public before you pin it.",
    });
  }
  const [, pin] = await db.$transaction([
    db.cardCollection.updateMany({
      where: pinned ? { userId, pinnedAt: { not: null } } : { id, userId },
      data: { pinnedAt: null },
    }),
    ...(pinned
      ? [
          db.cardCollection.updateMany({
            where: { id, isPublic: true },
            data: { pinnedAt: new Date() },
          }),
        ]
      : []),
  ]);
  // `pin` exists only when pinning.
  return { pinned: pinned && pin.count > 0 };
}

/** The wallet's showcase: the pinned one, else the player's most valuable copies (spec §2.3 Sets). */
export async function myDisplay(
  db: Pick<PrismaClient, "cardCollection" | "cardOwnership">,
  userId: string
): Promise<{ showcase: { id: string; name: string } | null; faces: CardFaceData[] }> {
  const shown = await displayedCopies(db, userId, DISPLAY_SIZE);
  return {
    showcase: shown.showcase,
    faces: shown.copies.map(({ card, copy }) => toCardFace(card, { revealArt: true, copy })),
  };
}
