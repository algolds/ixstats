import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { keepPreviousData } from "@tanstack/react-query";

jest.mock("~/trpc/react", () => ({
  api: { cards: { listMine: { useInfiniteQuery: jest.fn() } } },
}));
jest.mock("~/hooks/useDebounce", () => ({ useDebounce: <T,>(value: T) => value }));
jest.mock("~/hooks/cards/useCopyActions", () => ({ useCopyActions: jest.fn() }));
jest.mock("~/hooks/cards/useSheetEconomy", () => ({ useEconomyNumbers: jest.fn() }));
jest.mock("~/hooks/cards/useWorkshop", () => ({ useDust: jest.fn(() => ({ data: [] })) }));
jest.mock("~/components/cards/showcase/AddToShowcaseDialog", () => ({
  AddToShowcaseDialog: ({
    open,
    onOpenChange,
    ownershipIds,
    onAdded,
    focusAfterAdd,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    ownershipIds: string[];
    onAdded?: () => void;
    focusAfterAdd?: React.RefObject<HTMLElement | null>;
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
            // The real dialog gives focus there once it has closed.
            focusAfterAdd?.current?.focus();
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
import { useCopyActions } from "~/hooks/cards/useCopyActions";
import { useEconomyNumbers } from "~/hooks/cards/useSheetEconomy";
import { CARD_ECONOMY_DEFAULTS } from "~/lib/cards/economy-config";
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
    uncollected: false,
    number: n,
    season: null,
    isRetired,
    copy: { ownershipId: `o${n}`, finish: "STANDARD", serialNumber: n, level: 1 },
  },
  value,
  copies,
  acquiredAt: new Date("2026-10-01T00:00:00Z"),
  isLocked: false,
  isBound: false,
  inscription: null,
  importDiscounted: false,
  inOffer: false,
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

const breakDown = { mutate: jest.fn(), isPending: false };
beforeEach(() => {
  listMine().mockReset();
  breakDown.mutate.mockReset();
  jest.mocked(useCopyActions).mockReturnValue({ breakDown } as never);
  jest
    .mocked(useEconomyNumbers)
    .mockReturnValue({ data: { economy: CARD_ECONOMY_DEFAULTS, feeRatePct: 10 } } as never);
});

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

  it("hands the bar the picked copies, a copy in a pending offer counted as locked", () => {
    listMine().mockReturnValue(page([row(1), row(2), { ...row(3), inOffer: true }]) as never);
    render(<MinePane onOpenCard={jest.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Select" }));
    fireEvent.click(face(1));
    fireEvent.click(face(2));
    const bar = screen.getByRole("group", { name: "Selected cards" });
    expect(bar).toHaveTextContent("2 selected");
    fireEvent.click(screen.getByRole("button", { name: "Break down 2" }));
    expect(screen.getByText("Break down 2 copies for 100 dust?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Keep them" }));
    fireEvent.click(face(3));
    expect(bar).toHaveTextContent("3 selected");
    expect(screen.getByRole("button", { name: "Break down 3" })).toBeDisabled();
    expect(
      screen.getByText("A copy that is listed or in a trade can't be broken down.")
    ).toBeInTheDocument();
  });
  it("leaves select mode once the copies are added", () => {
    listMine().mockReturnValue(page([row(1), row(2)]) as never);
    render(<MinePane onOpenCard={jest.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Select" }));
    fireEvent.click(face(1));
    fireEvent.click(screen.getByRole("button", { name: "Add to showcase" }));
    fireEvent.click(screen.getByRole("button", { name: "Added" }));
    expect(screen.queryByRole("group", { name: "Selected cards" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Select" })).toHaveFocus();
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
  it.each<[string, Partial<QueryState>, string]>([
    ["while new cards load", { isFetching: true }, "true"],
    ["not while the next page loads", { isFetching: true, isFetchingNextPage: true }, "false"],
    ["not once they are in", {}, "false"],
  ])("marks the cards busy %s", (_when, state, busy) => {
    listMine().mockReturnValue(page([row(1)], 1, state) as never);
    render(<MinePane onOpenCard={jest.fn()} />);
    expect(screen.getByRole("tabpanel", { name: "Grid" })).toHaveAttribute("aria-busy", busy);
  });
});
