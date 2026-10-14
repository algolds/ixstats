import React from "react";
import { render, screen, within } from "@testing-library/react";

jest.mock("~/components/vault/IxCreditsSymbol", () => ({ IxCreditsSymbol: () => <i /> }));
// The real flow renders into a shadow root; the plain text is what the figures say.
jest.mock("~/components/ui/number-flow", () => ({
  NumberFlowDisplay: ({ value }: { value: number }) => <span>{value.toLocaleString()}</span>,
}));

let mockLoading = new Set<string>();
let mockErrors = new Set<string>();
let mockData: Record<string, unknown> = {};
const mockLeaf = (name: string) => ({
  useQuery: () => {
    const isLoading = mockLoading.has(name);
    const isError = mockErrors.has(name);
    return { data: isLoading || isError ? undefined : mockData[name], isLoading, isError };
  },
});
jest.mock("~/trpc/react", () => ({
  api: { vault: new Proxy({}, { get: (_target, name: string) => mockLeaf(name) }) },
}));

import { VaultBalanceCard } from "~/components/vault/sections/dashboard/VaultBalanceCard";

const BALANCE = 12345;
const DECK = 5000;

const renderCard = (props: Partial<React.ComponentProps<typeof VaultBalanceCard>> = {}) =>
  render(<VaultBalanceCard totalCards={12} deckValue={DECK} {...props} />);

const lead = (container: HTMLElement) =>
  container.querySelector('[data-slot="stat"]') as HTMLElement;
const netWorth = (container: HTMLElement) =>
  container.querySelector('[data-slot="net-worth"]') as HTMLElement;

describe("VaultBalanceCard", () => {
  beforeEach(() => {
    mockLoading = new Set();
    mockErrors = new Set();
    mockData = {
      getBalance: { credits: BALANCE, canClaimDailyBonus: false, loginStreak: 6 },
      getVaultLevel: { vaultLevel: 4 },
      getTodayEarnings: { total: 265, sources: [], transactionCount: 3 },
    };
  });

  it("leads with the balance, the collector level, today's earnings and the streak", () => {
    const { container } = renderCard();
    expect(screen.getByText("Level 4 collector")).not.toBeNull();
    expect(lead(container).textContent).toContain(BALANCE.toLocaleString());
    expect(lead(container).textContent).toContain("IxCredits");
    expect(lead(container).textContent).toContain("+265 today");
    expect(lead(container).textContent).toContain("Day 6 streak");
    expect(lead(container).querySelector('[data-slot="stat-value"]')).toHaveClass(
      "text-large-title"
    );
  });

  it("titles the card Balance", () => {
    renderCard();
    expect(screen.getByText("Balance").getAttribute("data-slot")).toBe("card-title");
  });

  it("shows nothing for today's earnings, the streak and the level when there are none", () => {
    mockData.getTodayEarnings = { total: 0, sources: [], transactionCount: 0 };
    mockData.getBalance = { credits: BALANCE, canClaimDailyBonus: false, loginStreak: 0 };
    delete mockData.getVaultLevel;
    const { container } = renderCard();
    expect(container.textContent).not.toMatch(/today|streak|collector/);
  });

  it("names net worth as the balance plus the deck value, in one well", () => {
    const { container } = renderCard();
    const well = netWorth(container);
    expect(well.getAttribute("data-variant")).toBe("well");
    expect(well.textContent).toContain("Net worth");
    expect(well.textContent).toContain((BALANCE + DECK).toLocaleString());
  });

  it("splits net worth into credits and cards, with the card count and value", () => {
    const { container } = renderCard();
    const well = netWorth(container);
    expect(within(well).getByText(/^Credits/).textContent).toContain(BALANCE.toLocaleString());
    const cards = within(well).getByText(/12 cards/);
    expect(cards.textContent).toContain(DECK.toLocaleString());
    const bar = within(well).getByRole("progressbar");
    expect(bar.getAttribute("aria-valuenow")).toBe(String(BALANCE));
    expect(bar.getAttribute("aria-valuemax")).toBe(String(BALANCE + DECK));
  });

  it("uses the singular for a single card", () => {
    const { container } = renderCard({ totalCards: 1 });
    expect(netWorth(container).textContent).toContain("1 card ");
    expect(netWorth(container).textContent).not.toContain("1 cards");
  });

  it("has no separate pack or deck-value box", () => {
    const { container } = renderCard();
    expect(container.textContent).not.toMatch(/pack|deck value/i);
  });

  it("draws no split bar when there is nothing to split", () => {
    mockData.getBalance = { credits: 0, canClaimDailyBonus: false, loginStreak: 0 };
    renderCard({ deckValue: 0, totalCards: 0 });
    expect(screen.queryByRole("progressbar")).toBeNull();
  });

  it("does not stand the deck value in for net worth while the balance loads", () => {
    mockLoading = new Set(["getBalance"]);
    const { container } = renderCard();
    expect(container.textContent).not.toContain(DECK.toLocaleString() + " ");
    expect(netWorth(container).textContent).not.toContain((BALANCE + DECK).toLocaleString());
    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(container.textContent).not.toMatch(/\b0\b/);
  });

  it("shows no card figures while the stats load", () => {
    const { container } = renderCard({ totalCards: undefined, deckValue: undefined });
    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
    expect(netWorth(container).textContent).not.toMatch(/\d+ cards?/);
    expect(netWorth(container).textContent).not.toContain((BALANCE + DECK).toLocaleString());
  });

  it("shows dashes, not skeletons, when the balance query fails", () => {
    mockErrors = new Set(["getBalance"]);
    const { container } = renderCard();
    expect(container.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(0);
    expect(screen.getAllByLabelText("Unavailable").length).toBeGreaterThanOrEqual(2);
    expect(container.textContent).not.toContain(BALANCE.toLocaleString());
  });

  it("shows a dash for net worth and the card figures when the stats failed", () => {
    const { container } = renderCard({ deckValue: null, totalCards: null });
    const well = netWorth(container);
    expect(well.querySelectorAll('[aria-label="Unavailable"]').length).toBeGreaterThanOrEqual(2);
    expect(well.textContent).not.toContain((BALANCE + DECK).toLocaleString());
    expect(well.textContent).not.toMatch(/\d+ cards?/);
    expect(screen.queryByRole("progressbar")).toBeNull();
  });

  it("nests no block element inside a paragraph, loaded or loading", () => {
    const { container, rerender } = renderCard();
    expect(container.querySelectorAll("p div")).toHaveLength(0);
    mockLoading = new Set(["getBalance"]);
    rerender(<VaultBalanceCard totalCards={undefined} deckValue={undefined} />);
    expect(container.querySelectorAll("p div")).toHaveLength(0);
  });
});
