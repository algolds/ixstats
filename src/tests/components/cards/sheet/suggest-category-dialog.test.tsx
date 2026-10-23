/** The sheet's "Suggest a category" dialog. */
import { act, fireEvent, render, screen } from "@testing-library/react";
jest.mock("~/components/ui/value-select", () =>
  jest.requireActual("~/tests/helpers/native-value-select")
);
jest.mock("~/lib/vault/vault-notifications", () => ({
  vaultNotify: { success: jest.fn(), error: jest.fn() },
}));
jest.mock("~/trpc/react", () => ({
  api: { cards: { suggestCategory: { useMutation: jest.fn() } } },
}));
import { api } from "~/trpc/react";
import { vaultNotify } from "~/lib/vault/vault-notifications";
import { SuggestCategoryDialog } from "~/components/cards/sheet/SuggestCategoryDialog";

interface MutationOptions {
  onSuccess: (result: { status: "sent" | "already" }) => void;
  onError: (error: { message: string }) => void;
}

/** Mocks the mutation and hands back its options, so a test can answer as the server would. */
function mockMutation() {
  const mutate = jest.fn();
  const options: { current?: MutationOptions } = {};
  jest.mocked(api.cards.suggestCategory.useMutation).mockImplementation(((
    opts: MutationOptions
  ) => {
    options.current = opts;
    return { mutate, isPending: false };
  }) as never);
  return { mutate, options };
}

function renderDialog(onOpenChange = jest.fn()) {
  render(
    <SuggestCategoryDialog
      open
      onOpenChange={onOpenChange}
      cardId="c1"
      cardTitle="Kiro"
      current={{ category: null, subcategory: null }}
    />
  );
  return onOpenChange;
}

beforeEach(() => jest.clearAllMocks());

it("sends the picked category, subcategory and note", () => {
  const { mutate } = mockMutation();
  renderDialog();
  expect(screen.getByRole("dialog", { name: "Suggest a category" })).toBeInTheDocument();
  expect(
    screen.getByText("Staff review every suggestion before the card changes.")
  ).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Send suggestion" })).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Category"), { target: { value: "MILITARY" } });
  fireEvent.change(screen.getByLabelText("Subcategory"), { target: { value: "battle-or-war" } });
  fireEvent.change(screen.getByLabelText("Note"), { target: { value: "A battle" } });
  fireEvent.click(screen.getByRole("button", { name: "Send suggestion" }));
  expect(mutate).toHaveBeenCalledWith({
    cardId: "c1",
    choice: { category: "MILITARY", subcategory: "battle-or-war" },
    note: "A battle",
  });
});

it("offers no Uncategorised choice", () => {
  mockMutation();
  renderDialog();
  expect(screen.queryByRole("option", { name: "Uncategorised" })).toBeNull();
});

it("confirms a sent suggestion and closes", () => {
  const { options } = mockMutation();
  const onOpenChange = renderDialog();
  act(() => options.current!.onSuccess({ status: "sent" }));
  expect(vaultNotify.success).toHaveBeenCalledWith(
    "Suggestion sent. Staff review it before the card changes.",
    "Kiro"
  );
  expect(onOpenChange).toHaveBeenCalledWith(false);
});

it("says so when the player already has one open, and stays open", async () => {
  const { options } = mockMutation();
  const onOpenChange = renderDialog();
  act(() => options.current!.onSuccess({ status: "already" }));
  expect(
    await screen.findByText("You already suggested a category for this card")
  ).toBeInTheDocument();
  expect(screen.getByText("Staff have not answered it yet.")).toBeInTheDocument();
  expect(vaultNotify.success).not.toHaveBeenCalled();
  expect(onOpenChange).not.toHaveBeenCalled();
});

it("shows an error from the server", () => {
  const { options } = mockMutation();
  renderDialog();
  options.current!.onError({ message: "You can suggest 10 categories a day. Try again tomorrow." });
  expect(vaultNotify.error).toHaveBeenCalledWith(
    "You can suggest 10 categories a day. Try again tomorrow."
  );
});
