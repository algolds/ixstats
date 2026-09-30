/**
 * Vault summary for a passport: collector level, credits, deck value and the newest cards.
 * (Moved from routers/ixnayid/passport-vault.ts, now typed.)
 */
import type { Prisma } from "@prisma/client";
import { db } from "~/server/db";
import type { CardInstance } from "~/types/cards-display";

const CARD_SELECT = {
  id: true,
  title: true,
  description: true,
  slug: true,
  category: true,
  subcategory: true,
  rarity: true,
  cardType: true,
  season: true,
  marketValue: true,
  totalSupply: true,
  artworkUrl: true,
  artwork: true,
  wikiSource: true,
  wikiArticleTitle: true,
  wikiPageId: true,
  wikiExcerpt: true,
  wikiImageUrl: true,
  stats: true,
  metadata: true,
  attributes: true,
  nsCardId: true,
  nsSeason: true,
  nsData: true,
} satisfies Prisma.CardSelect;

type OwnershipRow = Prisma.CardOwnershipGetPayload<{
  include: { cards: { select: typeof CARD_SELECT } };
}>;

export interface PassportVaultSummary {
  totalCards: number;
  deckValue: number;
  collectorLevel: number;
  collectorXp: number;
  credits: number;
  topCards: CardInstance[];
}

function wikiUrlOf(card: OwnershipRow["cards"]): string | null {
  if (!card.wikiArticleTitle) return null;
  const host = card.wikiSource === "iiwiki" ? "iiwiki.com" : "ixwiki.com";
  return `https://${host}/wiki/${encodeURIComponent(card.wikiArticleTitle)}`;
}

/** Shape an owned card for `CardDisplay`; JSON columns are passed through as stored. */
export function toCardInstance(o: OwnershipRow): CardInstance {
  const c = o.cards;
  return {
    id: c.id,
    title: c.title || "IxCard",
    description: c.description,
    artwork: c.artwork ?? "",
    artworkVariants: null,
    cardType: c.cardType,
    category: c.category,
    subcategory: c.subcategory,
    artworkUrl: c.artworkUrl,
    artworkSource: null,
    artworkCredit: null,
    slug: c.slug,
    rarity: c.rarity as CardInstance["rarity"],
    season: c.season,
    nsCardId: c.nsCardId,
    nsSeason: c.nsSeason,
    nsData: c.nsData as CardInstance["nsData"],
    wikiSource: c.wikiSource,
    wikiArticleTitle: c.wikiArticleTitle,
    wikiPageId: c.wikiPageId,
    wikiExcerpt: c.wikiExcerpt,
    wikiImageUrl: c.wikiImageUrl,
    wikiUrl: wikiUrlOf(c),
    countryId: null,
    stats: (c.stats ?? {}) as CardInstance["stats"],
    metadata: c.metadata as CardInstance["metadata"],
    attributes: (c.attributes ?? {}) as CardInstance["attributes"],
    ownershipId: o.id,
    isLocked: o.isLocked,
    marketValue: c.marketValue,
    totalSupply: c.totalSupply ?? 0,
    level: o.level,
    evolutionStage: 0,
    enhancements: null,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
    lastTrade: o.lastSaleDate,
    serialNumber: o.serialNumber,
    experience: o.experience,
    acquiredAt: o.acquiredAt,
  };
}

export async function resolvePassportVault(
  userId: string | null | undefined
): Promise<PassportVaultSummary> {
  const summary: PassportVaultSummary = {
    totalCards: 0,
    deckValue: 0,
    collectorLevel: 1,
    collectorXp: 0,
    credits: 0,
    topCards: [],
  };
  if (!userId) return summary;

  const live = { ownerId: userId, cards: { isRetired: false } };
  try {
    const [vault, liveOwnerships, newest] = await Promise.all([
      db.myVault.findUnique({
        where: { userId },
        select: { credits: true, vaultLevel: true, vaultXp: true },
      }),
      db.cardOwnership.findMany({
        where: live,
        select: { quantity: true, cards: { select: { marketValue: true } } },
      }),
      db.cardOwnership.findMany({
        where: { ownerId: userId },
        take: 6,
        orderBy: [{ createdAt: "desc" }],
        include: { cards: { select: CARD_SELECT } },
      }),
    ]);

    if (vault) {
      summary.credits = Math.floor(vault.credits);
      summary.collectorLevel = vault.vaultLevel;
      summary.collectorXp = vault.vaultXp;
    }
    summary.totalCards = liveOwnerships.length;
    summary.deckValue = liveOwnerships.reduce(
      (sum, o) => sum + o.cards.marketValue * o.quantity,
      0
    );
    summary.topCards = newest.map(toCardInstance);
  } catch (err) {
    console.warn("[PassportVault] Failed to resolve vault summary for user", userId, err);
  }
  return summary;
}
