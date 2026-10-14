import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

jest.mock("~/components/vault/IxCreditsSymbol", () => ({ IxCreditsSymbol: () => <i /> }));
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
const mockOpenDaily = jest.fn();
jest.mock("~/components/vault/DailyRewardProvider", () => ({
  useDailyReward: () => ({ open: mockOpenDaily }),
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
  api: {
    vault: new Proxy({}, { get: (_target, name: string) => mockLeaf(name) }),
  },
}));

import { VaultAccountHero } from "~/components/vault/sections/dashboard/VaultAccountHero";

const BALANCE = 12345;
const DECK = 5000;

const renderHero = (props: Partial<React.ComponentProps<typeof VaultAccountHero>> = {}) =>
  render(<VaultAccountHero deckValue={DECK} unopenedPacks={0} {...props} />);

const occurrences = (haystack: string, needle: string) => haystack.split(needle).length - 1;

describe("VaultAccountHero", () => {
  beforeEach(() => {
    mockOpenDaily.mockClear();
    mockLoading = new Set();
    mockErrors = new Set();
    mockData = {
      getBalance: { credits: BALANCE, canClaimDailyBonus: false, loginStreak: 6 },
      getVaultLevel: { vaultLevel: 4 },
      getTodayEarnings: { total: 265, sources: [], transactionCount: 3 },
    };
  });

  it("shows the balance once, with the level, today's earnings and the streak", () => {
    const { container } = renderHero();
    const text = container.textContent ?? "";
    expect(occurrences(text, BALANCE.toLocaleString())).toBe(1);
    expect(text).toContain("Level 4 account");
    expect(text).toContain("+265 today");
    expect(text).toContain("Day 6 streak");
  });

  it("names net worth as the balance plus the deck value", () => {
    renderHero();
    const netWorth = screen
      .getByText("Net worth")
      .closest('[data-slot="net-worth"]') as HTMLElement;
    expect(netWorth.textContent).toContain((BALANCE + DECK).toLocaleString());
  });

  it("shows nothing for today's earnings and the streak when there are none", () => {
    mockData.getTodayEarnings = { total: 0, sources: [], transactionCount: 0 };
    mockData.getBalance = { credits: BALANCE, canClaimDailyBonus: false, loginStreak: 0 };
    const { container } = renderHero();
    expect(container.textContent).not.toMatch(/today|streak/);
  });

  it("offers the daily reward only while it can be claimed", () => {
    const { rerender } = renderHero();
    expect(screen.queryByRole("button", { name: "Claim daily reward" })).toBeNull();

    mockData.getBalance = { credits: BALANCE, canClaimDailyBonus: true, loginStreak: 6 };
    rerender(<VaultAccountHero deckValue={DECK} unopenedPacks={0} />);
    fireEvent.click(screen.getByRole("button", { name: "Claim daily reward" }));
    expect(mockOpenDaily).toHaveBeenCalledTimes(1);
  });

  it("offers packs only when some are waiting, and always the Store", () => {
    const { rerender } = renderHero();
    expect(screen.queryByRole("link", { name: /Open \d+ packs?/ })).toBeNull();
    expect(screen.getByRole("link", { name: "Store" }).getAttribute("href")).toBe("/vault/store");

    rerender(<VaultAccountHero deckValue={DECK} unopenedPacks={2} />);
    expect(screen.getByRole("link", { name: "Open 2 packs" }).getAttribute("href")).toBe(
      "/vault/store?tab=store&view=my-packs"
    );
    rerender(<VaultAccountHero deckValue={DECK} unopenedPacks={1} />);
    expect(screen.getByRole("link", { name: "Open 1 pack" })).not.toBeNull();
  });

  it("does not stand the deck value in for net worth while the balance loads", () => {
    mockLoading = new Set(["getBalance"]);
    const { container } = renderHero();
    expect(occurrences(container.textContent ?? "", DECK.toLocaleString())).toBe(0);
    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
  });

  it("nests no block element inside a paragraph while the figures load", () => {
    mockLoading = new Set(["getBalance"]);
    const { container } = renderHero({ deckValue: undefined, unopenedPacks: 1 });
    expect(container.querySelectorAll("p div")).toHaveLength(0);
  });

  it("shows dashes, not skeletons, when the balance query fails", () => {
    mockErrors = new Set(["getBalance"]);
    const { container } = renderHero();
    expect(container.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(0);
    expect(screen.getAllByLabelText("Unavailable").length).toBeGreaterThanOrEqual(2);
  });

  it("shows a dash for net worth when the deck value failed", () => {
    renderHero({ deckValue: null });
    const netWorth = screen
      .getByText("Net worth")
      .closest('[data-slot="net-worth"]') as HTMLElement;
    expect(netWorth.textContent).toContain("–");
    expect(netWorth.textContent).not.toContain(BALANCE.toLocaleString());
  });
});
