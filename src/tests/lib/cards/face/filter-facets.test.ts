/** @jest-environment node */
/** The hub's filters list only the types and categories that have cards (card categories design, decision 4). */
import { filterFacets, listedCategories, listedTypes } from "~/lib/cards/face/filter-facets";

describe("filterFacets", () => {
  it("lists only the types and categories that have cards, in the enums' order", () => {
    expect(
      filterFacets([
        { cardType: "SPECIAL", category: "SPECIAL" },
        { cardType: "NS", category: null },
        { cardType: "LORE", category: "HISTORY" },
        { cardType: "LORE", category: "MILITARY" },
        { cardType: "LORE", category: "HISTORY" },
      ])
    ).toEqual({ types: ["LORE", "NS", "SPECIAL"], categories: ["MILITARY", "HISTORY", "SPECIAL"] });
  });

  it("offers Uncategorised for a lore card with no category, never for an NS card", () => {
    expect(filterFacets([{ cardType: "NS", category: null }]).categories).toEqual([]);
    expect(filterFacets([{ cardType: "LORE", category: null }]).categories).toEqual([
      "UNCATEGORISED",
    ]);
  });

  it("lists nothing when there are no cards, so Nation never shows before a Nation card exists", () => {
    expect(filterFacets([])).toEqual({ types: [], categories: [] });
  });
});

describe("options a player picked", () => {
  it("stay listed after they drop out, so they can be turned off", () => {
    expect(listedTypes(["LORE"], ["NATION"])).toEqual(["LORE", "NATION"]);
    expect(listedTypes(["LORE", "NS"], ["NS"])).toEqual(["LORE", "NS"]);
    expect(listedCategories(["HISTORY"], "UNCATEGORISED")).toEqual(["HISTORY", "UNCATEGORISED"]);
    expect(listedCategories(["HISTORY"], "HISTORY")).toEqual(["HISTORY"]);
    expect(listedCategories(["HISTORY"], null)).toEqual(["HISTORY"]);
  });
});
