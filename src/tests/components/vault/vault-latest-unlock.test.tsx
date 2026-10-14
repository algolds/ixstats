import React from "react";
import { render, screen } from "@testing-library/react";

jest.mock("~/components/vault/IxCreditsSymbol", () => ({ IxCreditsSymbol: () => <i /> }));
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({
    href,
    children,
    ...rest
  }: { href: string; children: React.ReactNode } & Record<string, unknown>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

let mockSummary: { data?: unknown; isLoading: boolean; isError: boolean };
jest.mock("~/trpc/react", () => ({
  api: { achievements: { getMySummary: { useQuery: () => mockSummary } } },
}));

import { VaultLatestUnlock } from "~/components/vault/sections/dashboard/VaultLatestUnlock";

const summary = (latest: unknown) => ({
  data: { unlocked: 3, activeTotal: 40, points: 90, rank: 2, latest },
  isLoading: false,
  isError: false,
});
const LATEST = {
  key: "first trade",
  title: "First trade",
  rarity: "Epic",
  category: "Cards",
  iconUrl: "Cart",
  reward: 100,
};

describe("VaultLatestUnlock", () => {
  it("shows the newest unlock with its art, rarity and reward, linking to it", () => {
    mockSummary = summary(LATEST);
    const { container } = render(<VaultLatestUnlock />);
    const link = screen.getByRole("link", { name: /First trade/ });
    expect(link.getAttribute("href")).toBe("/vault/achievements?a=first%20trade");
    expect(link.textContent).toContain("Latest unlock");
    expect(link.textContent).toContain("Epic");
    expect(link.textContent).toContain("100");
    expect(link.querySelector('[data-slot="cutout-card"]')).not.toBeNull();
    // The achievement backdrop: aurora, and the foil sheen on an epic unlock.
    expect(container.querySelector(".facet-aurora")).not.toBeNull();
    expect(container.querySelector(".facet-foil")).not.toBeNull();
  });

  it("leaves the foil off a common unlock and the reward off one that pays nothing", () => {
    mockSummary = summary({ ...LATEST, rarity: "Common", reward: null });
    const { container } = render(<VaultLatestUnlock />);
    expect(container.querySelector(".facet-foil")).toBeNull();
    expect(screen.getByRole("link").textContent).not.toMatch(/\d/);
  });

  it("is hidden when there is no unlock yet", () => {
    mockSummary = summary(null);
    const { container } = render(<VaultLatestUnlock />);
    expect(container.firstChild).toBeNull();
  });

  it("is hidden while the summary loads or when it fails", () => {
    mockSummary = { data: undefined, isLoading: true, isError: false };
    const { container, rerender } = render(<VaultLatestUnlock />);
    expect(container.firstChild).toBeNull();
    mockSummary = { data: undefined, isLoading: false, isError: true };
    rerender(<VaultLatestUnlock />);
    expect(container.firstChild).toBeNull();
  });
});
