/**
 * Vault summary for a passport: collector level, credits, deck value, category focus and the
 * collection highlight (the most valuable live cards).
 * (Moved from routers/ixnayid/passport-vault.ts, now typed.)
 */
import type { Prisma } from "@prisma/client";
import { db } from "~/server/db";
import { getVaultConfig, VAULT_CONFIG_DEFAULTS } from "~/lib/vault/vault-perks";
import type { CardInstance } from "~/types/cards-display";
import { BROWSABLE_CATEGORIES } from "~/lib/cards/category-enums";
import { deckValue } from "~/lib/cards/copy-value";
import { wikiReaderPath } from "~/lib/wiki-os/config";
import { commonsPageUrl, parseCardWikiSource } from "~/lib/cards/card-sources";

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
  artwork: true,
  wikiSource: true,
  wikiArticleTitle: true,
  wikiExcerpt: true,
  metadata: true,
  nsCardId: true,
  nsSeason: true,
} satisfies Prisma.CardSelect;

type OwnershipRow = Prisma.CardOwnershipGetPayload<{
  include: { cards: { select: typeof CARD_SELECT } };
}>;

/** Lore card categories a collection can span. */
const LORE_CATEGORY_COUNT = BROWSABLE_CATEGORIES.length;

/** How many cards the collection highlight shows. */
const COLLECTION_HIGHLIGHT_SIZE = 6;

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
  /** Total XP; level = floor(collectorXp / xpPerLevel) + 1. */
  collectorXp: number;
  /** The vault's configured XP per collector level (`vault_xpPerLevel`). */
  xpPerLevel: number;
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
    if (!category) continue;
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

/**
 * Where a card's article opens: the in-app WikiOS reader path (a sister wiki's carries `?source=`); a Commons file
 * opens on Commons.
 */
export function wikiUrlOf(card: OwnershipRow["cards"]): string | null {
  if (!card.wikiArticleTitle) return null;
  const source = parseCardWikiSource(card.wikiSource) ?? "ixwiki";
  return source === "commons"
    ? commonsPageUrl(card.wikiArticleTitle)
    : wikiReaderPath(card.wikiArticleTitle, source);
}

/** Shape an owned card for `CardDisplay`; JSON columns are passed through as stored. */
function toCardInstance(o: OwnershipRow): CardInstance {
  const c = o.cards;
  return {
    id: c.id,
    title: c.title || "IxCard",
    description: c.description,
    artwork: c.artwork ?? "",
    cardType: c.cardType,
    category: c.category,
    subcategory: c.subcategory,
    artworkSource: null,
    artworkCredit: null,
    slug: c.slug,
    rarity: c.rarity,
    season: c.season,
    nsCardId: c.nsCardId,
    nsSeason: c.nsSeason,
    wikiSource: c.wikiSource,
    wikiArticleTitle: c.wikiArticleTitle,
    wikiExcerpt: c.wikiExcerpt,
    wikiUrl: wikiUrlOf(c),
    countryId: null,
    metadata: c.metadata as CardInstance["metadata"],
    ownershipId: o.id,
    isLocked: o.isLocked,
    marketValue: c.marketValue,
    totalSupply: c.totalSupply ?? 0,
    level: o.level,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
    lastTrade: null,
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
    xpPerLevel: VAULT_CONFIG_DEFAULTS.xpPerLevel,
    credits: 0,
    focus: toVaultFocus([]),
    topCards: [],
  };
  if (!userId) return summary;
  summary.xpPerLevel = (await getVaultConfig(db)).xpPerLevel;

  const live = { ownerId: userId, cards: { isRetired: false } };
  try {
    const [vault, liveOwnerships, mostValuable] = await Promise.all([
      db.myVault.findUnique({
        where: { userId },
        select: { credits: true, vaultLevel: true, vaultXp: true },
      }),
      db.cardOwnership.findMany({
        where: live,
        select: { cards: { select: { marketValue: true, category: true } } },
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
    summary.deckValue = deckValue(liveOwnerships);
    summary.focus = toVaultFocus(liveOwnerships.map((o) => o.cards.category));
    summary.topCards = mostValuable.map(toCardInstance);
  } catch (err) {
    console.warn("[PassportVault] Failed to resolve vault summary for user", userId, err);
  }
  return summary;
}
