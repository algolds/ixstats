/** @jest-environment node */
/** The one card source list (cards refresh spec §2.4): IxWiki, the sister reader wikis and Wikimedia Commons. */
import {
  CARD_ARTICLE_SOURCES,
  CARD_WIKI_SOURCES,
  canonicalCardTitle,
  cardArticleSourceSchema,
  cardSourceLabel,
  cardWikiSourceSchema,
  parseCardArticleSource,
  parseCardWikiSource,
} from "~/lib/cards/card-sources";
import { canonicalArticleTitle } from "~/lib/cards/legacy-mapping";

describe("card sources", () => {
  it("lists IxWiki, the sister reader wikis and Commons", () => {
    expect(CARD_ARTICLE_SOURCES).toEqual(["ixwiki", "iiwiki", "althistory"]);
    expect(CARD_WIKI_SOURCES).toEqual(["ixwiki", "iiwiki", "althistory", "commons"]);
  });

  it("accepts AltHistory everywhere and Commons only where files are allowed", () => {
    expect(cardArticleSourceSchema.safeParse("althistory").success).toBe(true);
    expect(cardArticleSourceSchema.safeParse("commons").success).toBe(false);
    expect(cardWikiSourceSchema.safeParse("commons").success).toBe(true);
    expect(cardWikiSourceSchema.safeParse("wikipedia").success).toBe(false);
  });

  it("parses stored values and answers null for anything else", () => {
    expect(parseCardArticleSource("iiwiki")).toBe("iiwiki");
    expect(parseCardArticleSource("commons")).toBeNull();
    expect(parseCardArticleSource(null)).toBeNull();
    expect(parseCardWikiSource("commons")).toBe("commons");
    expect(parseCardWikiSource("stash")).toBeNull();
  });

  it("names each source", () => {
    expect(CARD_WIKI_SOURCES.map(cardSourceLabel)).toEqual([
      "IxWiki",
      "IIWiki",
      "AltHistory Wiki",
      "Wikimedia Commons",
    ]);
  });

  it("canonicalises titles as the natural key does, and refuses ones MediaWiki would", () => {
    expect(canonicalCardTitle("ixwiki", "  Caphiria ")).toBe("Caphiria");
    expect(canonicalCardTitle("iiwiki", "United_States_of_Elm")).toBe("United States of Elm");
    expect(canonicalCardTitle("iiwiki", "United_States_of_Elm")).toBe(
      canonicalArticleTitle("United_States_of_Elm", "iiwiki")
    );
    expect(canonicalCardTitle("althistory", "a|b")).toBeNull();
  });
});
