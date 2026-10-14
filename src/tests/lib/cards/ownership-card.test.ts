import { ownedCardToInstance, type OwnedCard } from "~/lib/cards/ownership-card";
import { CARD_ARTWORK_PLACEHOLDER } from "~/lib/cards/display-utils";

const AT = new Date("2026-01-02T03:04:05Z");

const owned = (card: Partial<OwnedCard["cards"]> = {}): OwnedCard =>
  ({
    id: "own-1",
    cardId: "c1",
    isLocked: true,
    level: 3,
    experience: 40,
    serialNumber: 7,
    lastSalePrice: 90,
    lastSaleDate: AT,
    acquiredAt: AT,
    createdAt: AT,
    updatedAt: AT,
    cards: {
      id: "c1",
      title: "Velarc Throne",
      description: null,
      artwork: null,
      artworkVariants: null,
      cardType: "LORE",
      rarity: "EPIC",
      season: 2,
      nsCardId: 0,
      nsSeason: null,
      nsData: null,
      wikiSource: "ixwiki",
      wikiArticleTitle: "Velarc",
      countryId: null,
      stats: null,
      marketValue: 1150,
      totalSupply: null,
      enhancements: null,
      ...card,
    },
  }) as OwnedCard;

describe("ownedCardToInstance", () => {
  it("carries the card's fields and this copy's serial, level, lock and dates", () => {
    expect(ownedCardToInstance(owned())).toMatchObject({
      id: "c1",
      ownershipId: "own-1",
      isLocked: true,
      title: "Velarc Throne",
      rarity: "EPIC",
      season: 2,
      marketValue: 1150,
      level: 3,
      experience: 40,
      serialNumber: 7,
      lastSalePrice: 90,
      acquiredAt: AT,
      owners: [],
    });
  });

  it("fills what the card leaves empty: no description, placeholder art, zero supply, empty stats", () => {
    const card = ownedCardToInstance(owned());
    expect(card.description).toBe("");
    expect(card.artwork).toBe(CARD_ARTWORK_PLACEHOLDER);
    expect(card.totalSupply).toBe(0);
    expect(card.stats).toEqual({});
    expect(card.nsCardId).toBeNull();
    expect(card.nsSeason).toBeNull();
  });

  it("keeps the card's own art and NS ids when it has them", () => {
    const card = ownedCardToInstance(owned({ artwork: "/a.png", nsCardId: 55, nsSeason: 3 }));
    expect(card.artwork).toBe("/a.png");
    expect(card.nsCardId).toBe(55);
    expect(card.nsSeason).toBe(3);
  });
});
