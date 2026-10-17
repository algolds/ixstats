import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { CardFilterBar, type FilterDimension } from "~/components/vault/cards/CardFilterBar";
import { EMPTY_CARD_FILTERS, type CardFilters } from "~/lib/cards/face/filters";
import { EXPLORE_SORT_OPTIONS, type ExploreSort } from "~/lib/cards/face/explore-options";

const realms = [
  { id: "default", slug: "ixnay", name: "Ixnay", crestUrl: null, isSystem: false },
  {
    id: "nationstates",
    slug: "nationstates",
    name: "NationStates",
    crestUrl: null,
    isSystem: true,
  },
];

function setUp(
  options: {
    filters?: Partial<CardFilters>;
    dimensions?: readonly FilterDimension[];
    regions?: readonly string[];
    withRealms?: boolean;
  } = {}
) {
  const onChange = jest.fn<void, [CardFilters]>();
  const onSortChange = jest.fn<void, [ExploreSort]>();
  const filters = { ...EMPTY_CARD_FILTERS, ...options.filters };
  render(
    <CardFilterBar
      filters={filters}
      onChange={onChange}
      dimensions={
        options.dimensions ?? [
          "owned",
          "realm",
          "rarity",
          "finish",
          "type",
          "category",
          "duplicates",
          "region",
        ]
      }
      realms={options.withRealms === false ? [] : realms}
      regions={options.regions}
      sort="newest"
      sortOptions={EXPLORE_SORT_OPTIONS}
      onSortChange={onSortChange}
      trailing={<button type="button">Trailing</button>}
    />
  );
  return { onChange, onSortChange, filters };
}

const openFilters = (name = "Filters") => fireEvent.click(screen.getByRole("button", { name }));
const lastChange = (onChange: jest.Mock<void, [CardFilters]>) => onChange.mock.calls.at(-1)![0];

describe("CardFilterBar", () => {
  it("searches, sorts and shows the tab's own controls", () => {
    const { onChange, onSortChange } = setUp();
    fireEvent.change(screen.getByRole("searchbox", { name: "Search cards" }), {
      target: { value: "lion" },
    });
    expect(lastChange(onChange)).toEqual({ ...EMPTY_CARD_FILTERS, search: "lion" });
    expect(screen.getByRole("searchbox", { name: "Search cards" })).toHaveAttribute(
      "maxlength",
      "100"
    );
    fireEvent.click(screen.getByRole("combobox", { name: "Sort" }));
    fireEvent.click(screen.getByRole("option", { name: "Most wanted" }));
    expect(onSortChange).toHaveBeenCalledWith("wanted");
    expect(screen.getByRole("button", { name: "Trailing" })).toBeInTheDocument();
  });

  it("shows only the filters the tab asks for", () => {
    setUp({ dimensions: ["rarity", "duplicates"], regions: ["Lazarus"] });
    openFilters();
    expect(screen.getByRole("toolbar", { name: "Rarity" })).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Duplicates only" })).toBeInTheDocument();
    expect(screen.queryByRole("toolbar", { name: "Finish" })).not.toBeInTheDocument();
    expect(screen.queryByRole("toolbar", { name: "Type" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("radiogroup", { name: "Collected or missing" })
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Realm" })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Category" })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "NationStates region" })).not.toBeInTheDocument();
  });

  it("leaves out the rarity and duplicates filters when the tab does not ask for them", () => {
    setUp({ dimensions: ["owned"] });
    openFilters();
    expect(screen.getByRole("radiogroup", { name: "Collected or missing" })).toBeInTheDocument();
    expect(screen.queryByRole("toolbar", { name: "Rarity" })).not.toBeInTheDocument();
    expect(screen.queryByRole("switch", { name: "Duplicates only" })).not.toBeInTheDocument();
  });

  it("toggles rarities, finishes and types in their own order", () => {
    const { onChange } = setUp({ filters: { rarities: ["LEGENDARY"] } });
    openFilters("Filters, 1 on");
    fireEvent.click(screen.getByRole("button", { name: "Common" }));
    expect(lastChange(onChange).rarities).toEqual(["COMMON", "LEGENDARY"]);
    fireEvent.click(screen.getByRole("button", { name: "Legendary" }));
    expect(lastChange(onChange).rarities).toEqual([]);
    fireEvent.click(screen.getByRole("button", { name: "Holo" }));
    expect(lastChange(onChange).finishes).toEqual(["HOLO"]);
    fireEvent.click(screen.getByRole("button", { name: "NationStates" }));
    expect(lastChange(onChange).types).toEqual(["NS"]);
  });

  it("switches between collected and missing cards", () => {
    const { onChange } = setUp();
    openFilters();
    const group = screen.getByRole("radiogroup", { name: "Collected or missing" });
    expect(group).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "Missing" }));
    expect(lastChange(onChange).owned).toBe("missing");
  });

  it("picks a realm, and every realm again", () => {
    const { onChange } = setUp({ filters: { realmId: "default" } });
    openFilters("Filters, 1 on");
    fireEvent.click(screen.getByRole("combobox", { name: "Realm" }));
    fireEvent.click(screen.getByRole("option", { name: "NationStates" }));
    expect(lastChange(onChange).realmId).toBe("nationstates");
    fireEvent.click(screen.getByRole("combobox", { name: "Realm" }));
    fireEvent.click(screen.getByRole("option", { name: "Every realm" }));
    expect(lastChange(onChange).realmId).toBeNull();
  });

  it("hides the realm filter when there are no realms to pick", () => {
    setUp({ withRealms: false });
    openFilters();
    expect(screen.queryByRole("combobox", { name: "Realm" })).not.toBeInTheDocument();
  });

  it("picks a lore category by its label, and any category again", () => {
    const { onChange } = setUp({ filters: { category: "HISTORY" } });
    openFilters("Filters, 1 on");
    fireEvent.click(screen.getByRole("combobox", { name: "Category" }));
    fireEvent.click(screen.getByRole("option", { name: "Geography" }));
    expect(lastChange(onChange).category).toBe("GEOGRAPHY");
    fireEvent.click(screen.getByRole("combobox", { name: "Category" }));
    fireEvent.click(screen.getByRole("option", { name: "Any category" }));
    expect(lastChange(onChange).category).toBeNull();
  });

  it("picks a NationStates region when there are regions to pick", () => {
    const { onChange } = setUp({ regions: ["The Pacific", "Lazarus"] });
    openFilters();
    fireEvent.click(screen.getByRole("combobox", { name: "NationStates region" }));
    fireEvent.click(screen.getByRole("option", { name: "Lazarus" }));
    expect(lastChange(onChange).region).toBe("Lazarus");
  });

  it("hides the region filter with no regions to pick", () => {
    setUp({ regions: [] });
    openFilters();
    expect(screen.queryByRole("combobox", { name: "NationStates region" })).not.toBeInTheDocument();
  });

  it("keeps the region filter while a region is on, though there are none to pick now", () => {
    setUp({ filters: { region: "Balder" }, regions: [] });
    openFilters("Filters, 1 on");
    expect(screen.getByRole("combobox", { name: "NationStates region" })).toHaveTextContent(
      "Balder"
    );
  });

  it("keeps a region that is on in the list, so it can be turned off", () => {
    const { onChange } = setUp({ filters: { region: "Balder" }, regions: ["The Pacific"] });
    openFilters("Filters, 1 on");
    expect(screen.getByRole("combobox", { name: "NationStates region" })).toHaveTextContent(
      "Balder"
    );
    fireEvent.click(screen.getByRole("combobox", { name: "NationStates region" }));
    expect(screen.getByRole("option", { name: "Balder" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("option", { name: "Any region" }));
    expect(lastChange(onChange).region).toBeNull();
  });

  it("turns duplicates on", () => {
    const { onChange } = setUp();
    openFilters();
    fireEvent.click(screen.getByRole("switch", { name: "Duplicates only" }));
    expect(lastChange(onChange).duplicates).toBe(true);
  });

  it("clears every filter but keeps the search", () => {
    const { onChange } = setUp({
      filters: { search: "lion", rarities: ["RARE"], duplicates: true },
    });
    openFilters("Filters, 2 on");
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(lastChange(onChange)).toEqual({ ...EMPTY_CARD_FILTERS, search: "lion" });
  });

  it("has nothing to clear when no filter is on", () => {
    setUp({ filters: { search: "lion" } });
    openFilters();
    expect(screen.getByRole("button", { name: "Clear filters" })).toBeDisabled();
  });
});
