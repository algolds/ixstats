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
    acquiredAt: AT,
    createdAt: AT,
    updatedAt: AT,
    cards: {
      id: "c1",
      title: "Velarc Throne",
      description: null,
      artwork: null,
      cardType: "LORE",
      rarity: "EPIC",
      season: 2,
      nsCardId: 0,
      nsSeason: null,
      wikiSource: "ixwiki",
      wikiArticleTitle: "Velarc",
      countryId: null,
      marketValue: 1150,
      totalSupply: null,
      category: null,
      subcategory: null,
      artworkSource: "PROCEDURAL",
      artworkCredit: null,
      slug: null,
      wikiExcerpt: null,
      metadata: null,
      isRetired: false,
      retiredAt: null,
      createdAt: AT,
      updatedAt: AT,
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
      acquiredAt: AT,
    });
  });

  it("fills what the card leaves empty and carries no dropped column", () => {
    const card = ownedCardToInstance(owned());
    expect(card.description).toBe("");
    expect(card.artwork).toBe(CARD_ARTWORK_PLACEHOLDER);
    expect(card.totalSupply).toBe(0);
    for (const gone of [
      "stats",
      "nsData",
      "artworkVariants",
      "enhancements",
      "owners",
      "lastSalePrice",
      "evolutionStage",
    ])
      expect(card).not.toHaveProperty(gone);
    expect(card.nsCardId).toBeNull();
    expect(card.nsSeason).toBeNull();
  });

  it("carries the card's category and art source, and no wiki link", () => {
    expect(
      ownedCardToInstance(owned({ category: "MILITARY", artworkSource: "UPLOADED" }))
    ).toMatchObject({ category: "MILITARY", artworkSource: "UPLOADED", wikiUrl: null });
  });

  it("keeps the card's own art and NS ids when it has them", () => {
    const card = ownedCardToInstance(owned({ artwork: "/a.png", nsCardId: 55, nsSeason: 3 }));
    expect(card.artwork).toBe("/a.png");
    expect(card.nsCardId).toBe(55);
    expect(card.nsSeason).toBe(3);
  });
});
