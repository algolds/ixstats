import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { keepPreviousData } from "@tanstack/react-query";

jest.mock("~/trpc/react", () => ({
  api: {
    cards: {
      exploreShelves: { useQuery: jest.fn() },
      exploreGrid: { useInfiniteQuery: jest.fn() },
      exploreRegions: { useQuery: jest.fn() },
    },
  },
}));
jest.mock("~/hooks/useDebounce", () => ({ useDebounce: <T,>(value: T) => value }));
jest.mock("~/components/cards/suggest/CardSuggestionForm", () => ({
  CardSuggestionForm: () => <p>The suggestion form</p>,
}));
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({
    href,
    children,
    ...rest
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { api } from "~/trpc/react";
import { ExplorePane } from "~/components/vault/cards/ExplorePane";
import type { CardFaceData } from "~/lib/cards/face/types";
import type { ExplorePage, RealmShelf } from "~/lib/cards/hub/explore";
import { stubResizeObserver } from "~/tests/helpers/resize-observer";

beforeAll(() => {
  // The region search is a cmdk list, which measures itself and scrolls its active option into view.
  stubResizeObserver();
  Element.prototype.scrollIntoView ??= () => undefined;
});

const realm = (id: string, name: string, slug = id) => ({
  id,
  slug,
  name,
  crestUrl: null,
  isSystem: slug === "nationstates",
});
const face = (id: string, silhouette: boolean): CardFaceData => ({
  cardId: id,
  title: `Card ${id}`,
  rarity: "RARE",
  cardType: "LORE",
  realm: realm("default", "Ixnay", "ixnay"),
  artwork: silhouette ? null : `https://art/${id}.png`,
  silhouette,
  number: 4,
  season: null,
  isRetired: false,
  copy: null,
});
const ixnayShelf = (more: Partial<RealmShelf> = {}): RealmShelf => ({
  realm: realm("default", "Ixnay", "ixnay"),
  bannerUrl: null,
  cardCount: 40,
  newest: [{ face: face("n1", true), wanted: 0 }],
  mostWanted: [{ face: face("w1", true), wanted: 3 }],
  ...more,
});
const shelves: RealmShelf[] = [
  ixnayShelf(),
  {
    realm: realm("ns", "NationStates", "nationstates"),
    bannerUrl: null,
    cardCount: 1,
    newest: [],
    mostWanted: [],
  },
];

interface GridState {
  isLoading: boolean;
  isError: boolean;
  isFetching: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  isFetchNextPageError: boolean;
}
const gridPages = (loaded: CardFaceData[][], more: Partial<GridState> = {}) => ({
  data: {
    pages: loaded.map((faces): ExplorePage => ({ faces, total: faces.length, nextCursor: null })),
  },
  isLoading: false,
  isError: false,
  isFetching: false,
  hasNextPage: false,
  fetchNextPage: jest.fn(),
  isFetchingNextPage: false,
  isFetchNextPageError: false,
  refetch: jest.fn(),
  ...more,
});

const shelvesQuery = () => jest.mocked(api.cards.exploreShelves.useQuery);
const grid = () => jest.mocked(api.cards.exploreGrid.useInfiniteQuery);
const regions = () => jest.mocked(api.cards.exploreRegions.useQuery);
const lastGridInput = () => grid().mock.calls.at(-1)![0];

function setShelves(state: { data?: RealmShelf[]; isLoading?: boolean; isError?: boolean }) {
  const refetch = jest.fn();
  shelvesQuery().mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: false,
    refetch,
    ...state,
  } as never);
  return refetch;
}

function setGrid(state: ReturnType<typeof gridPages>) {
  grid().mockReturnValue(state as never);
  return state;
}

interface PaneProps {
  onOpenCard?: (cardId: string) => void;
  initialRealmSlug?: string | null;
  suggesting?: boolean;
  onSuggestingChange?: (open: boolean) => void;
}
const pane = (props: PaneProps = {}) => (
  <ExplorePane
    onOpenCard={props.onOpenCard ?? jest.fn()}
    initialRealmSlug={props.initialRealmSlug ?? null}
    suggesting={props.suggesting ?? false}
    onSuggestingChange={props.onSuggestingChange ?? jest.fn()}
  />
);

beforeEach(() => {
  shelvesQuery().mockReset();
  grid().mockReset();
  regions().mockReset();
  setShelves({ data: shelves });
  setGrid(gridPages([[face("g1", true)]]));
  regions().mockReturnValue({ data: ["The Pacific"] } as never);
});

describe("ExplorePane", () => {
  it("shows realm shelves first, with silhouettes and the wanted totals", () => {
    render(pane());
    const headings = screen.getAllByRole("heading").map((h) => h.textContent);
    expect(headings.indexOf("Ixnay")).toBeLessThan(headings.indexOf("All cards"));
    expect(
      screen.getByRole("button", { name: "Card n1, Rare, Ixnay, not collected" })
    ).toBeInTheDocument();
    expect(screen.getByText("Wanted by 3")).toBeInTheDocument();
    // The newest strip says nothing of wishes; only the most-wanted strip counts them.
    expect(screen.getAllByText(/^Wanted by/)).toHaveLength(1);
    expect(screen.getByText("40 cards")).toBeInTheDocument();
    expect(screen.getByText("1 card")).toBeInTheDocument();
  });

  it("names each strip by its realm and its heading, and leaves out a strip with no cards", () => {
    render(pane());
    const ixnay = screen.getByRole("list", { name: "Newest in Ixnay" });
    expect(within(ixnay).getAllByRole("button")).toHaveLength(1);
    expect(screen.getByRole("list", { name: "Most wanted in Ixnay" })).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: /in NationStates$/ })).not.toBeInTheDocument();
  });

  it("opens a card's sheet from a shelf", () => {
    const onOpenCard = jest.fn();
    render(pane({ onOpenCard }));
    fireEvent.click(screen.getByRole("button", { name: "Card w1, Rare, Ixnay, not collected" }));
    expect(onOpenCard).toHaveBeenCalledWith("w1");
  });

  it("shows a realm's banner, and drops it when it does not load", () => {
    setShelves({ data: [ixnayShelf({ bannerUrl: "/images/banners/ixnay.png" })] });
    const { container } = render(pane());
    const banner = container.querySelector('img[src="/images/banners/ixnay.png"]');
    expect(banner).toHaveAttribute("alt", "");
    fireEvent.error(banner!);
    expect(container.querySelector('img[src="/images/banners/ixnay.png"]')).toBeNull();
  });

  it("filters the grid to a realm from its shelf, and takes the player there", () => {
    const scroll = jest.spyOn(Element.prototype, "scrollIntoView");
    render(pane());
    fireEvent.change(screen.getByRole("searchbox", { name: "Search cards" }), {
      target: { value: "oak" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Browse all NationStates cards" }));
    // Browsing a realm starts its filters afresh.
    expect(lastGridInput()).toEqual({ realmId: "ns", sort: "newest", limit: 48 });
    const heading = screen.getByRole("heading", { name: "All cards" });
    expect(heading).toHaveFocus();
    expect(scroll).toHaveBeenCalledWith({ block: "start" });
    expect(scroll.mock.contexts.at(-1)).toBe(heading.closest("section"));
    scroll.mockRestore();
  });

  it("asks for the grid with the filters, keeps the cards while a new page loads, and pages on", () => {
    render(pane());
    expect(lastGridInput()).toEqual({ sort: "newest", limit: 48 });
    const options = grid().mock.calls.at(-1)![1]!;
    expect(options.placeholderData).toBe(keepPreviousData);
    const next = options.getNextPageParam as (
      last: Pick<ExplorePage, "nextCursor">
    ) => number | undefined;
    expect(next({ nextCursor: 48 })).toBe(48);
    expect(next({ nextCursor: null })).toBeUndefined();

    fireEvent.change(screen.getByRole("searchbox", { name: "Search cards" }), {
      target: { value: "  oak " },
    });
    expect(lastGridInput()).toEqual({ search: "oak", sort: "newest", limit: 48 });
    fireEvent.click(screen.getByRole("combobox", { name: "Sort" }));
    fireEvent.click(screen.getByRole("option", { name: "Most wanted" }));
    expect(lastGridInput()).toMatchObject({ search: "oak", sort: "wanted" });
  });

  it("preselects the realm a link named, and offers NS regions", () => {
    render(pane({ initialRealmSlug: "nationstates" }));
    expect(lastGridInput()).toMatchObject({ realmId: "ns" });
    const [input, options] = regions().mock.calls.at(-1)!;
    expect(input).toEqual({ search: "" });
    expect(options).toMatchObject({ enabled: true, placeholderData: keepPreviousData });
  });

  it("finds Ixnay by its old slugs too, and ignores a slug no shelf has", () => {
    const { unmount } = render(pane({ initialRealmSlug: "ixworld" }));
    expect(lastGridInput()).toMatchObject({ realmId: "default" });
    unmount();
    render(pane({ initialRealmSlug: "somewhere" }));
    expect(lastGridInput()).not.toHaveProperty("realmId");
  });

  it("applies a linked realm once, then leaves the player's choice alone until the link changes", () => {
    const view = render(pane({ initialRealmSlug: "nationstates" }));
    fireEvent.click(screen.getByRole("button", { name: "Browse all Ixnay cards" }));
    view.rerender(pane({ initialRealmSlug: "nationstates" }));
    expect(lastGridInput()).toMatchObject({ realmId: "default" });
    view.rerender(pane({ initialRealmSlug: "ixnay" }));
    view.rerender(pane({ initialRealmSlug: "nationstates" }));
    expect(lastGridInput()).toMatchObject({ realmId: "ns" });
  });

  it("applies the same linked realm again once the address has dropped it", () => {
    const view = render(pane({ initialRealmSlug: "nationstates" }));
    fireEvent.click(screen.getByRole("button", { name: "Browse all Ixnay cards" }));
    view.rerender(pane({ initialRealmSlug: null }));
    expect(lastGridInput()).toMatchObject({ realmId: "default" });
    view.rerender(pane({ initialRealmSlug: "nationstates" }));
    expect(lastGridInput()).toMatchObject({ realmId: "ns" });
  });

  it("waits for the shelves before it applies a linked realm", () => {
    setShelves({ isLoading: true });
    const view = render(pane({ initialRealmSlug: "nationstates" }));
    expect(lastGridInput()).not.toHaveProperty("realmId");
    setShelves({ data: shelves });
    view.rerender(pane({ initialRealmSlug: "nationstates" }));
    expect(lastGridInput()).toMatchObject({ realmId: "ns" });
  });

  it("loads regions only while the NationStates realm is picked", () => {
    render(pane());
    expect(regions().mock.calls.at(-1)![1]).toMatchObject({ enabled: false });
    fireEvent.click(screen.getByRole("button", { name: "Browse all Ixnay cards" }));
    expect(regions().mock.calls.at(-1)![1]).toMatchObject({ enabled: false });
    fireEvent.click(screen.getByRole("button", { name: "Browse all NationStates cards" }));
    expect(regions().mock.calls.at(-1)![1]).toMatchObject({ enabled: true });
  });

  it("searches the regions as the player types, and filters the grid to the one picked", () => {
    render(pane({ initialRealmSlug: "nationstates" }));
    fireEvent.click(screen.getByRole("button", { name: "Filters, 1 on" }));
    const box = screen.getByRole("combobox", { name: "NationStates region" });
    fireEvent.change(box, { target: { value: " pac " } });
    expect(regions().mock.calls.at(-1)![0]).toEqual({ search: "pac" });
    fireEvent.click(screen.getByRole("option", { name: "The Pacific" }));
    expect(lastGridInput()).toMatchObject({ realmId: "ns", region: "The Pacific" });
  });

  it("keeps the region search and its matches when the filters close and reopen", () => {
    render(pane({ initialRealmSlug: "nationstates" }));
    const filtersButton = () => screen.getByRole("button", { name: "Filters, 1 on" });
    fireEvent.click(filtersButton());
    fireEvent.change(screen.getByRole("combobox", { name: "NationStates region" }), {
      target: { value: "pac" },
    });
    fireEvent.click(filtersButton());
    expect(screen.queryByRole("combobox", { name: "NationStates region" })).not.toBeInTheDocument();
    fireEvent.click(filtersButton());
    expect(screen.getByRole("combobox", { name: "NationStates region" })).toHaveValue("pac");
    expect(regions().mock.calls.at(-1)![0]).toEqual({ search: "pac" });
    expect(screen.getByRole("option", { name: "The Pacific" })).toBeInTheDocument();
  });

  /** Picks a NationStates region from the Filters popover, which is left open. */
  function pickNsRegion() {
    render(pane({ initialRealmSlug: "nationstates" }));
    fireEvent.click(screen.getByRole("button", { name: "Filters, 1 on" }));
    fireEvent.click(screen.getByRole("option", { name: "The Pacific" }));
    expect(lastGridInput()).toMatchObject({ realmId: "ns", region: "The Pacific" });
  }
  const pickRealm = (name: string) => {
    fireEvent.click(screen.getByRole("combobox", { name: "Realm" }));
    fireEvent.click(screen.getByRole("option", { name }));
  };

  it("drops the region when another realm is picked", () => {
    pickNsRegion();
    pickRealm("Ixnay");
    expect(lastGridInput()).toEqual({ realmId: "default", sort: "newest", limit: 48 });
  });

  it("drops the region when a new link picks another realm", () => {
    const view = render(pane({ initialRealmSlug: "nationstates" }));
    fireEvent.click(screen.getByRole("button", { name: "Filters, 1 on" }));
    fireEvent.click(screen.getByRole("option", { name: "The Pacific" }));
    view.rerender(pane({ initialRealmSlug: "ixnay" }));
    expect(lastGridInput()).toEqual({ realmId: "default", sort: "newest", limit: 48 });
  });

  it("keeps the region across every realm, where it still narrows NationStates cards", () => {
    pickNsRegion();
    pickRealm("Every realm");
    expect(lastGridInput()).toEqual({ region: "The Pacific", sort: "newest", limit: 48 });
  });

  it("hides the region filter outside the NationStates realm", () => {
    render(pane({ initialRealmSlug: "ixnay" }));
    fireEvent.click(screen.getByRole("button", { name: "Filters, 1 on" }));
    expect(screen.queryByRole("combobox", { name: "NationStates region" })).not.toBeInTheDocument();
  });

  it("opens a card's sheet from the grid", () => {
    const onOpenCard = jest.fn();
    render(pane({ onOpenCard }));
    fireEvent.click(screen.getByRole("button", { name: "Card g1, Rare, Ixnay, not collected" }));
    expect(onOpenCard).toHaveBeenCalledWith("g1");
  });

  it("lists each loaded card once, though pages overlap", () => {
    setGrid(gridPages([[face("g1", true), face("g2", false)], [face("g2", false)]]));
    render(pane());
    const cards = within(screen.getByRole("list", { name: "All cards" })).getAllByRole("button");
    expect(cards).toHaveLength(2);
  });

  it("loads more cards, and says when they did not load", () => {
    const more = setGrid(gridPages([[face("g1", true)]], { hasNextPage: true }));
    const view = render(pane());
    fireEvent.click(screen.getByRole("button", { name: "Show more" }));
    expect(more.fetchNextPage).toHaveBeenCalledTimes(1);

    const loading = setGrid(
      gridPages([[face("g1", true)]], { hasNextPage: true, isFetchingNextPage: true })
    );
    view.rerender(pane());
    expect(screen.getByRole("button", { name: "Show more" })).toBeDisabled();
    expect(loading.fetchNextPage).not.toHaveBeenCalled();

    const failed = setGrid(
      gridPages([[face("g1", true)]], { hasNextPage: true, isFetchNextPageError: true })
    );
    view.rerender(pane());
    expect(screen.getByText("More cards did not load.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(failed.fetchNextPage).toHaveBeenCalledTimes(1);
  });

  it("offers to clear a filter that matches nothing", () => {
    setGrid(gridPages([[]]));
    render(pane());
    fireEvent.click(screen.getByRole("button", { name: "Browse all NationStates cards" }));
    expect(screen.getByText("No cards match these filters")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(lastGridInput()).toEqual({ sort: "newest", limit: 48 });
  });

  it("offers to clear a search that matches nothing", () => {
    setGrid(gridPages([[]]));
    render(pane());
    fireEvent.change(screen.getByRole("searchbox", { name: "Search cards" }), {
      target: { value: "zzz" },
    });
    expect(screen.getByText("No cards match these filters")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(lastGridInput()).toEqual({ sort: "newest", limit: 48 });
    expect(screen.getByRole("searchbox", { name: "Search cards" })).toHaveValue("");
  });

  it("marks the grid busy while new filters load, but not while the next page does", () => {
    setGrid(gridPages([[face("g1", true)]], { isFetching: true }));
    const view = render(pane());
    const busy = () => screen.getByRole("list", { name: "All cards" }).parentElement;
    expect(busy()).toHaveAttribute("aria-busy", "true");
    setGrid(gridPages([[face("g1", true)]], { isFetching: true, isFetchingNextPage: true }));
    view.rerender(pane());
    expect(busy()).toHaveAttribute("aria-busy", "false");
  });

  it("says when there are no cards at all, once, and points to the Store", () => {
    setShelves({ data: [] });
    setGrid(gridPages([[]]));
    render(pane());
    expect(screen.queryByRole("heading", { name: "Realms" })).not.toBeInTheDocument();
    expect(screen.getAllByText("No cards yet")).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Store" })).toHaveAttribute("href", "/vault/store");
    expect(screen.queryByRole("button", { name: "Clear filters" })).not.toBeInTheDocument();
  });

  it("shows the grid when no realm has a shelf", () => {
    setShelves({ data: [] });
    render(pane());
    expect(screen.queryByRole("heading", { name: "Realms" })).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Card g1, Rare, Ixnay, not collected" })
    ).toBeInTheDocument();
  });

  it("holds the shelves' and the grid's places while they load", () => {
    setShelves({ isLoading: true });
    setGrid({ ...gridPages([]), data: undefined, isLoading: true } as never);
    render(pane());
    expect(screen.getByRole("heading", { name: "Realms" })).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "All cards" })).not.toBeInTheDocument();
    expect(screen.queryByText("No cards yet")).not.toBeInTheDocument();
  });

  it("says when the shelves did not load, and tries again, but keeps shelves it already has", () => {
    const refetch = setShelves({ isError: true });
    const view = render(pane());
    expect(screen.getByText("Realms did not load")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(refetch).toHaveBeenCalledTimes(1);

    setShelves({ data: shelves, isError: true });
    view.rerender(pane());
    expect(screen.queryByText("Realms did not load")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Ixnay" })).toBeInTheDocument();
  });

  it("says when the grid did not load, and tries again, but keeps cards it already has", () => {
    const failed = setGrid({ ...gridPages([]), data: undefined, isError: true } as never);
    const view = render(pane());
    expect(screen.getByText("Cards did not load")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(failed.refetch).toHaveBeenCalledTimes(1);

    setGrid(gridPages([[face("g1", true)]], { isError: true }));
    view.rerender(pane());
    expect(screen.queryByText("Cards did not load")).not.toBeInTheDocument();
    expect(screen.getByRole("list", { name: "All cards" })).toBeInTheDocument();
  });

  describe("suggesting a card", () => {
    it("asks to open the suggestion dialog from the grid's header", () => {
      const onSuggestingChange = jest.fn();
      render(pane({ onSuggestingChange }));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Suggest a card" }));
      expect(onSuggestingChange).toHaveBeenCalledWith(true);
    });

    it("shows the suggestion form while suggesting, closes on request, and gives focus back", async () => {
      const onSuggestingChange = jest.fn();
      const view = render(pane({ onSuggestingChange }));
      const button = screen.getByRole("button", { name: "Suggest a card" });
      button.focus();
      view.rerender(pane({ onSuggestingChange, suggesting: true }));
      const dialog = screen.getByRole("dialog", { name: "Suggest a lore card" });
      expect(dialog).toHaveAccessibleDescription(
        "Pick a wiki article with no card yet. An admin reviews every suggestion."
      );
      expect(within(dialog).getByText("The suggestion form")).toBeInTheDocument();
      fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
      expect(onSuggestingChange).toHaveBeenLastCalledWith(false);
      view.rerender(pane({ onSuggestingChange, suggesting: false }));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      // Radix moves focus out of a closing dialog on the next tick.
      await waitFor(() => expect(button).toHaveFocus());
    });
  });
});
