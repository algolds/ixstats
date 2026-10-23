/** The Library's edit sheet: a lore card's category, sent only when the admin changed it. */
import { fireEvent, render, screen } from "@testing-library/react";

jest.mock("~/hooks/useNotify", () => ({
  useNotify: jest.fn(() => ({ success: jest.fn(), error: jest.fn() })),
}));
jest.mock("~/trpc/react", () => ({
  api: {
    cards: { admin: { library: { update: { useMutation: jest.fn() } } } },
    useUtils: jest.fn(() => ({})),
  },
}));
jest.mock("~/components/ui/value-select", () =>
  jest.requireActual("~/tests/helpers/native-value-select")
);

import { api } from "~/trpc/react";
import { LibraryEditSheet, type LibraryRow } from "~/app/admin/cards/library/LibraryEditSheet";

const mutate = jest.fn();

const row = (over: Partial<LibraryRow> = {}): LibraryRow =>
  ({
    id: "card_1",
    title: "Elm",
    description: null,
    cardType: "LORE",
    rarity: "COMMON",
    realmId: null,
    wikiSource: "iiwiki",
    artwork: null,
    isRetired: false,
    isBound: false,
    rewardAchievementKey: null,
    reviewState: null,
    marketValue: 1,
    category: "MILITARY",
    subcategory: "army",
    categorySource: "CLASSIFIER",
    categoryNeedsReview: false,
    realm: null,
    artLicence: null,
    _count: { CardOwnership: 0, takedowns: 0 },
    ...over,
  }) as LibraryRow;

function open(card: LibraryRow) {
  jest.mocked(api.cards.admin.library.update.useMutation).mockReturnValue({
    mutate,
    isPending: false,
  } as never);
  render(<LibraryEditSheet card={card} onOpenChange={jest.fn()} />);
}

beforeEach(() => jest.clearAllMocks());

it("edits a lore card's category and sends it when it changed", () => {
  open(row());
  expect(screen.getByLabelText("Subcategory")).toHaveValue("army");
  fireEvent.change(screen.getByLabelText("Subcategory"), { target: { value: "navy" } });
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  expect(mutate).toHaveBeenCalledWith(
    expect.objectContaining({ category: { category: "MILITARY", subcategory: "navy" } })
  );
});

it("sends no category when the admin left it as it was", () => {
  open(row());
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  expect(mutate.mock.calls[0]![0]).not.toHaveProperty("category");
});

it("shows no category for a card that is not lore", () => {
  open(row({ cardType: "NS", category: null, subcategory: null }));
  expect(screen.queryByLabelText("Category")).toBeNull();
});
