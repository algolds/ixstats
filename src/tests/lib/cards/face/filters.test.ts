/** @jest-environment node */
import {
  activeFilterCount,
  EMPTY_CARD_FILTERS,
  exploreFilterInput,
  mineFilterInput,
  type CardFilters,
} from "~/lib/cards/face/filters";

const on = (overrides: Partial<CardFilters>): CardFilters => ({
  ...EMPTY_CARD_FILTERS,
  ...overrides,
});

describe("card filters", () => {
  it("counts the filters that are on, not the search", () => {
    expect(activeFilterCount(EMPTY_CARD_FILTERS)).toBe(0);
    expect(
      activeFilterCount(on({ search: "x", rarities: ["RARE", "EPIC"], duplicates: true }))
    ).toBe(2);
  });

  it.each<[string, Partial<CardFilters>]>([
    ["realm", { realmId: "r1" }],
    ["rarity", { rarities: ["RARE"] }],
    ["finish", { finishes: ["FOIL"] }],
    ["type", { types: ["NS"] }],
    ["category", { category: "HISTORY" }],
    ["duplicates", { duplicates: true }],
    ["collected", { owned: "owned" }],
    ["region", { region: "The Pacific" }],
  ])("counts the %s filter as one", (_name, overrides) => {
    expect(activeFilterCount(on(overrides))).toBe(1);
  });

  it("counts every filter at once", () => {
    expect(
      activeFilterCount(
        on({
          realmId: "r1",
          rarities: ["RARE"],
          finishes: ["FOIL"],
          types: ["LORE"],
          category: "HISTORY",
          duplicates: true,
          owned: "missing",
          region: "The Pacific",
        })
      )
    ).toBe(8);
  });

  it("leaves empty filters out of the Mine query", () => {
    expect(mineFilterInput(EMPTY_CARD_FILTERS)).toEqual({});
    expect(mineFilterInput(on({ search: "   " }))).toEqual({});
    expect(
      mineFilterInput(
        on({
          search: "  caph ",
          realmId: "r1",
          finishes: ["FOIL"],
          category: "HISTORY",
          duplicates: true,
        })
      )
    ).toEqual({
      search: "caph",
      realmId: "r1",
      finishes: ["FOIL"],
      categories: ["HISTORY"],
      duplicates: true,
    });
  });

  it("puts rarities and types in the Mine query, and never Explore's collected switch or region", () => {
    expect(
      mineFilterInput(
        on({ rarities: ["EPIC"], types: ["LORE", "NS"], owned: "missing", region: "The Pacific" })
      )
    ).toEqual({ rarities: ["EPIC"], types: ["LORE", "NS"] });
  });

  it("carries the collected switch and the region into the Explore query", () => {
    expect(
      exploreFilterInput(on({ owned: "missing", region: "The Pacific", types: ["NS"] }))
    ).toEqual({
      owned: "missing",
      region: "The Pacific",
      types: ["NS"],
    });
  });

  it("leaves Mine's finish and duplicates filters and empty filters out of the Explore query", () => {
    expect(exploreFilterInput(EMPTY_CARD_FILTERS)).toEqual({});
    expect(
      exploreFilterInput(
        on({
          search: " lion ",
          realmId: "r2",
          rarities: ["RARE"],
          category: "PEOPLE",
          finishes: ["HOLO"],
          duplicates: true,
        })
      )
    ).toEqual({ search: "lion", realmId: "r2", rarities: ["RARE"], categories: ["PEOPLE"] });
  });
});
