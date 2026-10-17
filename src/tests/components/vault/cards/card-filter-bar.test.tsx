import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import {
  CardFilterBar,
  type FilterDimension,
  type RegionSearchOptions,
} from "~/components/vault/cards/CardFilterBar";
import { EMPTY_CARD_FILTERS, type CardFilters } from "~/lib/cards/face/filters";
import { EXPLORE_SORT_OPTIONS, type ExploreSort } from "~/lib/cards/face/explore-options";
import type { CardRealmBadge } from "~/lib/cards/face/types";
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
  it("keeps a chosen realm by its name once it is no longer offered", () => {
    const old = { id: "r9", slug: "old", name: "Old Ixnay", crestUrl: null, isSystem: false };
    const { onChange, rerender } = setUp({
      realmList: [...realms, old],
      filters: { realmId: "r9" },
    });
    rerender({ realmList: realms });
    openFilters("Filters, 1 on");
    expect(screen.getByRole("combobox", { name: "Realm" })).toHaveTextContent("Old Ixnay");
    fireEvent.click(screen.getByRole("combobox", { name: "Realm" }));
    fireEvent.click(screen.getByRole("option", { name: "Every realm" }));
    expect(lastChange(onChange).realmId).toBeNull();
  });

  it("keeps a chosen realm it never saw, under a plain name, when no realm is offered", () => {
    setUp({ withRealms: false, filters: { realmId: "r9" } });
    openFilters("Filters, 1 on");
    expect(screen.getByRole("combobox", { name: "Realm" })).toHaveTextContent("Unlisted realm");
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

    it("keeps its input when a search matches nothing", () => {
      const regionSearch = search();
      const { rerender } = setUp({ regionSearch, regions: ["The Pacific"] });
      openFilters();
      fireEvent.change(regionBox(), { target: { value: "zzz" } });
      rerender({ regionSearch: { ...regionSearch, term: "zzz" }, regions: [] });
      expect(regionBox()).toHaveValue("zzz");
      expect(screen.getByText("No regions match.")).toBeInTheDocument();
    });

    it("shows the caller's term, so a reopened search still agrees with its matches", () => {
      setUp({ regionSearch: search(true, "laz"), regions: ["Lazarus"] });
      openFilters();
      expect(regionBox()).toHaveValue("laz");
      expect(screen.getByRole("option", { name: "Lazarus" })).toBeInTheDocument();
    });

    it("says a caller's term matched nothing as soon as it opens", () => {
      setUp({ regionSearch: search(true, "zzz"), regions: [] });
      openFilters();
      expect(regionBox()).toHaveValue("zzz");
      expect(screen.getByText("No regions match.")).toBeInTheDocument();
    });

    it("holds no term of its own: the box shows what the caller passes back", () => {
      const regionSearch = search();
      setUp({ regionSearch, regions: ["Lazarus"] });
      openFilters();
      fireEvent.change(regionBox(), { target: { value: "laz" } });
      expect(regionSearch.onSearch).toHaveBeenLastCalledWith("laz");
      expect(regionBox()).toHaveValue("");
      expect(screen.queryByText("No regions match.")).not.toBeInTheDocument();
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

    it("marks any region when none is on, and says nothing about matches before a search", () => {
      setUp({ regionSearch: search(), regions: [] });
      openFilters();
      expect(screen.getByRole("option", { name: "Any region" })).toHaveAttribute(
        "aria-current",
        "true"
      );
      expect(screen.queryByText("No regions match.")).not.toBeInTheDocument();
    });

    it("hides the region filter where regions do not apply, unless one is on", () => {
      const { rerender } = setUp({ regionSearch: search(false), regions: ["The Pacific"] });
      openFilters();
      expect(
        screen.queryByRole("combobox", { name: "NationStates region" })
      ).not.toBeInTheDocument();
      rerender({ regionSearch: search(false), filters: { region: "Balder" } });
      expect(regionBox()).toBeInTheDocument();
    });
  });
});
