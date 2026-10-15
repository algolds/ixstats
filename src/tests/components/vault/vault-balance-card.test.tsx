import React from "react";
import { render, screen } from "@testing-library/react";

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
const deckLine = (container: HTMLElement) =>
  container.querySelector('[data-slot="deck-line"]') as HTMLElement;

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
    // The streak is a pill beside the level, seen as "6d" and read as "6 day streak".
    expect(container.querySelector("[data-slot='streak-pill']")?.textContent).toBe(
      "6d6 day streak"
    );
    expect(lead(container).querySelector('[data-slot="stat-value"]')).toHaveClass(
      "text-large-title"
    );
  });

  it("lays a tinted chevron texture across the card, under the content and not on the figures", () => {
    const { container } = renderCard();
    const root = container.querySelector('[data-slot="vault-balance-card"]') as HTMLElement;
    expect(root.className).toContain("overflow-hidden");
    const texture = root.querySelector(":scope > .facet-texture-chevron") as HTMLElement;
    expect(texture).not.toBeNull();
    expect(texture.className).toContain("[--facet-texture-color:var(--tint)]");
    expect(root.querySelectorAll(".texture-overlay")).toHaveLength(1);
    expect(texture.contains(lead(container))).toBe(false);
    for (const content of Array.from(root.children).filter((el) => el !== texture)) {
      expect(content.className).toContain("relative");
    }
  });

  it("has no claim button: the daily reward lives in the Vault column", () => {
    mockData.getBalance = { credits: BALANCE, canClaimDailyBonus: true, loginStreak: 6 };
    renderCard();
    expect(screen.queryByRole("button")).toBeNull();
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

  it("has one headline figure, the spendable balance, and no net worth or split bar", () => {
    const { container } = renderCard();
    expect(container.querySelectorAll('[data-slot="stat"]')).toHaveLength(1);
    expect(container.textContent).not.toMatch(/net worth/i);
    expect(container.textContent).not.toContain((BALANCE + DECK).toLocaleString());
    expect(container.querySelector('[data-slot="net-worth"]')).toBeNull();
    expect(screen.queryByRole("progressbar")).toBeNull();
  });

  it("says what the deck is worth on one secondary line, in a md-padded card", () => {
    const { container } = renderCard();
    const card = container.querySelector('[data-slot="vault-balance-card"]') as HTMLElement;
    expect(card.className).toContain("p-4 md:p-5");
    expect(deckLine(container).textContent).toBe(
      `Your 12 cards are worth ${DECK.toLocaleString()}`
    );
    expect(card.contains(deckLine(container))).toBe(true);
  });

  it("uses the singular for a single card", () => {
    const { container } = renderCard({ totalCards: 1 });
    expect(deckLine(container).textContent).toContain("Your 1 card is worth");
  });

  it("says No cards yet for an empty deck", () => {
    const { container } = renderCard({ totalCards: 0, deckValue: 0 });
    expect(deckLine(container).textContent).toBe("No cards yet");
  });

  it("has no separate pack box", () => {
    const { container } = renderCard();
    expect(container.textContent).not.toMatch(/pack/i);
  });

  it("shows no card figures while the stats load", () => {
    const { container } = renderCard({ totalCards: undefined, deckValue: undefined });
    expect(deckLine(container).querySelector('[data-slot="skeleton"]')).not.toBeNull();
    expect(deckLine(container).textContent).not.toMatch(/\d|No cards/);
  });

  it("shows a skeleton, not a fake zero, for the balance while it loads", () => {
    mockLoading = new Set(["getBalance"]);
    const { container } = renderCard();
    expect(lead(container).querySelector('[data-slot="skeleton"]')).not.toBeNull();
    expect(lead(container).textContent).not.toMatch(/\b0\b/);
  });

  it("shows dashes, not skeletons, when the balance query fails", () => {
    mockErrors = new Set(["getBalance"]);
    const { container } = renderCard();
    expect(lead(container).querySelectorAll('[data-slot="skeleton"]')).toHaveLength(0);
    expect(lead(container).querySelector('[aria-label="Unavailable"]')).not.toBeNull();
    expect(container.textContent).not.toContain(BALANCE.toLocaleString());
  });

  it("shows a dash for the card line when the stats failed", () => {
    const { container } = renderCard({ deckValue: null, totalCards: null });
    expect(deckLine(container).querySelector('[aria-label="Unavailable"]')).not.toBeNull();
    expect(deckLine(container).textContent).not.toMatch(/\d+ cards?/);
  });

  it("nests no block element inside a paragraph or a span, loaded or loading", () => {
    const { container, rerender } = renderCard();
    expect(container.querySelectorAll("p div, span div")).toHaveLength(0);
    mockLoading = new Set(["getBalance"]);
    rerender(<VaultBalanceCard totalCards={undefined} deckValue={undefined} />);
    expect(container.querySelectorAll("p div, span div")).toHaveLength(0);
  });
});
