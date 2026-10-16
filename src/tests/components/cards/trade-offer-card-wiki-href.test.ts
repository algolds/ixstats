jest.mock("@clerk/nextjs", () => ({ useAuth: () => ({ userId: "u1" }) }));
jest.mock("~/trpc/react", () => ({ api: {} }));

import { toCardInstance } from "~/components/cards/trading/TradeOfferModal";
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
