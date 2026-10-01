/**
 * Vault summary for a passport: collector level, credits, deck value, category focus and the
 * collection highlight (the most valuable live cards).
 * (Moved from routers/ixnayid/passport-vault.ts, now typed.)
 */
import type { Prisma } from "@prisma/client";
import { db } from "~/server/db";
import type { CardInstance } from "~/types/cards-display";
import { publicArticleUrl } from "~/lib/wiki-os/config";

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

/** Lore card categories a collection can span (every `LoreCategory` except `NS_IMPORT`). */
export const LORE_CATEGORY_COUNT = 12;

/** How many cards the collection highlight shows. */
export const COLLECTION_HIGHLIGHT_SIZE = 6;

export interface PassportVaultFocus {
  /** Distinct lore categories across the live collection (NationStates imports excluded). */
  categoryCount: number;
  /** Of `LORE_CATEGORY_COUNT`. */
  categoryTotal: number;
  /** The category holding the most cards, or null for an NS-only or empty collection. */
  topCategory: string | null;
}

export interface PassportVaultSummary {
  totalCards: number;
  deckValue: number;
  collectorLevel: number;
  collectorXp: number;
  credits: number;
  /** Collection breadth; null when the owner hides it. */
  focus: PassportVaultFocus | null;
  /** Collection highlight: the most valuable live cards, highest market value first. */
  topCards: CardInstance[];
}

/** Category breadth of a collection. Pure. */
export function toVaultFocus(
  categories: ReadonlyArray<string | null | undefined>
): PassportVaultFocus {
  const counts = new Map<string, number>();
  for (const category of categories) {
    if (!category || category === "NS_IMPORT") continue;
    counts.set(category, (counts.get(category) ?? 0) + 1);
  }
  let topCategory: string | null = null;
  let topCount = 0;
  for (const [category, count] of counts) {
    if (count > topCount) {
      topCategory = category;
      topCount = count;
    }
  }
  return { categoryCount: counts.size, categoryTotal: LORE_CATEGORY_COUNT, topCategory };
}

function wikiUrlOf(card: OwnershipRow["cards"]): string | null {
  if (!card.wikiArticleTitle) return null;
  return publicArticleUrl(card.wikiArticleTitle, card.wikiSource === "iiwiki" ? "iiwiki" : "ixwiki");
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
    focus: toVaultFocus([]),
    topCards: [],
  };
  if (!userId) return summary;

  const live = { ownerId: userId, cards: { isRetired: false } };
  try {
    const [vault, liveOwnerships, mostValuable] = await Promise.all([
      db.myVault.findUnique({
        where: { userId },
        select: { credits: true, vaultLevel: true, vaultXp: true },
      }),
      db.cardOwnership.findMany({
        where: live,
        select: { quantity: true, cards: { select: { marketValue: true, category: true } } },
      }),
      db.cardOwnership.findMany({
        where: live,
        take: COLLECTION_HIGHLIGHT_SIZE,
        orderBy: [{ cards: { marketValue: "desc" } }, { acquiredAt: "asc" }],
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
    summary.focus = toVaultFocus(liveOwnerships.map((o) => o.cards.category));
    summary.topCards = mostValuable.map(toCardInstance);
  } catch (err) {
    console.warn("[PassportVault] Failed to resolve vault summary for user", userId, err);
  }
  return summary;
}
