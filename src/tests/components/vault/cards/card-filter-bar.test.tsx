import "react";
import { fireEvent, render, screen } from "@testing-library/react";
import {
  CardFilterBar,
  type FilterDimension,
  type RegionSearchOptions,
} from "~/components/vault/cards/CardFilterBar";
import { EMPTY_CARD_FILTERS, type CardFilters } from "~/lib/cards/face/filters";
import { EXPLORE_SORT_OPTIONS, type ExploreSort } from "~/lib/cards/face/explore-options";
import type { CardRealmBadge, CardType } from "~/lib/cards/face/types";
import { stubResizeObserver } from "~/tests/helpers/resize-observer";

beforeAll(() => {
  // The region search is a cmdk list, which measures itself and scrolls its active option into view.
  stubResizeObserver();
  Element.prototype.scrollIntoView ??= () => undefined;
});

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
    realmList?: readonly CardRealmBadge[];
    regionSearch?: RegionSearchOptions;
    types?: readonly CardType[];
  } = {}
) {
  const onChange = jest.fn<void, [CardFilters]>();
  const onSortChange = jest.fn<void, [ExploreSort]>();
  const filters = { ...EMPTY_CARD_FILTERS, ...options.filters };
  const bar = (next: typeof options) => (
    <CardFilterBar
      filters={{ ...EMPTY_CARD_FILTERS, ...next.filters }}
      onChange={onChange}
      dimensions={
        next.dimensions ?? [
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
      types={next.types}
      realms={next.realmList ?? (next.withRealms === false ? [] : realms)}
      regions={next.regions}
      regionSearch={next.regionSearch}
      sort="newest"
      sortOptions={EXPLORE_SORT_OPTIONS}
      onSortChange={onSortChange}
      trailing={<button type="button">Trailing</button>}
    />
  );
  const view = render(bar(options));
  const rerender = (next: typeof options) => view.rerender(bar({ ...options, ...next }));
  return { onChange, onSortChange, filters, rerender };
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
  it("clears every filter but keeps the search", () => {
    const { onChange } = setUp({
      filters: { search: "lion", rarities: ["RARE"], duplicates: true },
    });
    openFilters("Filters, 2 on");
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(lastChange(onChange)).toEqual({ ...EMPTY_CARD_FILTERS, search: "lion" });
  });
  describe("with a region search", () => {
    const search = (available = true, term = "") => ({
      available,
      term,
      onSearch: jest.fn<void, [string]>(),
    });
    const regionBox = () => screen.getByRole("combobox", { name: "NationStates region" });

    it("searches the regions as the player types, and picks one", () => {
      const regionSearch = search();
      const { onChange } = setUp({ regionSearch, regions: ["The Pacific", "Lazarus"] });
      openFilters();
      fireEvent.change(regionBox(), { target: { value: "laz" } });
      expect(regionSearch.onSearch).toHaveBeenLastCalledWith("laz");
      expect(screen.queryByText("No regions match.")).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole("option", { name: "Lazarus" }));
      expect(lastChange(onChange).region).toBe("Lazarus");
    });
    it("marks the region that is on, keeps it listed, and turns it off", () => {
      const { onChange } = setUp({
        regionSearch: search(),
        regions: ["The Pacific"],
        filters: { region: "Balder" },
      });
      openFilters("Filters, 1 on");
      expect(screen.getByRole("option", { name: "Balder" })).toHaveAttribute(
        "aria-current",
        "true"
      );
      expect(screen.getByRole("option", { name: "The Pacific" })).not.toHaveAttribute(
        "aria-current"
      );
      fireEvent.click(screen.getByRole("option", { name: "Any region" }));
      expect(lastChange(onChange).region).toBeNull();
    });
  });
});
