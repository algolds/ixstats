// src/lib/cards/hub/faces.ts
import type { Prisma, PrismaClient } from "@prisma/client";
import { normalizeArtwork } from "~/lib/cards/face/artwork";
import type { CardFaceData, CardRealmBadge } from "~/lib/cards/face/types";

/** The card fields every face needs. */
export const CARD_FACE_SELECT = {
  id: true,
  title: true,
  rarity: true,
  cardType: true,
  artwork: true,
  isRetired: true,
  collectorNumber: true,
  season: true,
  nsSeason: true,
  realm: { select: { id: true, slug: true, name: true, emblemUrl: true, isSystem: true } },
} satisfies Prisma.CardSelect;

/** The copy fields a face shows: the finish sheen, and at size L the level and serial. */
export const COPY_FACE_SELECT = {
  id: true,
  finish: true,
  serialNumber: true,
  level: true,
} satisfies Prisma.CardOwnershipSelect;

export type CardFaceRow = Prisma.CardGetPayload<{ select: typeof CARD_FACE_SELECT }>;
export type CopyFaceRow = Prisma.CardOwnershipGetPayload<{ select: typeof COPY_FACE_SELECT }>;

export function toRealmBadge(realm: CardFaceRow["realm"]): CardRealmBadge {
  return {
    id: realm.id,
    slug: realm.slug,
    name: realm.name,
    crestUrl: normalizeArtwork(realm.emblemUrl),
    isSystem: realm.isSystem,
  };
}

/** NS cards carry their NS season and Nation cards their edition's site season; no other type shows one. */
function faceSeason(row: CardFaceRow): number | null {
  if (row.cardType === "NS") return row.nsSeason ?? row.season;
  if (row.cardType === "NATION") return row.season;
  return null;
}

/**
 * The face a browser may receive. Art the viewer may not see is stripped here, not hidden in the client (spec §2.3
 * Discovery); NationStates flags are public on NationStates itself, so they always show.
 */
export function toCardFace(
  row: CardFaceRow,
  options: { revealArt: boolean; copy?: CopyFaceRow | null }
): CardFaceData {
  const reveal = options.revealArt || row.cardType === "NS";
  const copy = options.copy ?? null;
  return {
    cardId: row.id,
    title: row.title,
    rarity: row.rarity,
    cardType: row.cardType,
    realm: toRealmBadge(row.realm),
    artwork: reveal ? normalizeArtwork(row.artwork) : null,
    silhouette: !reveal,
    number: row.collectorNumber,
    season: faceSeason(row),
    isRetired: row.isRetired,
    copy: copy
      ? {
          ownershipId: copy.id,
          finish: copy.finish,
          serialNumber: copy.serialNumber,
          level: copy.level,
        }
      : null,
  };
}

/** Faces of copies the viewer holds (a pack just opened, the daily card, an import): their art always shows. */
export async function ownedFaces(
  db: Pick<PrismaClient, "cardOwnership">,
  ownershipIds: readonly string[]
): Promise<CardFaceData[]> {
  if (ownershipIds.length === 0) return [];
  const rows = await db.cardOwnership.findMany({
    where: { id: { in: [...ownershipIds] } },
    select: { ...COPY_FACE_SELECT, cards: { select: CARD_FACE_SELECT } },
  });
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ownershipIds.flatMap((id) => {
    const found = byId.get(id);
    return found ? [toCardFace(found.cards, { revealArt: true, copy: found })] : [];
  });
}
