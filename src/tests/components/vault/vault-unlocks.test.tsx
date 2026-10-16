import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

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
let mockNext: { data?: unknown } = {};
jest.mock("~/trpc/react", () => ({
  api: {
    achievements: {
      getMySummary: { useQuery: () => mockSummary },
      getNextUnlock: { useQuery: () => mockNext },
    },
  },
}));

import { getCategoryTheme } from "~/components/achievements/constants";
import { accentColor } from "~/lib/design/identity";
import { VaultUnlocks } from "~/components/vault/sections/dashboard/VaultUnlocks";

const summary = (latest: unknown, ...older: unknown[]) => ({
  data: {
    unlocked: 3,
    activeTotal: 40,
    points: 90,
    rank: 2,
    recent: latest ? [latest, ...older] : [],
  },
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

describe("VaultUnlocks", () => {
  beforeEach(() => {
    mockNext = {};
  });

  it("shows the newest unlock with its art, rarity and reward, linking to it", () => {
    mockSummary = summary(LATEST);
    const { container } = render(<VaultUnlocks />);
    const link = screen.getByRole("link", { name: /First trade/ });
    expect(link.getAttribute("href")).toBe("/vault/achievements?a=first%20trade");
    expect(link.textContent).toContain("Newest");
    expect(link.textContent).toContain("Epic");
    expect(link.textContent).toContain("100");
    expect(link.querySelector('[data-slot="cutout-card"]')).not.toBeNull();
    // The achievement backdrop: aurora, and the foil sheen on an epic unlock.
    expect(container.querySelector(".facet-aurora")).not.toBeNull();
    expect(container.querySelector(".facet-foil")).not.toBeNull();
  });

  it("themes the art by the achievement's category and draws its own icon on the pedestal", () => {
    mockSummary = summary(LATEST);
    const { container } = render(<VaultUnlocks />);
    const theme = getCategoryTheme("Cards");
    const aurora = container.querySelector(".facet-aurora") as HTMLElement;
    expect(aurora.style.getPropertyValue("--facet-accent-2")).toBe(accentColor(theme.accent2));
    const art = container.querySelector('[data-slot="vault-unlocks"] svg') as SVGElement;
    expect(art.getAttribute("class")).toContain("drop-shadow-md");
    expect(art.parentElement!.className).toContain(theme.pedestal);
  });

  it("falls back to the General theme and the trophy art for an unknown category and icon", () => {
    mockSummary = summary({ ...LATEST, category: "Nonsense", iconUrl: null, rarity: "Rare" });
    const { container } = render(<VaultUnlocks />);
    const theme = getCategoryTheme("General");
    const aurora = container.querySelector(".facet-aurora") as HTMLElement;
    expect(aurora.style.getPropertyValue("--facet-accent-2")).toBe(accentColor(theme.accent2));
    expect(container.querySelector(".facet-foil")).toBeNull();
    const art = container.querySelector('[data-slot="vault-unlocks"] svg') as SVGElement;
    expect(art.parentElement!.className).toContain(theme.pedestal);
  });

  it("leaves the foil off a common unlock and the reward off one that pays nothing", () => {
    mockSummary = summary({ ...LATEST, rarity: "Common", reward: null });
    const { container } = render(<VaultUnlocks />);
    expect(container.querySelector(".facet-foil")).toBeNull();
    expect(screen.getByRole("link").textContent).not.toMatch(/\d/);
  });

  it("swipes through the newest unlocks, then the nearest locked achievement with its progress", () => {
    mockSummary = summary(
      LATEST,
      { ...LATEST, key: "b", title: "Second" },
      { ...LATEST, key: "c", title: "Third" }
    );
    mockNext = {
      data: {
        key: "d",
        title: "Tycoon",
        rarity: "Legendary",
        category: "Cards",
        iconUrl: null,
        current: 40,
        target: 50,
      },
    };
    const { container } = render(<VaultUnlocks />);
    const slides = screen.getAllByRole("link");
    expect(slides.map((a) => a.textContent)).toEqual([
      expect.stringContaining("Newest"),
      expect.stringContaining("Second"),
      expect.stringContaining("Third"),
      expect.stringContaining("Next up, 40 of 50"),
    ]);
    expect(slides[3]!.getAttribute("href")).toBe("/vault/achievements?a=d");
    expect(screen.getByRole("progressbar", { name: "Tycoon progress" })).toBeInTheDocument();
    // A locked achievement wears no foil, even a legendary one.
    expect(slides[3]!.querySelector(".facet-foil")).toBeNull();
    expect(container.querySelector(".snap-x.snap-mandatory")).not.toBeNull();

    const dots = screen.getAllByRole("button", { name: /Show achievement/ });
    expect(dots).toHaveLength(4);
    expect(dots[0]).toHaveAttribute("aria-current", "true");
    const track = container.querySelector(".snap-x") as HTMLElement;
    track.scrollTo = jest.fn();
    fireEvent.click(dots[3]!);
    expect(track.scrollTo).toHaveBeenCalled();
  });

  it("shows the nearest locked achievement alone, without dots, before any unlock", () => {
    mockSummary = summary(null);
    mockNext = {
      data: {
        key: "d",
        title: "Tycoon",
        rarity: "Rare",
        category: "Cards",
        iconUrl: null,
        current: 1,
        target: 4,
      },
    };
    render(<VaultUnlocks />);
    expect(screen.getByRole("link").textContent).toContain("Next up, 1 of 4");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("is hidden when there is no unlock yet", () => {
    mockSummary = summary(null);
    const { container } = render(<VaultUnlocks />);
    expect(container.firstChild).toBeNull();
  });

  it("is hidden while the summary loads or when it fails", () => {
    mockSummary = { data: undefined, isLoading: true, isError: false };
    const { container, rerender } = render(<VaultUnlocks />);
    expect(container.firstChild).toBeNull();
    mockSummary = { data: undefined, isLoading: false, isError: true };
    rerender(<VaultUnlocks />);
    expect(container.firstChild).toBeNull();
  });
});
