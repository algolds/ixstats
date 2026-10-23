/** Manage → Cards → Card categories: the realm's lore cards, searched and filtered, each edited in the dialog. */
import { fireEvent, render, screen, within } from "@testing-library/react";

jest.mock("~/hooks/useNotify", () => ({
  useNotify: jest.fn(() => ({ success: jest.fn(), error: jest.fn() })),
}));
jest.mock("~/hooks/useDebounce", () => ({ useDebounce: <T,>(value: T) => value }));
jest.mock("~/trpc/react", () => ({
  api: {
    cards: {
      realmCategories: { list: { useQuery: jest.fn() }, set: { useMutation: jest.fn() } },
    },
    useUtils: jest.fn(),
  },
}));
jest.mock("~/components/ui/value-select", () =>
  jest.requireActual("~/tests/helpers/native-value-select")
);

import { api, type RouterOutputs } from "~/trpc/react";
import { CardCategoriesSection } from "~/app/r/[realm]/_components/manage/cards/CardCategoriesSection";

type Row = RouterOutputs["cards"]["realmCategories"]["list"]["rows"][number];

const realmCategories = api.cards.realmCategories;
const mutate = jest.fn();

const card = (over: Partial<Row> = {}): Row => ({
  id: "c1",
  title: "Kiro",
  category: "MILITARY",
  subcategory: "army",
  ...over,
});

function serve(rows: Row[], total = rows.length) {
  jest.mocked(api.useUtils).mockReturnValue({
    cards: { realmCategories: { list: { invalidate: jest.fn() } } },
  } as never);
  jest.mocked(realmCategories.list.useQuery).mockReturnValue({
    data: { rows, total },
    isLoading: false,
    isError: false,
  } as never);
  jest.mocked(realmCategories.set.useMutation).mockReturnValue({
    mutate,
    isPending: false,
  } as never);
  render(<CardCategoriesSection slug="eurth" />);
}

const lastInput = () => jest.mocked(realmCategories.list.useQuery).mock.lastCall![0];

beforeEach(() => jest.clearAllMocks());

it("lists each card with its category line", () => {
  serve([card(), card({ id: "c2", title: "Elm", category: null, subcategory: null })]);
  expect(screen.getByRole("heading", { name: "Card categories" })).toBeInTheDocument();
  expect(screen.getByRole("row", { name: /Kiro/ })).toHaveTextContent("Military · Army");
  expect(screen.getByRole("row", { name: /Elm/ })).toHaveTextContent("Uncategorised");
  expect(lastInput()).toEqual({ slug: "eurth", search: undefined, show: "all", limit: 50 });
});

it("edits a card's category in a dialog named for it", () => {
  serve([card()]);
  fireEvent.click(screen.getByRole("button", { name: "Edit the category of Kiro" }));
  const dialog = screen.getByRole("dialog", { name: "Category of Kiro" });
  fireEvent.change(within(dialog).getByLabelText("Subcategory"), { target: { value: "navy" } });
  fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
  expect(mutate).toHaveBeenCalledWith({
    slug: "eurth",
    cardId: "c1",
    choice: { category: "MILITARY", subcategory: "navy" },
  });
});

it("says the realm has no lore cards, and that a search matched none", () => {
  serve([]);
  expect(screen.getByText("No lore cards from this realm yet")).toBeInTheDocument();
  fireEvent.change(screen.getByRole("searchbox", { name: "Search by title" }), {
    target: { value: " Kiro " },
  });
  expect(screen.getByText("No cards match")).toBeInTheDocument();
  expect(lastInput()).toMatchObject({ search: "Kiro" });
});

it("shows more while the realm holds more, and starts over on a new view", () => {
  serve([card()], 120);
  fireEvent.click(screen.getByRole("button", { name: "Show more" }));
  expect(lastInput()).toMatchObject({ show: "all", limit: 100 });
  fireEvent.click(screen.getByRole("radio", { name: "Needs review" }));
  expect(lastInput()).toMatchObject({ show: "review", limit: 50 });
});

it("shows no Show more once every card is listed", () => {
  serve([card()], 1);
  expect(screen.queryByRole("button", { name: "Show more" })).toBeNull();
});
