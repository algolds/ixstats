jest.mock("@clerk/nextjs", () => ({ useAuth: () => ({ userId: "u1" }) }));
jest.mock("~/trpc/react", () => ({ api: {} }));

import { toCardInstance } from "~/components/cards/trading/TradeOfferModal";

const ownership = (cards: Record<string, unknown>) => ({
  id: "o1",
  level: 1,
  cards: { id: "c1", title: "Velarc", ...cards },
});

describe("TradeOfferModal card mapping: wiki link", () => {
  it("routes a stored absolute ixwiki.com URL to the WikiOS path", () => {
    const card = toCardInstance(
      ownership({
        wikiSource: "ixwiki",
        wikiArticleTitle: "Velarc",
        wikiUrl: "https://ixwiki.com/wiki/Velarc",
      })
    );
    expect(card.wikiUrl).toBe("/wiki/Velarc");
  });

  it("opens an IIWiki card in the reader, not on iiwiki.com", () => {
    const card = toCardInstance(
      ownership({
        wikiSource: "iiwiki",
        wikiArticleTitle: "Some Page",
        wikiUrl: "https://iiwiki.com/w/Some_Page",
      })
    );
    expect(card.wikiUrl).toBe("/wiki/Some_Page?source=iiwiki");
  });

  it("has no link for a card with no article", () => {
    expect(toCardInstance(ownership({})).wikiUrl).toBeNull();
  });
});
