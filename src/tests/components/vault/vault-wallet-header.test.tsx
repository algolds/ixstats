import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

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
let mockBalance: unknown;
jest.mock("~/trpc/react", () => ({
  api: { vault: { getBalance: { useQuery: () => ({ data: mockBalance }) } } },
}));

import { VaultWalletHeader } from "~/components/vault/sections/dashboard/VaultWalletHeader";

describe("VaultWalletHeader", () => {
  beforeEach(() => {
    mockOpenDaily.mockClear();
    mockBalance = { credits: 10, canClaimDailyBonus: false, loginStreak: 1 };
  });

  it("titles the page Wallet at every width", () => {
    const { container } = render(<VaultWalletHeader />);
    expect(screen.getByRole("heading", { level: 1, name: "Wallet" })).not.toBeNull();
    expect(container.querySelector('[data-shell-page-header="all"]')).not.toBeNull();
  });

  it("offers the daily reward only while it can be claimed, as the one primary", () => {
    const { rerender } = render(<VaultWalletHeader />);
    expect(screen.queryByRole("button", { name: "Claim daily reward" })).toBeNull();

    mockBalance = { credits: 10, canClaimDailyBonus: true, loginStreak: 1 };
    rerender(<VaultWalletHeader />);
    fireEvent.click(screen.getByRole("button", { name: "Claim daily reward" }));
    expect(mockOpenDaily).toHaveBeenCalledTimes(1);
  });

  it("always links to the Store, and offers no pack action", () => {
    render(<VaultWalletHeader />);
    expect(screen.getByRole("link", { name: "Store" }).getAttribute("href")).toBe("/vault/store");
    expect(screen.queryByRole("link", { name: /pack/i })).toBeNull();
  });
});
