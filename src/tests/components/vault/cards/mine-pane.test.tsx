import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { keepPreviousData } from "@tanstack/react-query";

jest.mock("~/trpc/react", () => ({
  api: { cards: { listMine: { useInfiniteQuery: jest.fn() } } },
}));
jest.mock("~/hooks/useDebounce", () => ({ useDebounce: <T,>(value: T) => value }));
jest.mock("~/components/cards/showcase/AddToShowcaseDialog", () => ({
  AddToShowcaseDialog: ({
    open,
    onOpenChange,
    ownershipIds,
    onAdded,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    ownershipIds: string[];
    onAdded?: () => void;
  }) =>
    open ? (
      <div role="dialog">
        Adding {ownershipIds.join(",")}
        <button type="button" onClick={() => onOpenChange(false)}>
          Close
        </button>
        {/* The real dialog closes itself, then says the copies are in. */}
        <button
          type="button"
          onClick={() => {
            onOpenChange(false);
            onAdded?.();
          }}
        >
          Added
        </button>
      </div>
    ) : null,
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
import { MinePane } from "~/components/vault/cards/MinePane";
import type { MinePage, MineRow } from "~/lib/cards/hub/mine";

const realm = { id: "default", slug: "ixnay", name: "Ixnay", crestUrl: null, isSystem: false };
const row = (n: number, value = 100, copies = 1, isRetired = false): MineRow => ({
  face: {
    cardId: `c${n}`,
    title: `Card ${n}`,
    rarity: "RARE",
    cardType: "LORE",
    realm,
    artwork: null,
    silhouette: false,
    number: n,
    season: null,
    isRetired,
    copy: { ownershipId: `o${n}`, finish: "STANDARD", serialNumber: n, level: 1 },
  },
  value,
  copies,
  acquiredAt: new Date("2026-10-01T00:00:00Z"),
  isLocked: false,
});
const listMine = () => jest.mocked(api.cards.listMine.useInfiniteQuery);
interface QueryState {
  hasNextPage: boolean;
  isFetching: boolean;
  isFetchingNextPage: boolean;
  isFetchNextPageError: boolean;
  isError: boolean;
}
/** The query's state with these pages of rows loaded. */
const pages = (loaded: MineRow[][], totalCopies: number, more: Partial<QueryState> = {}) => ({
  data: {
    pages: loaded.map((rows) => ({
      rows,
      total: rows.length,
      nextCursor: null,
      realms: [realm],
      totalCopies,
    })),
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
const page = (rows: MineRow[], totalCopies = rows.length, more: Partial<QueryState> = {}) =>
  pages([rows], totalCopies, more);
const lastInput = () => listMine().mock.calls.at(-1)![0];
const face = (n: number) =>
  screen.getByRole("button", { name: `Card ${n}, Rare, Standard, Ixnay` });

beforeEach(() => listMine().mockReset());

describe("MinePane", () => {
  it("shows the player's copies as faces that open the sheet", () => {
    listMine().mockReturnValue(page([row(1), row(2)]) as never);
    const onOpenCard = jest.fn();
    render(<MinePane onOpenCard={onOpenCard} />);
    expect(screen.getByRole("list", { name: "Your cards" })).toBeInTheDocument();
    fireEvent.click(face(1));
    expect(onOpenCard).toHaveBeenCalledWith("c1");
  });

  it("asks for the newest copies first, a page of 60 at a time, and keeps the last page while a new one loads", () => {
    listMine().mockReturnValue(page([row(1)]) as never);
    render(<MinePane onOpenCard={jest.fn()} />);
    expect(lastInput()).toEqual({ sort: "acquired", limit: 60 });
    const options = listMine().mock.calls.at(-1)![1]!;
    expect(options.placeholderData).toBe(keepPreviousData);
    const next = options.getNextPageParam as (
      last: Pick<MinePage, "nextCursor">
    ) => number | undefined;
    expect(next({ nextCursor: 60 })).toBe(60);
    expect(next({ nextCursor: null })).toBeUndefined();
  });

  it("selects copies and adds them to a showcase together", () => {
    listMine().mockReturnValue(page([row(1), row(2)]) as never);
    const onOpenCard = jest.fn();
    render(<MinePane onOpenCard={onOpenCard} />);
    fireEvent.click(screen.getByRole("button", { name: "Select" }));
    expect(screen.getByRole("button", { name: "Add to showcase" })).toBeDisabled();
    fireEvent.click(face(1));
    fireEvent.click(face(2));
    expect(onOpenCard).not.toHaveBeenCalled();
    expect(face(1)).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("group", { name: "Selected cards" })).toHaveTextContent("2 selected");
    fireEvent.click(screen.getByRole("button", { name: "Add to showcase" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("Adding o1,o2");
  });

  it("leaves select mode once the copies are added", () => {
    listMine().mockReturnValue(page([row(1), row(2)]) as never);
    render(<MinePane onOpenCard={jest.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Select" }));
    fireEvent.click(face(1));
    fireEvent.click(screen.getByRole("button", { name: "Add to showcase" }));
    fireEvent.click(screen.getByRole("button", { name: "Added" }));
    expect(screen.queryByRole("group", { name: "Selected cards" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Select" })).toBeInTheDocument();
    expect(face(1)).not.toHaveAttribute("aria-pressed");
  });

  it("drops the picks a search hides, and does not bring them back", () => {
    const both = page([row(1), row(2)]);
    const found = page([row(2)], 2);
    listMine().mockImplementation(((input: { search?: string }) =>
      input.search ? found : both) as never);
    render(<MinePane onOpenCard={jest.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Select" }));
    fireEvent.click(face(1));
    fireEvent.click(face(2));
    const search = screen.getByRole("searchbox", { name: "Search cards" });
    fireEvent.change(search, { target: { value: "Card 2" } });
    expect(screen.getByText("1 selected")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add to showcase" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("Adding o2");
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    fireEvent.change(search, { target: { value: "" } });
    expect(screen.getByText("1 selected")).toBeInTheDocument();
    expect(face(1)).toHaveAttribute("aria-pressed", "false");
  });

  it("drops a pick whose copy leaves Mine", () => {
    listMine().mockReturnValue(page([row(1), row(2)]) as never);
    const { rerender } = render(<MinePane onOpenCard={jest.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Select" }));
    fireEvent.click(face(1));
    fireEvent.click(face(2));
    listMine().mockReturnValue(page([row(2)]) as never);
    rerender(<MinePane onOpenCard={jest.fn()} />);
    expect(screen.getByText("1 selected")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add to showcase" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("Adding o2");
  });

  it("shows a copy once when the pages overlap", () => {
    listMine().mockReturnValue(
      pages(
        [
          [row(1), row(2)],
          [row(2), row(3)],
        ],
        3
      ) as never
    );
    render(<MinePane onOpenCard={jest.fn()} />);
    expect(screen.getAllByRole("button", { name: /^Card \d, / })).toHaveLength(3);
  });

  it("puts the bulk bar before the cards, so it is reached first from the keyboard", () => {
    listMine().mockReturnValue(page([row(1)]) as never);
    render(<MinePane onOpenCard={jest.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Select" }));
    const bar = screen.getByRole("group", { name: "Selected cards" });
    const grid = screen.getByRole("list", { name: "Your cards" });
    expect(bar.compareDocumentPosition(grid) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("drops a copy picked twice", () => {
    listMine().mockReturnValue(page([row(1), row(2)]) as never);
    render(<MinePane onOpenCard={jest.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Select" }));
    fireEvent.click(face(1));
    fireEvent.click(face(2));
    fireEvent.click(face(1));
    expect(screen.getByText("1 selected")).toBeInTheDocument();
    expect(face(1)).toHaveAttribute("aria-pressed", "false");
  });

  it("keeps the picked copies when the showcase dialog closes", () => {
    listMine().mockReturnValue(page([row(1), row(2)]) as never);
    render(<MinePane onOpenCard={jest.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Select" }));
    fireEvent.click(face(2));
    fireEvent.click(screen.getByRole("button", { name: "Add to showcase" }));
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText("1 selected")).toBeInTheDocument();
  });

  it.each(["Done", "Cancel"])(
    "leaves select mode with %s, and faces open the sheet again",
    (button) => {
      listMine().mockReturnValue(page([row(1)]) as never);
      const onOpenCard = jest.fn();
      render(<MinePane onOpenCard={onOpenCard} />);
      fireEvent.click(screen.getByRole("button", { name: "Select" }));
      fireEvent.click(face(1));
      fireEvent.click(screen.getByRole("button", { name: button }));
      expect(screen.queryByText("1 selected")).not.toBeInTheDocument();
      expect(face(1)).not.toHaveAttribute("aria-pressed");
      fireEvent.click(face(1));
      expect(onOpenCard).toHaveBeenCalledWith("c1");
    }
  );

  it("starts select mode afresh each time", () => {
    listMine().mockReturnValue(page([row(1)]) as never);
    render(<MinePane onOpenCard={jest.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Select" }));
    fireEvent.click(face(1));
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    fireEvent.click(screen.getByRole("button", { name: "Select" }));
    expect(screen.getByText("0 selected")).toBeInTheDocument();
  });

  it("lists copies with a value column", () => {
    listMine().mockReturnValue(page([row(1, 1200, 3), row(2, 0)]) as never);
    const onOpenCard = jest.fn();
    render(<MinePane onOpenCard={onOpenCard} />);
    expect(screen.getByRole("tabpanel", { name: "Grid" })).toBeInTheDocument();
    // Radix tabs switch on mouse down, not click.
    fireEvent.mouseDown(screen.getByRole("tab", { name: "List" }), { button: 0 });
    expect(screen.getByRole("tabpanel", { name: "List" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Value" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "IxCredits 1,200" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "IxCredits 0" })).toBeInTheDocument();
    expect(screen.queryByText("Retired")).not.toBeInTheDocument();
    expect(screen.getByText("3 copies")).toBeInTheDocument();
    expect(screen.getAllByText(/copies$/)).toHaveLength(1);
    expect(screen.queryByRole("list", { name: "Your cards" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Card 2" }));
    expect(onOpenCard).toHaveBeenCalledWith("c2");
  });

  it("says a retired copy is retired beside its value of nothing", () => {
    listMine().mockReturnValue(page([row(1, 0, 1, true)]) as never);
    render(<MinePane onOpenCard={jest.fn()} />);
    fireEvent.mouseDown(screen.getByRole("tab", { name: "List" }), { button: 0 });
    expect(screen.getByRole("cell", { name: "Retired IxCredits 0" })).toBeInTheDocument();
  });

  it("marks a missing finish and level with a dash", () => {
    const bare = row(1);
    listMine().mockReturnValue(page([{ ...bare, face: { ...bare.face, copy: null } }]) as never);
    render(<MinePane onOpenCard={jest.fn()} />);
    fireEvent.mouseDown(screen.getByRole("tab", { name: "List" }), { button: 0 });
    expect(screen.getAllByRole("cell", { name: "–" })).toHaveLength(2);
  });

  it("shows the grid while selecting, with the view switch off", () => {
    listMine().mockReturnValue(page([row(1)]) as never);
    render(<MinePane onOpenCard={jest.fn()} />);
    fireEvent.mouseDown(screen.getByRole("tab", { name: "List" }), { button: 0 });
    fireEvent.click(screen.getByRole("button", { name: "Select" }));
    expect(screen.queryByRole("columnheader", { name: "Value" })).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Grid" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "List" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.getByRole("columnheader", { name: "Value" })).toBeInTheDocument();
  });

  it("searches as the player types", () => {
    listMine().mockReturnValue(page([row(1)]) as never);
    render(<MinePane onOpenCard={jest.fn()} />);
    fireEvent.change(screen.getByRole("searchbox", { name: "Search cards" }), {
      target: { value: "caph" },
    });
    expect(lastInput()).toMatchObject({ search: "caph", sort: "acquired" });
  });

  it("filters by rarity and duplicates from the filters popover", () => {
    listMine().mockReturnValue(page([row(1)]) as never);
    render(<MinePane onOpenCard={jest.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Filters" }));
    fireEvent.click(screen.getByRole("button", { name: "Epic" }));
    fireEvent.click(screen.getByRole("switch", { name: "Duplicates only" }));
    expect(lastInput()).toEqual({
      rarities: ["EPIC"],
      duplicates: true,
      sort: "acquired",
      limit: 60,
    });
    expect(screen.getByRole("button", { name: "Filters, 2 on" })).toBeInTheDocument();
  });

  it("offers the realms the player holds cards from", () => {
    listMine().mockReturnValue(page([row(1)]) as never);
    render(<MinePane onOpenCard={jest.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Filters" }));
    fireEvent.click(screen.getByRole("combobox", { name: "Realm" }));
    fireEvent.click(screen.getByRole("option", { name: "Ixnay" }));
    expect(lastInput()).toMatchObject({ realmId: "default" });
  });

  it("sorts by the sort menu", () => {
    listMine().mockReturnValue(page([row(1)]) as never);
    render(<MinePane onOpenCard={jest.fn()} />);
    fireEvent.click(screen.getByRole("combobox", { name: "Sort" }));
    fireEvent.click(screen.getByRole("option", { name: "Most valuable" }));
    expect(lastInput()).toMatchObject({ sort: "value" });
  });

  it("shows more copies on request", () => {
    const more = page([row(1)], 2, { hasNextPage: true });
    listMine().mockReturnValue(more as never);
    render(<MinePane onOpenCard={jest.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Show more" }));
    expect(more.fetchNextPage).toHaveBeenCalledTimes(1);
  });

  it("says when more cards did not load, and tries again", () => {
    const failed = page([row(1)], 2, {
      hasNextPage: true,
      isError: true,
      isFetchNextPageError: true,
    });
    listMine().mockReturnValue(failed as never);
    render(<MinePane onOpenCard={jest.fn()} />);
    expect(screen.getByText("More cards did not load.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Show more" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(failed.fetchNextPage).toHaveBeenCalledTimes(1);
    expect(failed.refetch).not.toHaveBeenCalled();
  });

  it("holds the show-more button while the next page loads, and hides it after the last", () => {
    listMine().mockReturnValue(
      page([row(1)], 2, { hasNextPage: true, isFetchingNextPage: true }) as never
    );
    const { rerender } = render(<MinePane onOpenCard={jest.fn()} />);
    expect(screen.getByRole("button", { name: "Show more" })).toBeDisabled();
    listMine().mockReturnValue(page([row(1)]) as never);
    rerender(<MinePane onOpenCard={jest.fn()} />);
    expect(screen.queryByRole("button", { name: "Show more" })).not.toBeInTheDocument();
  });

  it("points an empty collection to Explore and the Store", () => {
    listMine().mockReturnValue(page([], 0) as never);
    render(<MinePane onOpenCard={jest.fn()} />);
    expect(screen.getByText("No cards yet")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Explore cards" })).toHaveAttribute(
      "href",
      "/vault/cards/explore"
    );
    expect(screen.getByRole("link", { name: "Store" })).toHaveAttribute("href", "/vault/store");
    expect(screen.getByRole("button", { name: "Select" })).toBeDisabled();
  });

  it("says when nothing matches the filters, and clears them", () => {
    listMine().mockReturnValue(page([], 5) as never);
    render(<MinePane onOpenCard={jest.fn()} />);
    expect(screen.getByText("No cards match these filters")).toBeInTheDocument();
    expect(screen.queryByText("No cards yet")).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("searchbox", { name: "Search cards" }), {
      target: { value: "zzz" },
    });
    expect(lastInput()).toMatchObject({ search: "zzz" });
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(lastInput()).toEqual({ sort: "acquired", limit: 60 });
  });

  it("shows a busy placeholder while the first page loads", () => {
    listMine().mockReturnValue({
      ...page([]),
      data: undefined,
      isLoading: true,
      isFetching: true,
    } as never);
    render(<MinePane onOpenCard={jest.fn()} />);
    const panel = screen.getByRole("tabpanel", { name: "Grid" });
    expect(panel).toHaveAttribute("aria-busy", "true");
    expect(panel.querySelector('[data-slot="skeleton"]')).toBeInTheDocument();
    expect(screen.queryByText("No cards yet")).not.toBeInTheDocument();
    expect(screen.queryByText("No cards match these filters")).not.toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Your cards" })).not.toBeInTheDocument();
  });

  it("says when the cards did not load, and tries again", () => {
    const failed = { ...page([]), data: undefined, isError: true };
    listMine().mockReturnValue(failed as never);
    render(<MinePane onOpenCard={jest.fn()} />);
    expect(screen.getByText("Your cards did not load")).toBeInTheDocument();
    expect(screen.queryByText("No cards yet")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(failed.refetch).toHaveBeenCalledTimes(1);
  });

  it.each<[string, Partial<QueryState>, string]>([
    ["while new cards load", { isFetching: true }, "true"],
    ["not while the next page loads", { isFetching: true, isFetchingNextPage: true }, "false"],
    ["not once they are in", {}, "false"],
  ])("marks the cards busy %s", (_when, state, busy) => {
    listMine().mockReturnValue(page([row(1)], 1, state) as never);
    render(<MinePane onOpenCard={jest.fn()} />);
    expect(screen.getByRole("tabpanel", { name: "Grid" })).toHaveAttribute("aria-busy", busy);
  });

  it("keeps the cards it has when a refresh fails", () => {
    listMine().mockReturnValue(page([row(1)], 1, { isError: true }) as never);
    render(<MinePane onOpenCard={jest.fn()} />);
    expect(screen.queryByText("Your cards did not load")).not.toBeInTheDocument();
    expect(face(1)).toBeInTheDocument();
  });
});
