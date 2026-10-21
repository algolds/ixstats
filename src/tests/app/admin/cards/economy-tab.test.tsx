import "react";
import { fireEvent, render, screen } from "@testing-library/react";

jest.mock("~/trpc/react", () => ({
  api: {
    useUtils: jest.fn(),
    cards: {
      admin: {
        economy: {
          get: { useQuery: jest.fn() },
          saveValues: { useMutation: jest.fn() },
          recomputeValues: { useMutation: jest.fn() },
          saveMarket: { useMutation: jest.fn() },
          saveBonuses: { useMutation: jest.fn() },
          saveLorewardPayouts: { useMutation: jest.fn() },
          saveRarityThresholds: { useMutation: jest.fn() },
          saveDailyImport: { useMutation: jest.fn() },
          saveEconomy: { useMutation: jest.fn() },
        },
      },
    },
  },
}));
jest.mock("~/hooks/useNotify", () => ({ useNotify: jest.fn() }));

import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { CARD_ECONOMY_DEFAULTS } from "~/lib/cards/economy-config";
import { EconomyTab } from "~/app/admin/cards/economy";

const economy = api.cards.admin.economy;
const table = { UNCOMMON: 21, RARE: 41, ULTRA_RARE: 61, EPIC: 81, LEGENDARY: 96 };
const data = {
  values: {
    floorCommon: 10,
    floorUncommon: 30,
    floorRare: 100,
    floorUltraRare: 300,
    floorEpic: 1000,
    floorLegendary: 3000,
    nsPremium: 1.5,
    multSpecial: 2,
    multNation: 1.5,
    multTrophy: 0.25,
    finishFoil: 3,
    finishHolo: 9,
    levelBonusPerLevel: 0.02,
    levelBonusCap: 0.2,
    medianSales: 5,
    medianDays: 30,
  },
  market: { auctionHouseRakePct: 10, maxInventoryCards: 150 },
  bonuses: {
    enabled: 1,
    newPlayer: 5000,
    nsPerCard: 50,
    nsCap: 5000,
    achievementCommon: 100,
    achievementUncommon: 250,
    achievementRare: 500,
    achievementEpic: 1000,
    achievementLegendary: 2500,
  },
  lorewardPayouts: {
    daily: { winner: 500, "runner-up": 150 },
    weekly: { winner: 1500, "runner-up": 400 },
    monthly: { winner: 4000, "runner-up": 1000 },
  },
  rarityThresholds: { ixwiki: table, iiwiki: table, althistory: table, commons: table },
  dailyImports: {
    ixwiki: { enabled: true, count: 20 },
    iiwiki: { enabled: true, count: 20 },
    althistory: { enabled: false, count: 0 },
  },
  economy: CARD_ECONOMY_DEFAULTS,
};

const mutations = {
  saveValues: jest.fn(),
  recomputeValues: jest.fn(),
  saveMarket: jest.fn(),
  saveBonuses: jest.fn(),
  saveLorewardPayouts: jest.fn(),
  saveRarityThresholds: jest.fn(),
  saveDailyImport: jest.fn(),
  saveEconomy: jest.fn(),
};

const notify = { success: jest.fn(), error: jest.fn() };

const serve = (query: { data?: typeof data; isError?: boolean }) => {
  jest.mocked(useNotify).mockReturnValue(notify as never);
  jest.mocked(api.useUtils).mockReturnValue({
    cards: { admin: { economy: { get: { invalidate: jest.fn() } } } },
  } as never);
  jest.mocked(economy.get.useQuery).mockReturnValue(query as never);
  for (const [name, mutate] of Object.entries(mutations)) {
    jest
      .mocked(economy[name as keyof typeof mutations].useMutation)
      .mockReturnValue({ mutate, isPending: false } as never);
  }
};

const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
const button = (name: string) => screen.getByRole("button", { name });

beforeEach(() => jest.clearAllMocks());

it("saves a bonus, refuses a rarity table that does not rise, and switches a wiki's daily import on", () => {
  serve({ data });
  render(<EconomyTab />);

  type("NationStates import, per card", "60");
  fireEvent.click(button("Save bonuses"));
  expect(mutations.saveBonuses).toHaveBeenCalledWith({ nsPerCard: 60 });

  type("AltHistory Wiki Rare", "10");
  expect(
    screen.getByText("Each rarity needs a higher minimum score than the one below it")
  ).toBeInTheDocument();
  expect(button("Save AltHistory Wiki")).toBeDisabled();

  fireEvent.click(screen.getByRole("switch", { name: "Import from AltHistory Wiki daily" }));
  type("AltHistory Wiki cards a day", "5");
  fireEvent.click(button("Save AltHistory Wiki daily import"));
  expect(mutations.saveDailyImport).toHaveBeenCalledWith({
    source: "althistory",
    setting: { enabled: true, count: 5 },
  });
  expect(mutations.saveRarityThresholds).not.toHaveBeenCalled();
});

it("says a daily import switched on needs a count, and keeps its Save off until it has one", () => {
  serve({ data });
  render(<EconomyTab />);
  const problem = "Set how many cards a day, or switch the daily import off.";
  expect(screen.queryByText(problem)).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("switch", { name: "Import from AltHistory Wiki daily" }));
  expect(screen.getByText(problem)).toBeInTheDocument();
  expect(screen.getByLabelText("AltHistory Wiki cards a day")).toHaveAccessibleDescription(problem);
  expect(button("Save AltHistory Wiki daily import")).toBeDisabled();

  type("AltHistory Wiki cards a day", "5");
  expect(screen.queryByText(problem)).not.toBeInTheDocument();
  expect(button("Save AltHistory Wiki daily import")).toBeEnabled();
});

it("keeps each Save off until something in its section changes", () => {
  serve({ data });
  render(<EconomyTab />);
  for (const name of [
    "Save card values",
    "Save market",
    "Save bonuses",
    "Save payouts",
    "Save IxWiki",
    "Save IxWiki daily import",
  ]) {
    expect(button(name)).toBeDisabled();
  }
  type("Rare floor", "120");
  expect(button("Save card values")).toBeEnabled();
  type("Rare floor", "100");
  expect(button("Save card values")).toBeDisabled();
});

it("sends only the changed card values, and revalues on request", () => {
  serve({ data });
  render(<EconomyTab />);
  type("Rare floor", "120");
  type("Nation card multiplier", "2");
  fireEvent.click(button("Save card values"));
  expect(mutations.saveValues).toHaveBeenCalledWith({ floorRare: 120, multNation: 2 });
  fireEvent.click(button("Revalue every card"));
  expect(mutations.recomputeValues).toHaveBeenCalledTimes(1);
});

it("says when the values were saved but the revalue after them failed", () => {
  serve({ data });
  let result: { updated: number | null } = { updated: null };
  jest.mocked(economy.saveValues.useMutation).mockImplementation(((options: {
    onSuccess: (saved: { updated: number | null }) => void;
  }) => ({
    mutate: () => options.onSuccess(result),
    isPending: false,
  })) as never);
  render(<EconomyTab />);
  type("Rare floor", "120");
  fireEvent.click(button("Save card values"));
  expect(notify.error).toHaveBeenCalledWith(
    "Cards not revalued",
    "The card values are saved. Revalue every card to try again."
  );
  result = { updated: 70_000 };
  fireEvent.click(button("Save card values"));
  expect(notify.success).toHaveBeenCalledWith("Card values saved, 70,000 cards changed value");
});

it("hints and blocks Save for an out-of-range or empty field, with the server's sentence", () => {
  serve({ data });
  render(<EconomyTab />);
  const feeProblem = "Market fee (%): enter a number from 0 to 50 with at most 2 decimal places.";
  type("Market fee (%)", "60");
  expect(screen.getByText(feeProblem)).toBeInTheDocument();
  expect(button("Save market")).toBeDisabled();
  type("Market fee (%)", "");
  expect(screen.getByText(feeProblem)).toBeInTheDocument();
  type("Market fee (%)", "7.555");
  expect(screen.getByText(feeProblem)).toBeInTheDocument();
  type("Market fee (%)", "7.5");
  fireEvent.click(button("Save market"));
  expect(mutations.saveMarket).toHaveBeenCalledWith({ auctionHouseRakePct: 7.5 });

  type("Daily winner", "1.5");
  expect(
    screen.getByText("Daily winner: enter a whole number from 0 to 100,000.")
  ).toBeInTheDocument();
  expect(button("Save payouts")).toBeDisabled();
});

it("saves the trophy, finish, level and median numbers with the card values", () => {
  serve({ data });
  render(<EconomyTab />);
  expect(
    screen.getByText(
      "A copy's value is the highest of floor × type × finish, its finish's market median and, for NationStates cards before their first sale here, the bank value × premium; then the level bonus. Saving revalues every card."
    )
  ).toBeInTheDocument();
  type("Level bonus cap", "0.5");
  type("Market median window (days)", "60");
  fireEvent.click(button("Save card values"));
  expect(mutations.saveValues).toHaveBeenCalledWith({ levelBonusCap: 0.5, medianDays: 60 });
  type("Level bonus per level", "0.3");
  expect(screen.getByLabelText("Level bonus per level")).toHaveAccessibleDescription(
    "Level bonus per level: enter a number from 0 to 0.2."
  );
  expect(button("Save card values")).toBeDisabled();
});
it("saves only the changed Loreward payout cells", () => {
  serve({ data });
  render(<EconomyTab />);
  type("Weekly runner-up", "450");
  fireEvent.click(button("Save payouts"));
  expect(mutations.saveLorewardPayouts).toHaveBeenCalledWith([
    { type: "weekly", place: "runner-up", credits: 450 },
  ]);
});

it("switches bonus payments off at once", () => {
  serve({ data });
  render(<EconomyTab />);
  fireEvent.click(screen.getByRole("switch", { name: "Pay bonuses" }));
  expect(mutations.saveBonuses).toHaveBeenCalledWith({ enabled: 0 });
});

it("refuses floors that do not rise with rarity, and a floor over its ceiling", () => {
  serve({ data });
  render(<EconomyTab />);
  type("Epic floor", "10");
  expect(
    screen.getByText("Each rarity needs a floor at least as high as the one below it")
  ).toBeInTheDocument();
  expect(button("Save card values")).toBeDisabled();
  type("Epic floor", "2000000");
  expect(screen.getByText("Epic floor: enter a number from 0 to 1,000,000.")).toBeInTheDocument();
  type("Epic floor", "1500");
  expect(button("Save card values")).toBeEnabled();
});
