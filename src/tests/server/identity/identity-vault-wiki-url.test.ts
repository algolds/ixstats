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

  it("opens a legacy Commons card's file, stored with no title, on Commons", () => {
    const upload = "https://upload.wikimedia.org/wikipedia/commons/4/45/Flag_of_Ireland.svg";
    const legacy = (metadata: object | null, artwork: string | null) =>
      ({ wikiArticleTitle: null, wikiSource: "commons", metadata, artwork }) as CardRow;
    const page = "https://commons.wikimedia.org/wiki/File:Flag_of_Ireland.svg";
    expect(wikiUrlOf(legacy({ descriptionUrl: upload }, null))).toBe(page);
    expect(wikiUrlOf(legacy(null, upload))).toBe(page);
    expect(wikiUrlOf(legacy({ descriptionUrl: 3 }, "https://example.com/x.png"))).toBeNull();
  });

  it("has no link without an article title", () => {
    expect(wikiUrlOf(card(null, "ixwiki"))).toBeNull();
  });
});
