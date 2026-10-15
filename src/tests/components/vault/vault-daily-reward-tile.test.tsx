import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";

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

  it("while claimable: a tint-fill tile with a chevron texture, the Gift in a well, the streak and the one primary", () => {
    const { container } = render(<DailyRewardTile />);
    const el = tile(container);
    expect(el.getAttribute("data-state")).toBe("ready");
    expect(el.className).toContain("bg-tint-fill");
    expect(el.className).toContain("overflow-hidden");
    const texture = el.querySelector(":scope > .facet-texture-chevron") as HTMLElement;
    expect(texture.className).toContain("[--facet-texture-color:var(--tint)]");
    expect(el.querySelector("span.bg-tint-fill svg")).not.toBeNull();
    expect(el.textContent).toContain("Daily reward ready");
    expect(el.querySelector('[data-slot="streak-pill"]')).not.toBeNull();
    expect(el.textContent).not.toContain("Day 5 streak");
    const claim = screen.getByRole("button", { name: "Claim daily reward" });
    expect(claim.className).toMatch(/bg-primary-fill/);
    expect(screen.getAllByRole("button")).toHaveLength(1);
    fireEvent.click(claim);
    expect(mockOpen).toHaveBeenCalledTimes(1);
  });

  it("leaves the streak out when there is none", () => {
    mockBalance = { data: { credits: 10, canClaimDailyBonus: true, loginStreak: 0 } };
    const { container } = render(<DailyRewardTile />);
    expect(tile(container).querySelector('[data-slot="streak-pill"]')).toBeNull();
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

  it("shows nothing while the balance loads or fails, rather than guessing a state", () => {
    mockBalance = { data: undefined };
    const { container } = render(<DailyRewardTile />);
    expect(container.firstChild).toBeNull();
  });
});
