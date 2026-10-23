/** Explore's filters popover tells the player when its type and category choices are loading or did not load. */
import { fireEvent, render, screen } from "@testing-library/react";

jest.mock("~/trpc/react", () => {
  const settled = () => ({ data: undefined, isLoading: false, isError: false, refetch: jest.fn() });
  return {
    api: {
      cards: {
        exploreShelves: { useQuery: jest.fn(settled) },
        exploreFacets: { useQuery: jest.fn() },
        exploreRegions: { useQuery: jest.fn(settled) },
        exploreGrid: {
          useInfiniteQuery: jest.fn(() => ({ ...settled(), hasNextPage: false })),
        },
      },
    },
  };
});
jest.mock("~/components/vault/cards/CardGrid", () => ({ CardGrid: () => null }));
jest.mock("~/components/vault/cards/RealmShelf", () => ({ RealmShelf: () => null }));
jest.mock("~/components/vault/cards/SuggestCardDialog", () => ({ SuggestCardDialog: () => null }));

import { ExplorePane } from "~/components/vault/cards/ExplorePane";
import { api } from "~/trpc/react";

const facetsQuery = jest.mocked(api.cards.exploreFacets.useQuery);
const LOADING = "Loading types and categories";
const FAILED = "Types and categories did not load.";

function openFilters(facets: object) {
  facetsQuery.mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: false,
    ...facets,
  } as never);
  render(
    <ExplorePane
      onOpenCard={jest.fn()}
      initialRealmSlug={null}
      suggesting={false}
      onSuggestingChange={jest.fn()}
    />
  );
  fireEvent.click(screen.getByRole("button", { name: "Filters" }));
}

describe("Explore's type and category choices", () => {
  it("shows a skeleton while they load", () => {
    openFilters({ isLoading: true });
    expect(screen.getByRole("status", { name: LOADING })).toBeInTheDocument();
    expect(screen.queryByText(FAILED)).toBeNull();
  });

  it("says they did not load", () => {
    openFilters({ isError: true });
    expect(screen.getByText(FAILED)).toBeInTheDocument();
    expect(screen.queryByRole("status", { name: LOADING })).toBeNull();
  });

  it("says nothing while the query waits without an error (offline, paused)", () => {
    openFilters({});
    expect(screen.queryByText(FAILED)).toBeNull();
    expect(screen.queryByRole("status", { name: LOADING })).toBeNull();
  });

  it("keeps the choices it has when a refresh fails", () => {
    openFilters({ isError: true, data: { types: ["LORE"], categories: ["HISTORY"] } });
    expect(screen.queryByText(FAILED)).toBeNull();
    expect(screen.getByRole("toolbar", { name: "Type" })).toBeInTheDocument();
  });
});
