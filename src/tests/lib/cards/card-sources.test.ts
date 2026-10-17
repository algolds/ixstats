/** @jest-environment node */
/** The one card source list (cards refresh spec §2.4): IxWiki, the sister reader wikis and Wikimedia Commons. */
import {
  CARD_ARTICLE_SOURCES,
  CARD_WIKI_SOURCES,
  canonicalCardTitle,
  cardArticleSourceSchema,
  cardSourceLabel,
  cardWikiSourceSchema,
  commonsCardPageUrl,
  commonsPageUrl,
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
    expect(parseCardWikiSource("commons")).toBe("commons");
    expect(parseCardWikiSource("stash")).toBeNull();
  });

  it("parses a stored article source, never reading Commons or nothing as IxWiki", () => {
    expect(parseCardArticleSource("iiwiki")).toBe("iiwiki");
    expect(parseCardArticleSource("althistory")).toBe("althistory");
    expect(parseCardArticleSource("commons")).toBeNull();
    expect(parseCardArticleSource(null)).toBeNull();
    expect(parseCardArticleSource(undefined)).toBeNull();
  });

  it("names each source", () => {
    expect(CARD_WIKI_SOURCES.map(cardSourceLabel)).toEqual([
      "IxWiki",
      "IIWiki",
      "AltHistory Wiki",
      "Wikimedia Commons",
    ]);
  });

  it("addresses a Commons file on Commons itself", () => {
    expect(commonsPageUrl("File:Flag of Ireland.svg")).toBe(
      "https://commons.wikimedia.org/wiki/File:Flag_of_Ireland.svg"
    );
    expect(commonsPageUrl("File:A&B?.png")).toBe(
      "https://commons.wikimedia.org/wiki/File:A%26B%3F.png"
    );
  });

  it("canonicalises titles as the natural key does, and refuses ones MediaWiki would", () => {
    expect(canonicalCardTitle("ixwiki", "  Caphiria ")).toBe("Caphiria");
    expect(canonicalCardTitle("iiwiki", "United_States_of_Elm")).toBe("United States of Elm");
    expect(canonicalCardTitle("iiwiki", "United_States_of_Elm")).toBe(
      canonicalArticleTitle("United_States_of_Elm", "iiwiki")
    );
    expect(canonicalCardTitle("althistory", "a|b")).toBeNull();
  });

  it("keeps an AltHistory title's timeline whole: it is part of the page's name", () => {
    expect(canonicalCardTitle("althistory", "Aramelia_(Roman_Survival)")).toBe(
      "Aramelia (Roman Survival)"
    );
  });

  it("names a Commons file as Commons does: always File:, the name's first letter capitalised", () => {
    expect(canonicalCardTitle("commons", "flag_of_Ireland.svg")).toBe("File:Flag of Ireland.svg");
    expect(canonicalCardTitle("commons", "file : flag of Ireland.svg")).toBe(
      "File:Flag of Ireland.svg"
    );
    expect(canonicalCardTitle("commons", "Image:map.png")).toBe("File:Map.png");
    expect(canonicalCardTitle("commons", "File:Flag of Ireland.svg")).toBe(
      "File:Flag of Ireland.svg"
    );
    expect(canonicalCardTitle("commons", "File:")).toBeNull();
    expect(canonicalCardTitle("commons", "File:a|b.svg")).toBeNull();
  });
});

describe("commonsCardPageUrl", () => {
  const page = "https://commons.wikimedia.org/wiki/File:Flag_of_Ireland.svg";
  const upload = "https://upload.wikimedia.org/wikipedia/commons/4/45/Flag_of_Ireland.svg";

  it("addresses a Commons card's file by its title", () => {
    expect(commonsCardPageUrl({ wikiArticleTitle: "File:Flag of Ireland.svg", artwork: "x" })).toBe(
      page
    );
  });

  it("finds a legacy card's file, stored with no title, from its description URL, else its art", () => {
    expect(commonsCardPageUrl({ wikiArticleTitle: null, descriptionUrl: upload })).toBe(page);
    expect(
      commonsCardPageUrl({
        wikiArticleTitle: null,
        descriptionUrl: "https://commons.wikimedia.org/wiki/File%3AFlag%20of%20Ireland.svg",
      })
    ).toBe(page);
    expect(
      commonsCardPageUrl({ wikiArticleTitle: null, descriptionUrl: null, artwork: upload })
    ).toBe(page);
  });

  it("has no page when neither names a Commons file", () => {
    expect(
      commonsCardPageUrl({
        wikiArticleTitle: null,
        descriptionUrl: "javascript:alert(1)",
        artwork: "https://evil.example/Flag.svg",
      })
    ).toBeNull();
  });
});
