/** The Economy tab's card economy cards: one per section, each saving only its changed numbers. */
import "react";
import { fireEvent, render, screen } from "@testing-library/react";

jest.mock("~/hooks/useNotify", () => ({ useNotify: jest.fn() }));
jest.mock("~/trpc/react", () => ({
  api: {
    cards: { admin: { economy: { saveEconomy: { useMutation: jest.fn() } } } },
    useUtils: jest.fn(),
  },
}));

import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { CARD_ECONOMY_DEFAULTS } from "~/lib/cards/economy-config";
import { CardEconomyCards } from "~/app/admin/cards/economy/CardEconomyCards";

const notify = { success: jest.fn(), error: jest.fn() };
const invalidate = jest.fn();
const invalidateNumbers = jest.fn();
const mutate = jest.fn();

function setup({ pending = false, initial = CARD_ECONOMY_DEFAULTS } = {}) {
  jest.mocked(useNotify).mockReturnValue(notify as never);
  jest.mocked(api.useUtils).mockReturnValue({
    cards: { admin: { economy: { get: { invalidate } } } },
    crafting: { getNumbers: { invalidate: invalidateNumbers } },
  } as never);
  jest.mocked(api.cards.admin.economy.saveEconomy.useMutation).mockReturnValue({ mutate, isPending: pending } as never);
  render(<CardEconomyCards initial={initial} />);
}

const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
const button = (name: string) => screen.getByRole("button", { name });
beforeEach(() => {
  jest.clearAllMocks();
});

it("shows each section and saves only the changed numbers of one", () => {
  setup();
  for (const title of [
    "Finish roll at mint",
    "Daily card odds",
    "Dust",
    "Crafting and fusion",
    "Listings and royalty",
    "Card XP",
  ]) {
    expect(screen.getByText(title)).toBeInTheDocument();
  }
  type("Holo chance (%)", "3");
  fireEvent.click(button("Save finishes"));
  expect(mutate).toHaveBeenCalledWith({ finishHoloPct: 3 });
});
it("refuses a rate finer than a hundredth before it reaches the server", () => {
  setup();
  type("Nation royalty (%)", "2.555");
  const problem = "Nation royalty (%): enter a number from 0 to 50 with at most 2 decimal places.";
  expect(screen.getByLabelText("Nation royalty (%)")).toHaveAccessibleDescription(problem);
  expect(screen.getByLabelText("Nation royalty (%)")).toHaveAttribute("aria-invalid", "true");
  expect(button("Save listings")).toBeDisabled();
  type("Nation royalty (%)", "2.55");
  fireEvent.click(button("Save listings"));
  expect(mutate).toHaveBeenCalledWith({ royaltyPct: 2.55 });
});

it("announces a section rule a change breaks, and saves once it holds", () => {
  setup();
  type("Holo chance (%)", "93");
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Foil and Holo chances add up to 101%. Keep them at 100% or less."
  );
  expect(button("Save finishes")).toBeDisabled();
  type("Holo chance (%)", "2");

  type("Rare (%)", "8");
  expect(screen.getByRole("alert")).toHaveTextContent(
    "The daily odds add up to 101%. Make them 100%."
  );
  expect(button("Save daily odds")).toBeDisabled();
  type("Common (%)", "64");
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  fireEvent.click(button("Save daily odds"));
  expect(mutate).toHaveBeenCalledWith({ dailyCommonPct: 64, dailyRarePct: 8 });
});

it("checks the dust loop against the stored dust multiples when fusion changes", () => {
  setup();
  type("Copies per fusion", "2");
  expect(screen.getByRole("alert")).toHaveTextContent(
    "The Foil dust multiple can be at most the copies per fusion, 2, or fusing would make dust."
  );
  expect(button("Save crafting")).toBeDisabled();
});
