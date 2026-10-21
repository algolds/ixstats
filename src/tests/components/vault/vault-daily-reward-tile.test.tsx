import "react";
import { act, render, screen } from "@testing-library/react";

const mockOpen = jest.fn();
jest.mock("~/components/vault/DailyRewardProvider", () => ({
  useDailyReward: () => ({ open: mockOpen }),
}));
let mockBalance: { data?: unknown };
jest.mock("~/trpc/react", () => ({
  api: { vault: { getBalance: { useQuery: () => mockBalance } } },
}));

import { DailyRewardTile } from "~/components/vault/sections/dashboard/DailyRewardTile";

const tile = (container: HTMLElement) =>
  container.querySelector('[data-slot="daily-reward-tile"]') as HTMLElement;

describe("DailyRewardTile", () => {
  beforeEach(() => {
    mockOpen.mockClear();
    mockBalance = { data: { credits: 10, canClaimDailyBonus: true, loginStreak: 5 } };
  });
  it("settles into a quiet row once claimed: no texture, no button, the next claim time", () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-10-14T18:00:00Z"));
    mockBalance = { data: { credits: 10, canClaimDailyBonus: false, loginStreak: 5 } };
    const { container } = render(<DailyRewardTile />);
    act(() => {
      jest.runOnlyPendingTimers();
    });
    const el = tile(container);
    expect(el.getAttribute("data-state")).toBe("claimed");
    expect(el.textContent).toContain("Daily reward claimed");
    expect(el.textContent).toContain("Next reward in 6h");
    expect(container.querySelector(".texture-overlay")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
    expect(el.className).not.toContain("bg-tint-fill");
    jest.useRealTimers();
  });

  it("changes state when the claim lands (the balance refetches)", async () => {
    const { container, rerender } = render(<DailyRewardTile />);
    expect(tile(container).getAttribute("data-state")).toBe("ready");
    mockBalance = { data: { credits: 60, canClaimDailyBonus: false, loginStreak: 6 } };
    rerender(<DailyRewardTile />);
    expect(await screen.findByText("Daily reward claimed")).not.toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
