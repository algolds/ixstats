/** The Economy tab's card economy cards: one per section, each saving only its changed numbers. */
import React from "react";
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
import { ECONOMY_FIELDS } from "~/lib/cards/economy-fields";
import { CardEconomyCards } from "~/app/admin/cards/economy/CardEconomyCards";

interface SaveOptions {
  onSuccess: () => void;
  onError: (error: { message: string }) => void;
}

const notify = { success: jest.fn(), error: jest.fn() };
const invalidate = jest.fn();
const invalidateNumbers = jest.fn();
const mutate = jest.fn();
let saveOptions: SaveOptions | null = null;

function setup({ pending = false, initial = CARD_ECONOMY_DEFAULTS } = {}) {
  jest.mocked(useNotify).mockReturnValue(notify as never);
  jest.mocked(api.useUtils).mockReturnValue({
    cards: { admin: { economy: { get: { invalidate } } } },
    crafting: { getNumbers: { invalidate: invalidateNumbers } },
  } as never);
  jest.mocked(api.cards.admin.economy.saveEconomy.useMutation).mockImplementation(((
    options: SaveOptions
  ) => {
    saveOptions = options;
    return { mutate, isPending: pending };
  }) as never);
  render(<CardEconomyCards initial={initial} />);
}

const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
const button = (name: string) => screen.getByRole("button", { name });

const SAVES = [
  "Save finishes",
  "Save daily odds",
  "Save dust",
  "Save crafting",
  "Save listings",
  "Save XP",
];

beforeEach(() => {
  jest.clearAllMocks();
  saveOptions = null;
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

it("labels every number with its stored value, and keeps each Save off until its section changes", () => {
  const stored = { ...CARD_ECONOMY_DEFAULTS, listingFee: 9, xpPack: 15 };
  setup({ initial: stored });
  for (const field of ECONOMY_FIELDS) {
    expect(screen.getByLabelText(field.label)).toHaveValue(stored[field.key]);
  }
  for (const name of SAVES) expect(button(name)).toBeDisabled();
  type("Pack XP", "12");
  expect(button("Save XP")).toBeEnabled();
  expect(button("Save dust")).toBeDisabled();
});

it("steps each input by what the server accepts", () => {
  setup();
  expect(screen.getByLabelText("Holo chance (%)")).toHaveAttribute("step", "0.01");
  expect(screen.getByLabelText("Nation royalty (%)")).toHaveAttribute("step", "0.01");
  expect(screen.getByLabelText("Imported NationStates share")).toHaveAttribute("step", "0.01");
  expect(screen.getByLabelText("Listing fee (IxC)")).toHaveAttribute("step", "1");
  expect(screen.getByLabelText("Copies per fusion")).toHaveAttribute("min", "2");
  expect(screen.getByLabelText("Copies per fusion")).toHaveAttribute("max", "10");
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

it("says it saved and refreshes the tab, or shows the server's sentence", () => {
  setup();
  saveOptions?.onSuccess();
  expect(notify.success).toHaveBeenCalledWith(
    "Economy numbers saved",
    "They apply within a minute."
  );
  expect(invalidate).toHaveBeenCalledTimes(1);
  expect(invalidateNumbers).toHaveBeenCalledTimes(1);
  saveOptions?.onError({ message: "The daily odds add up to 101%. Make them 100%." });
  expect(notify.error).toHaveBeenCalledWith(
    "Economy numbers not saved",
    "The daily odds add up to 101%. Make them 100%."
  );
});

it("keeps every Save off while a save is on its way", () => {
  setup({ pending: true });
  type("Pack XP", "12");
  expect(button("Save XP")).toBeDisabled();
});
