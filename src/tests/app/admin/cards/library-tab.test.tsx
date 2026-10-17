/** The Library tab: every card, filtered, with an edit sheet and bulk hide. */
import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";

jest.mock("~/trpc/react", () => ({
  api: {
    useUtils: jest.fn(),
    cards: {
      admin: {
        overview: { realms: { useQuery: jest.fn() } },
        library: {
          list: { useQuery: jest.fn() },
          update: { useMutation: jest.fn() },
          bulkSetRetired: { useMutation: jest.fn() },
        },
      },
    },
  },
}));
jest.mock("~/hooks/useNotify", () => {
  const notify = { success: jest.fn(), error: jest.fn() };
  return { useNotify: () => notify };
});

import { api, type RouterOutputs } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { MAX_FILTER_REVIEW } from "~/lib/cards/curation-limits";
import { LibraryTab } from "~/app/admin/cards/library";

type Row = RouterOutputs["cards"]["admin"]["library"]["list"]["rows"][number];
/** The callbacks a component hands `useMutation`. */
interface MutationOptions {
  onSuccess: (result: { count: number } | undefined, asked: { retired: boolean }) => void;
  onError: (error: { message: string; data?: { code: string } }) => void;
}

const library = api.cards.admin.library;
const notify = useNotify();
const AS_OF = new Date("2026-10-01T12:00:00Z");

const elm = (over: Partial<Row> = {}): Row => ({
  id: "card_1",
  title: "Elm",
  description: null,
  cardType: "LORE",
  rarity: "RARE",
  realmId: "iiwiki",
  wikiSource: "iiwiki",
  artwork: null,
  isRetired: false,
  isBound: false,
  reviewState: "APPROVED",
  marketValue: 40,
  realm: { name: "IIWiki" },
  artLicence: null,
  _count: { CardOwnership: 3, takedowns: 0 },
  ...over,
});

function setUp({
  rows = [elm()],
  total = rows.length,
  loading = false,
}: { rows?: Row[]; total?: number; loading?: boolean } = {}) {
  const update = jest.fn();
  const bulk = jest.fn();
  const invalidate = jest.fn();
  jest.mocked(api.useUtils).mockReturnValue({
    cards: { admin: { library: { list: { invalidate } } } },
  } as never);
  jest.mocked(api.cards.admin.overview.realms.useQuery).mockReturnValue({ data: [] } as never);
  jest
    .mocked(library.list.useQuery)
    .mockReturnValue({ data: loading ? undefined : { total, rows, asOf: AS_OF } } as never);
  jest
    .mocked(library.update.useMutation)
    .mockReturnValue({ mutate: update, isPending: false } as never);
  jest
    .mocked(library.bulkSetRetired.useMutation)
    .mockReturnValue({ mutate: bulk, isPending: false } as never);
  render(<LibraryTab />);
  return { update, bulk, invalidate };
}

/** The callbacks the latest render handed a mutation hook. */
const optionsOf = (hook: jest.Mock): MutationOptions =>
  hook.mock.calls[hook.mock.calls.length - 1]![0] as MutationOptions;

const search = (text: string) =>
  fireEvent.change(screen.getByLabelText("Search titles"), { target: { value: text } });
const choose = (select: string, option: string) => {
  fireEvent.click(screen.getByRole("combobox", { name: select }));
  fireEvent.click(screen.getByRole("option", { name: option }));
};

beforeEach(() => jest.clearAllMocks());

it("edits a card's title and keeps bulk hide off until the filter narrows", () => {
  const { update } = setUp();
  expect(screen.getByRole("button", { name: "Hide matching" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Unhide matching" })).toBeDisabled();
  search("   ");
  expect(screen.getByRole("button", { name: "Hide matching" })).toBeDisabled();

  fireEvent.click(screen.getByRole("button", { name: "Edit Elm" }));
  fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Elm Republic" } });
  fireEvent.change(screen.getByLabelText("Description"), { target: { value: " A republic " } });
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  expect(update).toHaveBeenCalledWith({
    cardId: "card_1",
    title: "Elm Republic",
    description: "A republic",
    artwork: null,
    rarity: "RARE",
    retired: false,
  });
});

it("closes the sheet and reads the list again once a card is saved", () => {
  const { invalidate } = setUp();
  fireEvent.click(screen.getByRole("button", { name: "Edit Elm" }));
  act(() =>
    optionsOf(jest.mocked(library.update.useMutation)).onSuccess(undefined, { retired: false })
  );
  expect(notify.success).toHaveBeenCalledWith("Card saved");
  expect(invalidate).toHaveBeenCalled();
  expect(screen.queryByRole("button", { name: "Save changes" })).not.toBeInTheDocument();
});

it("overrides a card's rarity only with a reason", () => {
  const { update } = setUp();
  fireEvent.click(screen.getByRole("button", { name: "Edit Elm" }));
  choose("Rarity", "Epic");
  expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
  expect(screen.getByText("Say why the rarity changes.")).toBeInTheDocument();
  const reason = screen.getByLabelText("Why the rarity changes");
  fireEvent.change(reason, { target: { value: "  a  " } });
  expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
  fireEvent.change(reason, { target: { value: " Featured article " } });
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  expect(update).toHaveBeenCalledWith(
    expect.objectContaining({ rarity: "EPIC", reason: "Featured article" })
  );
});

it("hides the cards the list showed, as of its read, with a reason", () => {
  const { bulk } = setUp();
  search(" Elm ");
  fireEvent.click(screen.getByRole("button", { name: "Hide matching" }));
  expect(screen.getByRole("heading", { name: "Hide 1 matching card" })).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "Duplicates" } });
  expect(screen.getByRole("button", { name: "Hide" })).toHaveClass("bg-destructive");
  fireEvent.click(screen.getByRole("button", { name: "Hide" }));
  expect(bulk).toHaveBeenCalledWith({
    filter: { search: "Elm" },
    retired: true,
    asOf: AS_OF,
    expected: 1,
    reason: "Duplicates",
  });
});

it("filters by type from the first page, and unhides what the filter shows", () => {
  const { bulk } = setUp({ total: 120 });
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  expect(jest.mocked(library.list.useQuery)).toHaveBeenLastCalledWith({
    filter: {},
    offset: 50,
    limit: 50,
  });
  expect(screen.getByText("51–100 of 120")).toBeInTheDocument();
  choose("Type", "NationStates");
  expect(jest.mocked(library.list.useQuery)).toHaveBeenLastCalledWith({
    filter: { cardType: "NS" },
    offset: 0,
    limit: 50,
  });

  fireEvent.click(screen.getByRole("button", { name: "Unhide matching" }));
  expect(screen.getByRole("heading", { name: "Unhide 120 matching cards" })).toBeInTheDocument();
  expect(screen.getByText(/change those from Compliance/)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "Season back" } });
  expect(screen.getByRole("button", { name: "Unhide" })).not.toHaveClass("bg-destructive");
  fireEvent.click(screen.getByRole("button", { name: "Unhide" }));
  expect(bulk).toHaveBeenCalledWith(
    expect.objectContaining({ filter: { cardType: "NS" }, retired: false, expected: 120 })
  );
});

it("closes the bulk dialog on success, and reads the list again when the cards changed", () => {
  const { invalidate } = setUp();
  search("Elm");
  fireEvent.click(screen.getByRole("button", { name: "Hide matching" }));
  const options = () => optionsOf(jest.mocked(library.bulkSetRetired.useMutation));

  act(() => options().onError({ message: "Nothing to see" }));
  expect(notify.error).toHaveBeenCalledWith("Nothing changed", "Nothing to see");
  expect(invalidate).not.toHaveBeenCalled();
  act(() => options().onError({ message: "Reload", data: { code: "CONFLICT" } }));
  expect(invalidate).toHaveBeenCalledTimes(1);

  act(() => options().onSuccess({ count: 3 }, { retired: true }));
  expect(notify.success).toHaveBeenCalledWith("3 cards hidden");
  expect(invalidate).toHaveBeenCalledTimes(2);
  expect(screen.queryByRole("heading", { name: "Hide 1 matching card" })).not.toBeInTheDocument();
});

it("keeps bulk hide off past the most cards one action may change", () => {
  setUp({ total: MAX_FILTER_REVIEW + 1 });
  expect(screen.queryByText(/at most 2,000 cards at once/)).not.toBeInTheDocument();
  search("Elm");
  expect(screen.getByRole("button", { name: "Hide matching" })).toBeDisabled();
  expect(screen.getByText(/at most 2,000 cards at once/)).toBeInTheDocument();
});

it("keeps bulk hide off while the list loads", () => {
  setUp({ loading: true });
  search("Elm");
  expect(screen.getByRole("button", { name: "Hide matching" })).toBeDisabled();
});

it("says so when no card matches", () => {
  setUp({ rows: [] });
  search("Elm");
  expect(screen.getByRole("button", { name: "Hide matching" })).toBeDisabled();
  expect(screen.getByText("No cards match")).toBeInTheDocument();
  expect(screen.getByText("No cards")).toBeInTheDocument();
});

it("leaves art a takedown hides, and the card's visibility, to Compliance", () => {
  const { update } = setUp({
    rows: [elm({ isRetired: true, _count: { CardOwnership: 0, takedowns: 1 } })],
  });
  expect(screen.getByText("Art hidden")).toBeInTheDocument();
  expect(screen.getByText("Hidden")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Edit Elm" }));
  expect(screen.getByLabelText("Art URL")).toBeDisabled();
  expect(screen.getByRole("switch", { name: "Hidden from packs and Explore" })).toBeDisabled();
  expect(screen.getByText(/A takedown hides this art/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  expect(update).toHaveBeenCalledWith(expect.objectContaining({ artwork: null, retired: true }));
});

it("leaves art whose licence is restricted to Compliance", () => {
  setUp({ rows: [elm({ artLicence: { status: "RESTRICTED" } })] });
  fireEvent.click(screen.getByRole("button", { name: "Edit Elm" }));
  expect(screen.getByLabelText("Art URL")).toBeDisabled();
  expect(screen.getByText(/licence is restricted/)).toBeInTheDocument();
});

it("needs a title, and keeps stored art of any form", () => {
  const { update } = setUp({ rows: [elm({ artwork: "/api/wiki/file/Elm.png" })] });
  fireEvent.click(screen.getByRole("button", { name: "Edit Elm" }));
  const title = screen.getByLabelText("Title");
  fireEvent.change(title, { target: { value: "  " } });
  expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
  expect(screen.getByText("Give the card a title.")).toBeInTheDocument();
  fireEvent.change(title, { target: { value: "Elm II" } });
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  expect(update).toHaveBeenCalledWith(
    expect.objectContaining({ title: "Elm II", artwork: "/api/wiki/file/Elm.png" })
  );
});

it("refuses new art that is not an https address before sending it", () => {
  const { update } = setUp();
  fireEvent.click(screen.getByRole("button", { name: "Edit Elm" }));
  fireEvent.change(screen.getByLabelText("Art URL"), {
    target: { value: "http://example.com/a.png" },
  });
  expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
  expect(screen.getByText("Art is an https:// address.")).toBeInTheDocument();
  expect(update).not.toHaveBeenCalled();
});

it("names each card's type, source and review state", () => {
  setUp({
    rows: [
      elm({ reviewState: "PENDING", isBound: true, _count: { CardOwnership: 1200, takedowns: 0 } }),
    ],
  });
  expect(screen.getByText("Lore · IIWiki · Waiting for review")).toBeInTheDocument();
  expect(screen.getByText("Bound")).toBeInTheDocument();
  expect(screen.getByText("1,200")).toBeInTheDocument();
});
