jest.mock("~/server/db", () => ({ __esModule: true, db: {}, isDatabaseReadOnly: false }));

import { wikiUrlOf } from "~/server/modules/identity/identity.vault";

type CardRow = Parameters<typeof wikiUrlOf>[0];
const card = (wikiArticleTitle: string | null, wikiSource: string | null) =>
  ({ wikiArticleTitle, wikiSource }) as CardRow;

describe("passport vault card wikiUrl", () => {
  it("is an in-app WikiOS path for an IxWiki article, with no ixwiki.com host", () => {
    const url = wikiUrlOf(card("Ostrozava City", "ixwiki"));
    expect(url).toBe("/wiki/Ostrozava_City");
  });

  it("treats a card with no source as IxWiki", () => {
    expect(wikiUrlOf(card("Velarc", null))).toBe("/wiki/Velarc");
  });

  it("opens an IIWiki article in the WikiOS reader, with no iiwiki.com host", () => {
    expect(wikiUrlOf(card("Some Page", "iiwiki"))).toBe("/wiki/Some_Page?source=iiwiki");
  });

  it("opens an AltHistory article in the WikiOS reader", () => {
    expect(wikiUrlOf(card("Some Page", "althistory"))).toBe("/wiki/Some_Page?source=althistory");
  });

  it("opens a Commons file on Commons, not as an IxWiki page", () => {
    expect(wikiUrlOf(card("File:Flag of Ireland.svg", "commons"))).toBe(
      "https://commons.wikimedia.org/wiki/File:Flag_of_Ireland.svg"
    );
  });

  it("has no link without an article title", () => {
    expect(wikiUrlOf(card(null, "ixwiki"))).toBeNull();
  });
});
