import type { Card, Prisma } from "@prisma/client";
import type { CardInstance } from "~/types/cards-display";
import { CARD_ARTWORK_PLACEHOLDER } from "./display-utils";

/** An ownership row with its card, as `cards.getMyCards` and `cards.getMyTopCards` return it. */
export type OwnedCard = Prisma.CardOwnershipGetPayload<{ include: { cards: true } }>;

/** The card display shape of a card with no copy attached (a library or admin explorer row). */
export function cardToInstance(card: Card): CardInstance {
  return {
    id: card.id,
    title: card.title,
    description: card.description ?? "",
    artwork: card.artwork || CARD_ARTWORK_PLACEHOLDER,
    cardType: card.cardType,
    category: card.category,
    subcategory: card.subcategory,
    artworkSource: card.artworkSource,
    artworkCredit: card.artworkCredit,
    slug: card.slug,
    rarity: card.rarity,
    season: card.season,
    nsCardId: card.nsCardId || null,
    nsSeason: card.nsSeason || null,
    wikiSource: card.wikiSource,
    wikiArticleTitle: card.wikiArticleTitle,
    wikiExcerpt: card.wikiExcerpt,
    wikiUrl: null,
    countryId: card.countryId,
    metadata: card.metadata as CardInstance["metadata"],
    marketValue: card.marketValue,
    totalSupply: card.totalSupply ?? 0,
    level: 1,
    createdAt: card.createdAt,
    updatedAt: card.updatedAt,
    lastTrade: null,
    isRetired: card.isRetired,
    retiredAt: card.retiredAt,
    country: null,
  };
}

/** The card display shape for an owned card: the card's fields plus what this copy has (serial, level, lock). */
export function ownedCardToInstance(ownership: OwnedCard): CardInstance {
  return {
    ...cardToInstance(ownership.cards),
    ownershipId: ownership.id,
    isLocked: ownership.isLocked,
    level: ownership.level,
    serialNumber: ownership.serialNumber,
    experience: ownership.experience,
    acquiredAt: ownership.acquiredAt,
    createdAt: ownership.createdAt,
    updatedAt: ownership.updatedAt,
  };
}
