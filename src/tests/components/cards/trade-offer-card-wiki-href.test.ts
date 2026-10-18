jest.mock("@clerk/nextjs", () => ({ useAuth: () => ({ userId: "u1" }) }));
jest.mock("~/trpc/react", () => ({ api: {} }));

import { toCardInstance } from "~/components/cards/trading/TradeOfferModal";
import { CARD_ARTWORK_PLACEHOLDER } from "~/lib/cards/display-utils";
import type { OwnedCard } from "~/lib/cards/ownership-card";

const ownership = (cards: Partial<OwnedCard["cards"]>): OwnedCard =>
  ({ id: "o1", level: 1, cards: { id: "c1", title: "Velarc", ...cards } }) as OwnedCard;

describe("TradeOfferModal card mapping: wiki link", () => {
  it("routes an IxWiki card to the WikiOS path", () => {
    const card = toCardInstance(ownership({ wikiSource: "ixwiki", wikiArticleTitle: "Velarc" }));
    expect(card.wikiUrl).toBe("/wiki/Velarc");
  });

  it("opens an IIWiki card in the reader, not on iiwiki.com", () => {
    const card = toCardInstance(ownership({ wikiSource: "iiwiki", wikiArticleTitle: "Some Page" }));
    expect(card.wikiUrl).toBe("/wiki/Some_Page?source=iiwiki");
  });

  it("has no link for a card with no article", () => {
    expect(toCardInstance(ownership({})).wikiUrl).toBeNull();
  });

  it("keeps the ownership id as the picker id and carries no dropped column", () => {
    const card = toCardInstance(ownership({ wikiSource: "ixwiki", wikiArticleTitle: "Velarc" }));
    expect(card.id).toBe("o1");
    for (const gone of [
      "stats",
      "nsData",
      "artworkVariants",
      "enhancements",
      "owners",
      "evolutionStage",
    ])
      expect(card).not.toHaveProperty(gone);
  });
});

describe("TradeOfferModal card mapping: a hidden card", () => {
  it("values a hidden (retired) copy at 0, as the trade's own view and Mine do", () => {
    expect(toCardInstance(ownership({ marketValue: 40, isRetired: false })).marketValue).toBe(40);
    expect(toCardInstance(ownership({ marketValue: 40, isRetired: true })).marketValue).toBe(0);
  });

  it("draws the placeholder face for a copy that ships no art", () => {
    const card = toCardInstance(ownership({ artwork: null, isRetired: true }));
    expect(card.artwork).toBe(CARD_ARTWORK_PLACEHOLDER);
  });
});
