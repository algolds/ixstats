import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";

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
// The detail modal is lazy-loaded; a stub that names the open card is enough here.
jest.mock("next/dynamic", () => () => {
  const Modal = ({ card, open }: { card: { title: string } | null; open: boolean }) =>
    open && card ? <div role="dialog">Details of {card.title}</div> : null;
  return Modal;
});
jest.mock("~/components/cards/display/CardHolographicCover", () => ({
  CardHolographicCover: ({ title }: { title?: string }) => <div data-testid="cover">{title}</div>,
}));
jest.mock("~/components/cards/pack-opening/PackHolographicCover", () => ({
  PackHolographicCover: ({ packName }: { packName?: string }) => (
    <div data-testid="pack-art">{packName}</div>
  ),
}));

let mockTop: { data?: unknown; isLoading: boolean; isError: boolean };
let mockPacks: { data?: unknown; isLoading: boolean; isError: boolean };
const mockTopQuery = jest.fn();
jest.mock("~/trpc/react", () => ({
  api: {
    cards: {
      getMyTopCards: {
        useQuery: (input: unknown) => {
          mockTopQuery(input);
          return mockTop;
        },
      },
    },
    cardPacks: { getMyPacks: { useQuery: () => mockPacks } },
  },
}));

import { VaultShowcase } from "~/components/vault/sections/dashboard/VaultShowcase";

const ownership = (
  id: string,
  title: string,
  rarity: string,
  marketValue: number,
  art?: string
) => ({
  id: `own-${id}`,
  isLocked: false,
  level: 1,
  experience: 0,
  serialNumber: 1,
  lastSalePrice: null,
  lastSaleDate: null,
  acquiredAt: new Date(0),
  createdAt: new Date(0),
  updatedAt: new Date(0),
  cards: {
    id,
    title,
    rarity,
    marketValue,
    cardType: "NS_IMPORT",
    category: null,
    artwork: art ?? null,
    artworkUrl: null,
    wikiImageUrl: null,
    wikiSource: null,
    season: 1,
    stats: {},
    description: null,
  },
});

const TOP = [
  ownership("c1", "Ostrozava 1st Ed.", "LEGENDARY", 2400, "/art/c1.png"),
  ownership("c2", "Velarc Throne", "EPIC", 1150, "/art/c2.png"),
  ownership("c3", "Kirav Lighthouse", "ULTRA_RARE", 820),
];
const PACKS = (count: number) => ({
  success: true,
  packs: Array.from({ length: count }, (_, i) => ({
    id: `up${i}`,
    pack: { id: "p1", name: "Season III Veteran Pack", packType: "PREMIUM", artwork: null },
  })),
});

describe("VaultShowcase", () => {
  beforeEach(() => {
    mockTopQuery.mockClear();
    mockTop = { data: TOP, isLoading: false, isError: false };
    mockPacks = { data: PACKS(0), isLoading: false, isError: false };
  });

  it("headlines the section Showcase, in sentence case, with no eyebrow", () => {
    const { container } = render(<VaultShowcase />);
    const heading = screen.getByRole("heading", { level: 2, name: "Showcase" });
    expect(heading.className).not.toMatch(/uppercase|eyebrow/);
    expect(
      container.querySelector('[data-slot="vault-showcase"]')?.getAttribute("data-content")
    ).toBe("collectible");
  });

  it("asks for the three most valuable cards and shows each with title, rarity and value", () => {
    render(<VaultShowcase />);
    expect(mockTopQuery).toHaveBeenCalledWith({ limit: 3 });
    const cards = screen.getAllByRole("button");
    expect(cards.map((card) => card.getAttribute("aria-label"))).toEqual([
      "View Ostrozava 1st Ed.",
      "View Velarc Throne",
      "View Kirav Lighthouse",
    ]);
    expect(cards[0]!.textContent).toContain("Legendary");
    expect(cards[0]!.textContent).toContain("2,400");
    expect(cards[2]!.textContent).toContain("Ultra rare");
    expect(cards[2]!.textContent).toContain("820");
  });

  it("shows the card's real art with alt text, and the procedural cover when it has none", () => {
    render(<VaultShowcase />);
    const first = screen.getByRole("button", { name: "View Ostrozava 1st Ed." });
    expect(within(first).getByAltText("Ostrozava 1st Ed.").getAttribute("src")).toContain("c1.png");
    const bare = screen.getByRole("button", { name: "View Kirav Lighthouse" });
    expect(within(bare).getByTestId("cover").textContent).toBe("Kirav Lighthouse");
  });

  it("opens a card's detail when it is chosen", () => {
    render(<VaultShowcase />);
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "View Velarc Throne" }));
    expect(screen.getByRole("dialog").textContent).toBe("Details of Velarc Throne");
  });

  it("adds no pack card when no pack is waiting", () => {
    render(<VaultShowcase />);
    expect(screen.queryByText(/waiting/)).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("adds one pack card linking to My packs when packs are waiting", () => {
    mockPacks = { data: PACKS(2), isLoading: false, isError: false };
    render(<VaultShowcase />);
    const link = screen.getByRole("link", { name: /2 packs waiting/ });
    expect(link.getAttribute("href")).toBe("/vault/store?tab=store&view=my-packs");
    expect(within(link).getByTestId("pack-art").textContent).toBe("Season III Veteran Pack");
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });

  it("uses the singular for one waiting pack", () => {
    mockPacks = { data: PACKS(1), isLoading: false, isError: false };
    render(<VaultShowcase />);
    expect(screen.getByRole("link", { name: /1 pack waiting/ })).not.toBeNull();
  });

  it("says what is missing, with one action to the Store, for an empty collection", () => {
    mockTop = { data: [], isLoading: false, isError: false };
    render(<VaultShowcase />);
    expect(screen.getByText("No cards yet")).not.toBeNull();
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]!.getAttribute("href")).toBe("/vault/store");
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("does not call the collection empty while the packs load", () => {
    mockTop = { data: [], isLoading: false, isError: false };
    mockPacks = { data: undefined, isLoading: true, isError: false };
    const { container } = render(<VaultShowcase />);
    expect(screen.queryByText("No cards yet")).toBeNull();
    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
  });

  it("does not call the collection empty when the packs could not be read", () => {
    mockTop = { data: [], isLoading: false, isError: false };
    mockPacks = { data: undefined, isLoading: false, isError: true };
    render(<VaultShowcase />);
    expect(screen.queryByText("No cards yet")).toBeNull();
    expect(screen.getByText("Your showcase is unavailable")).not.toBeNull();
  });

  it("shows the cards at once while the packs load, and when the packs fail", () => {
    mockPacks = { data: undefined, isLoading: true, isError: false };
    const { unmount } = render(<VaultShowcase />);
    expect(screen.getAllByRole("button")).toHaveLength(3);
    unmount();
    mockPacks = { data: undefined, isLoading: false, isError: true };
    render(<VaultShowcase />);
    expect(screen.getAllByRole("button")).toHaveLength(3);
  });

  it("keeps the tiles at a fixed collectible width and the art uncropped", () => {
    const { container } = render(<VaultShowcase />);
    const grid = container.querySelector(".grid") as HTMLElement;
    expect(grid.getAttribute("style")).toMatch(/opacity/);
    expect(grid.className).toMatch(/auto-fill,minmax\(9\.5rem,11rem\)/);
    const img = screen.getByAltText("Ostrozava 1st Ed.");
    expect(img.className).toContain("object-contain");
    expect(img.parentElement!.className).toContain("aspect-[5/7]");
  });

  it("shows only the pack card, not the empty state, for a player with packs but no cards", () => {
    mockTop = { data: [], isLoading: false, isError: false };
    mockPacks = { data: PACKS(3), isLoading: false, isError: false };
    render(<VaultShowcase />);
    expect(screen.queryByText("No cards yet")).toBeNull();
    expect(screen.getByRole("link", { name: /3 packs waiting/ })).not.toBeNull();
  });

  it("shows skeletons, not an empty state, while the cards load", () => {
    mockTop = { data: undefined, isLoading: true, isError: false };
    const { container } = render(<VaultShowcase />);
    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
    expect(screen.queryByText("No cards yet")).toBeNull();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    // The entrance belongs to the cards, not the placeholders.
    expect(container.querySelector(".grid")?.getAttribute("style") ?? "").toBe("");
  });

  it("says the showcase is unavailable when the cards fail to load", () => {
    mockTop = { data: undefined, isLoading: false, isError: true };
    const { container } = render(<VaultShowcase />);
    expect(screen.getByText("Your showcase is unavailable")).not.toBeNull();
    expect(screen.queryByText("No cards yet")).toBeNull();
    expect(container.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(0);
  });

  it("nests no block element inside a paragraph", () => {
    mockPacks = { data: PACKS(2), isLoading: false, isError: false };
    const { container } = render(<VaultShowcase />);
    expect(container.querySelectorAll("p div")).toHaveLength(0);
  });
});
