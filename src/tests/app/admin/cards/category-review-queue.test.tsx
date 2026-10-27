/** The category review queue: low-confidence guesses approved, changed or rejected, and players' suggestions answered. */
import { fireEvent, render, screen, within } from "@testing-library/react";

jest.mock("~/hooks/useNotify", () => ({
  useNotify: jest.fn(() => ({ success: jest.fn(), error: jest.fn() })),
}));
jest.mock("~/trpc/react", () => ({
  api: {
    cards: {
      admin: {
        categories: {
          classifications: { useQuery: jest.fn() },
          suggestions: { useQuery: jest.fn() },
          set: { useMutation: jest.fn() },
          answerSuggestion: { useMutation: jest.fn() },
        },
      },
    },
    useUtils: jest.fn(),
  },
}));
jest.mock("~/components/ui/value-select", () =>
  jest.requireActual("~/tests/helpers/native-value-select")
);

import { api, type RouterOutputs } from "~/trpc/react";
import { CategoryReviewQueue } from "~/app/admin/cards/curation/CategoryReviewQueue";

type Queue = RouterOutputs["cards"]["admin"]["categories"];
type Classification = Queue["classifications"]["rows"][number];
type Suggestion = Queue["suggestions"]["rows"][number];

const categories = api.cards.admin.categories;
const setCategory = jest.fn();
const answer = jest.fn();

const guess = (over: Partial<Classification> = {}): Classification => ({
  id: "c1",
  title: "Kiro",
  wikiSource: "iiwiki",
  wikiArticleTitle: "Kiro",
  category: "MILITARY",
  subcategory: "army",
  categoryConfidence: 0.424,
  realm: { name: "Eurth" },
  ...over,
});

const suggestion = (over: Partial<Suggestion> = {}): Suggestion => ({
  id: "s1",
  category: "HISTORY",
  subcategory: "event",
  note: null,
  createdAt: new Date("2026-10-20T12:00:00Z"),
  card: { id: "c2", title: "Elm", category: null, subcategory: null, realm: { name: "Ixnay" } },
  player: "@ixnay",
  ...over,
});

function serve(
  classifications: { rows: Classification[]; total: number },
  suggestions: { rows: Suggestion[]; total: number } = { rows: [], total: 0 }
) {
  jest.mocked(api.useUtils).mockReturnValue({
    cards: { admin: { categories: { invalidate: jest.fn() } } },
  } as never);
  jest.mocked(categories.classifications.useQuery).mockReturnValue({
    data: classifications,
    isLoading: false,
    isError: false,
  } as never);
  jest.mocked(categories.suggestions.useQuery).mockReturnValue({
    data: suggestions,
    isLoading: false,
    isError: false,
  } as never);
  jest.mocked(categories.set.useMutation).mockReturnValue({
    mutate: setCategory,
    isPending: false,
  } as never);
  jest.mocked(categories.answerSuggestion.useMutation).mockReturnValue({
    mutate: answer,
    isPending: false,
  } as never);
  render(<CategoryReviewQueue />);
}

beforeEach(() => jest.clearAllMocks());

it("shows each queue's total and a guess with its category and whole-percent confidence", () => {
  serve({ rows: [guess()], total: 42 }, { rows: [], total: 3 });
  expect(screen.getByRole("tab", { name: "Low confidence · 42" })).toBeInTheDocument();
  expect(screen.getByRole("tab", { name: "Player suggestions · 3" })).toBeInTheDocument();
  const row = screen.getByRole("row", { name: /Kiro/ });
  expect(row).toHaveTextContent("Military · Army");
  expect(row).toHaveTextContent("42%");
});

it("approves a guess as it is and rejects one to Uncategorised", () => {
  serve({ rows: [guess()], total: 1 });
  fireEvent.click(screen.getByRole("button", { name: "Approve the category of Kiro" }));
  expect(setCategory).toHaveBeenCalledWith({
    cardId: "c1",
    choice: { category: "MILITARY", subcategory: "army" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Reject the category of Kiro" }));
  expect(setCategory).toHaveBeenLastCalledWith({
    cardId: "c1",
    choice: { category: null, subcategory: null },
  });
});

it("changes a guess through the category dialog", () => {
  serve({ rows: [guess()], total: 1 });
  fireEvent.click(screen.getByRole("button", { name: "Change the category of Kiro" }));
  const dialog = screen.getByRole("dialog", { name: "Change the category" });
  fireEvent.change(within(dialog).getByLabelText("Subcategory"), { target: { value: "navy" } });
  fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
  expect(setCategory).toHaveBeenCalledWith({
    cardId: "c1",
    choice: { category: "MILITARY", subcategory: "navy" },
  });
});

it("asks for more rows while the queue holds more than it shows", () => {
  serve({ rows: [guess()], total: 120 });
  expect(jest.mocked(categories.classifications.useQuery).mock.calls[0]![0]).toEqual({
    limit: 50,
  });
  fireEvent.click(screen.getByRole("button", { name: "Show more" }));
  expect(jest.mocked(categories.classifications.useQuery).mock.lastCall![0]).toEqual({
    limit: 100,
  });
});

it("answers a player's suggestion: accept, change or reject", () => {
  serve({ rows: [], total: 0 }, { rows: [suggestion()], total: 1 });
  fireEvent.mouseDown(screen.getByRole("tab", { name: "Player suggestions · 1" }));
  const row = screen.getByRole("row", { name: /Elm/ });
  expect(row).toHaveTextContent("Uncategorised");
  expect(row).toHaveTextContent("History · Event");
  expect(row).toHaveTextContent("–");
  expect(row).toHaveTextContent("@ixnay");
  fireEvent.click(screen.getByRole("button", { name: "Accept the suggestion for Elm" }));
  expect(answer).toHaveBeenCalledWith({ suggestionId: "s1", decision: "ACCEPT" });
  fireEvent.click(screen.getByRole("button", { name: "Reject the suggestion for Elm" }));
  expect(answer).toHaveBeenLastCalledWith({ suggestionId: "s1", decision: "REJECT" });
  fireEvent.click(screen.getByRole("button", { name: "Change the suggestion for Elm" }));
  const dialog = screen.getByRole("dialog", { name: "Change the category" });
  fireEvent.change(within(dialog).getByLabelText("Subcategory"), { target: { value: "document" } });
  fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
  expect(answer).toHaveBeenLastCalledWith({
    suggestionId: "s1",
    decision: "CHANGE",
    choice: { category: "HISTORY", subcategory: "document" },
  });
});

it("says when each queue is empty", () => {
  serve({ rows: [], total: 0 });
  expect(screen.getByText("No low-confidence categories")).toBeInTheDocument();
  fireEvent.mouseDown(screen.getByRole("tab", { name: "Player suggestions · 0" }));
  expect(screen.getByText("No category suggestions waiting")).toBeInTheDocument();
});
