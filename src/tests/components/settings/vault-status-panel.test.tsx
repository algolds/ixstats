import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

jest.mock("~/components/vault/DailyRewardProvider", () => ({ useDailyReward: jest.fn() }));
jest.mock("~/hooks/vault/useVaultBalance", () => ({
  useVaultBalance: () => ({
    balance: 100,
    lifetimeEarned: 0,
    lifetimeSpent: 0,
    todayEarned: 0,
    vaultLevel: 1,
    vaultXp: 0,
    loginStreak: 3,
    isLoading: false,
    refresh: jest.fn(),
  }),
}));
jest.mock("~/trpc/react", () => ({
  api: { useUtils: () => ({ vault: { invalidate: jest.fn() } }) },
}));
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

import { useDailyReward } from "~/components/vault/DailyRewardProvider";
import { VaultStatusPanel } from "~/app/settings/_components/panels/VaultStatusPanel";

describe("VaultStatusPanel", () => {
  it("opens the one daily reward instead of claiming a second bonus", () => {
    const open = jest.fn();
    jest.mocked(useDailyReward).mockReturnValue({ open });
    render(<VaultStatusPanel />);
    expect(screen.queryByRole("button", { name: /Claim daily bonus/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Open daily reward" }));
    expect(open).toHaveBeenCalled();
  });

  it("names the row the daily reward, with the streak so far", () => {
    jest.mocked(useDailyReward).mockReturnValue({ open: jest.fn() });
    render(<VaultStatusPanel />);
    expect(screen.getByText("Daily reward")).toBeInTheDocument();
    expect(
      screen.getByText("Claim credits or a card once a day (3 days in a row so far)")
    ).toBeInTheDocument();
  });
});
