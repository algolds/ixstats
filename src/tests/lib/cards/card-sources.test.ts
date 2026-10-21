/** @jest-environment node */
/** The one card source list (cards refresh spec §2.4): IxWiki, the sister reader wikis and Wikimedia Commons. */
import { canonicalCardTitle } from "~/lib/cards/card-sources";
import { canonicalArticleTitle } from "~/lib/cards/legacy-mapping";

describe("card sources", () => {
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
