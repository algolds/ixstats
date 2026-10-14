import type { Prisma } from "@prisma/client";
import type { CardInstance } from "~/types/cards-display";
import { CARD_ARTWORK_PLACEHOLDER } from "./display-utils";

/** An ownership row with its card, as `cards.getMyCards` and `cards.getMyTopCards` return it. */
export type OwnedCard = Prisma.CardOwnershipGetPayload<{ include: { cards: true } }>;

/** The card display shape for an owned card: the card's fields plus what this copy has (serial, level, lock). */
export function ownedCardToInstance(ownership: OwnedCard): CardInstance {
  const card = ownership.cards;
  const stats = (card.stats ?? {}) as CardInstance["stats"];
  return {
    id: card.id,
    ownershipId: ownership.id,
    isLocked: ownership.isLocked,
    title: card.title,
    description: card.description ?? "",
    artwork: card.artwork || CARD_ARTWORK_PLACEHOLDER,
    artworkVariants: card.artworkVariants as CardInstance["artworkVariants"],
    cardType: card.cardType,
    rarity: card.rarity as CardInstance["rarity"],
    season: card.season,
    nsCardId: card.nsCardId || null,
    nsSeason: card.nsSeason || null,
    nsData: card.nsData as CardInstance["nsData"],
    wikiSource: card.wikiSource,
    wikiArticleTitle: card.wikiArticleTitle,
    wikiUrl: null,
    countryId: card.countryId,
    stats,
    baseStats: stats as CardInstance["baseStats"],
    marketValue: card.marketValue,
    totalSupply: card.totalSupply ?? 0,
    level: ownership.level,
    evolutionStage: 0,
    enhancements: card.enhancements as CardInstance["enhancements"],
    serialNumber: ownership.serialNumber,
    experience: ownership.experience,
    lastSalePrice: ownership.lastSalePrice,
    lastSaleDate: ownership.lastSaleDate,
    acquiredAt: ownership.acquiredAt,
    createdAt: ownership.createdAt,
    updatedAt: ownership.updatedAt,
    lastTrade: null,
    country: null,
    owners: [],
  };
}
