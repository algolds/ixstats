import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
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
import type { CardFaceData, CardRealmBadge } from "~/lib/cards/face/types";
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

/** The shelves, and the realm filters' list: by default the shelved realms. */
function setShelves(state: {
  data?: RealmShelf[];
  realms?: CardRealmBadge[];
  isLoading?: boolean;
  isError?: boolean;
}) {
  const refetch = jest.fn();
  const { data, realms, ...rest } = state;
  shelvesQuery().mockReturnValue({
    data: data && { shelves: data, realms: realms ?? data.map((shelf) => shelf.realm) },
    isLoading: false,
    isError: false,
    refetch,
    ...rest,
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
  it("opens a card's sheet from a shelf", () => {
    const onOpenCard = jest.fn();
    render(pane({ onOpenCard }));
    fireEvent.click(screen.getByRole("button", { name: "Card w1, Rare, Ixnay, not collected" }));
    expect(onOpenCard).toHaveBeenCalledWith("w1");
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
  it("applies a linked realm once, then leaves the player's choice alone until the link changes", () => {
    const view = render(pane({ initialRealmSlug: "nationstates" }));
    fireEvent.click(screen.getByRole("button", { name: "Browse all Ixnay cards" }));
    view.rerender(pane({ initialRealmSlug: "nationstates" }));
    expect(lastGridInput()).toMatchObject({ realmId: "default" });
    view.rerender(pane({ initialRealmSlug: "ixnay" }));
    view.rerender(pane({ initialRealmSlug: "nationstates" }));
    expect(lastGridInput()).toMatchObject({ realmId: "ns" });
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
  describe("suggesting a card", () => {
    it("asks to open the suggestion dialog from the grid's header", () => {
      const onSuggestingChange = jest.fn();
      render(pane({ onSuggestingChange }));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Suggest a card" }));
      expect(onSuggestingChange).toHaveBeenCalledWith(true);
    });
  });
});
