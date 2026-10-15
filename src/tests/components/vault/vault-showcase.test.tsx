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
// The Cards gallery's own tile; the Showcase must render it, not a copy of it.
jest.mock("~/components/cards/display/CardDisplay", () => ({
  CardDisplay: ({
    card,
    size,
    onClick,
  }: {
    card: { title: string; rarity: string };
    size: string;
    onClick: (card: unknown) => void;
  }) => (
    <div data-testid="gallery-card" data-size={size} onClick={() => onClick(card)}>
      {card.title} {card.rarity}
    </div>
  ),
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

const galleryCards = () => screen.getAllByTestId("gallery-card");

describe("VaultShowcase", () => {
  beforeEach(() => {
    mockTopQuery.mockClear();
    mockTop = { data: TOP, isLoading: false, isError: false };
    mockPacks = { data: PACKS(0), isLoading: false, isError: false };
  });

  it("is a full Card titled Showcase with an All cards link to the Cards page", () => {
    const { container } = render(<VaultShowcase />);
    const root = container.querySelector('[data-slot="vault-showcase"]') as HTMLElement;
    expect(root.getAttribute("data-content")).toBe("collectible");
    const title = within(root).getByText("Showcase");
    expect(title.getAttribute("data-slot")).toBe("card-title");
    expect(title.className).not.toMatch(/uppercase|eyebrow/);
    expect(within(root).getByRole("link", { name: "All cards" }).getAttribute("href")).toBe(
      "/vault/cards"
    );
  });

  it("sits on a paper grain texture, with the strip above it", () => {
    const { container } = render(<VaultShowcase />);
    const root = container.querySelector('[data-slot="vault-showcase"]') as HTMLElement;
    expect(root.className).toContain("overflow-hidden");
    expect(root.querySelector(":scope > .facet-texture-paper-grain")).not.toBeNull();
    const strip = root.querySelector('[data-slot="showcase-strip"]') as HTMLElement;
    expect(strip.closest(".relative")).not.toBeNull();
    expect(strip.querySelector(".facet-texture-paper-grain")).toBeNull();
  });

  it("asks for the four most valuable cards", () => {
    render(<VaultShowcase />);
    expect(mockTopQuery).toHaveBeenCalledWith({ limit: 4 });
  });

  it("renders each top card with the gallery's card tile at its medium size", () => {
    render(<VaultShowcase />);
    const tiles = galleryCards();
    expect(tiles.map((tile) => tile.textContent)).toEqual([
      "Ostrozava 1st Ed. LEGENDARY",
      "Velarc Throne EPIC",
      "Kirav Lighthouse ULTRA_RARE",
    ]);
    for (const tile of tiles) expect(tile.getAttribute("data-size")).toBe("medium");
  });

  it("lays the tiles in a horizontal scrolling strip that snaps on phones", () => {
    const { container } = render(<VaultShowcase />);
    const strip = container.querySelector('[data-slot="showcase-strip"]') as HTMLElement;
    expect(strip.className).toMatch(/\bflex\b/);
    expect(strip.className).toContain("overflow-x-auto");
    expect(strip.className).toContain("gap-3");
    expect(strip.className).toContain("snap-x");
    expect(strip.getAttribute("style")).toMatch(/opacity/);
    expect(within(strip).getAllByTestId("gallery-card")).toHaveLength(3);
  });

  it("opens a card's detail when it is chosen", () => {
    render(<VaultShowcase />);
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getAllByTestId("gallery-card")[1]!);
    expect(screen.getByRole("dialog").textContent).toBe("Details of Velarc Throne");
  });

  it("makes each tile a focusable named button that Enter or Space opens", () => {
    render(<VaultShowcase />);
    const tiles = screen.getAllByRole("button", { name: /^View / });
    expect(tiles.map((tile) => tile.getAttribute("aria-label"))).toEqual([
      "View Ostrozava 1st Ed.",
      "View Velarc Throne",
      "View Kirav Lighthouse",
    ]);
    for (const tile of tiles) {
      expect(tile.getAttribute("tabindex")).toBe("0");
      expect(tile.className).toContain("focus-visible:");
    }
    tiles[0]!.focus();
    expect(document.activeElement).toBe(tiles[0]);
    fireEvent.keyDown(tiles[0]!, { key: "Enter" });
    expect(screen.getByRole("dialog").textContent).toBe("Details of Ostrozava 1st Ed.");
    fireEvent.keyDown(tiles[1]!, { key: " " });
    expect(screen.getByRole("dialog").textContent).toBe("Details of Velarc Throne");
  });

  it("ignores a key pressed inside the tile, such as Enter on a link in a card's excerpt", () => {
    render(<VaultShowcase />);
    const tile = screen.getByRole("button", { name: "View Velarc Throne" });
    fireEvent.keyDown(within(tile).getByTestId("gallery-card"), { key: "Enter" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens once per click, and ignores keys other than Enter and Space", () => {
    render(<VaultShowcase />);
    const tile = screen.getByRole("button", { name: "View Velarc Throne" });
    fireEvent.keyDown(tile, { key: "a" });
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(within(tile).getByTestId("gallery-card"));
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
  });

  it("adds no pack tile when no pack is waiting", () => {
    render(<VaultShowcase />);
    expect(screen.queryByText(/waiting/)).toBeNull();
    expect(screen.queryByRole("link", { name: /waiting/ })).toBeNull();
  });

  it("adds one pack tile linking to My packs, after the cards, when packs are waiting", () => {
    mockPacks = { data: PACKS(2), isLoading: false, isError: false };
    const { container } = render(<VaultShowcase />);
    const link = screen.getByRole("link", { name: /2 packs waiting/ });
    expect(link.getAttribute("href")).toBe("/vault/store?tab=store&view=my-packs");
    expect(within(link).getByTestId("pack-art").textContent).toBe("Season III Veteran Pack");
    expect(link.className).toContain("w-48");
    expect(link.className).toContain("h-[269px]");
    const strip = container.querySelector('[data-slot="showcase-strip"]') as HTMLElement;
    const tiles = Array.from(strip.children);
    // Cards, then the pack tile, then the Store tile (this player has fewer than four cards).
    expect(tiles.indexOf(link)).toBe(3);
    expect(tiles.at(-1)).toBe(screen.getByRole("link", { name: /Find more cards/ }));
  });

  it("ends a strip of fewer than four cards with a Find more cards tile linking to the Store", () => {
    const { container } = render(<VaultShowcase />);
    const link = screen.getByRole("link", { name: /Find more cards/ });
    expect(link.getAttribute("href")).toBe("/vault/store");
    expect(link.textContent).toContain("Packs and listings in the Store");
    expect(link.className).toContain("w-48");
    expect(link.className).toContain("h-[269px]");
    expect(link.querySelector("svg")).not.toBeNull();
    // A tinted grid texture, and the icon in a tinted tile.
    expect(link.querySelector(".facet-texture-grid")).not.toBeNull();
    expect(link.querySelector("svg")!.closest("span.bg-tint-fill")).not.toBeNull();
    const strip = container.querySelector('[data-slot="showcase-strip"]') as HTMLElement;
    expect(strip.lastElementChild).toBe(link);
    expect(link.querySelector('[data-slot="card"]')?.getAttribute("data-variant")).toBe("well");
  });

  it("leaves the Find more cards tile off once there are four cards", () => {
    mockTop = {
      data: [...TOP, ownership("c4", "Fourth Card", "RARE", 300)],
      isLoading: false,
      isError: false,
    };
    render(<VaultShowcase />);
    expect(galleryCards()).toHaveLength(4);
    expect(screen.queryByRole("link", { name: /Find more cards/ })).toBeNull();
  });

  it("uses the singular for one waiting pack", () => {
    mockPacks = { data: PACKS(1), isLoading: false, isError: false };
    render(<VaultShowcase />);
    expect(screen.getByRole("link", { name: /1 pack waiting/ })).not.toBeNull();
  });

  it("says what is missing, with one action to the Store, for an empty collection", () => {
    mockTop = { data: [], isLoading: false, isError: false };
    const { container } = render(<VaultShowcase />);
    expect(screen.getByText("No cards yet")).not.toBeNull();
    const body = container.querySelector('[data-slot="vault-showcase"]') as HTMLElement;
    const hrefs = within(body)
      .getAllByRole("link")
      .map((link) => link.getAttribute("href"));
    expect(hrefs).toEqual(["/vault/cards", "/vault/store"]);
    expect(screen.queryAllByTestId("gallery-card")).toHaveLength(0);
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
    expect(galleryCards()).toHaveLength(3);
    unmount();
    mockPacks = { data: undefined, isLoading: false, isError: true };
    render(<VaultShowcase />);
    expect(galleryCards()).toHaveLength(3);
  });

  it("shows only the pack tile, not the empty state, for a player with packs but no cards", () => {
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
    expect(screen.queryAllByTestId("gallery-card")).toHaveLength(0);
    // The entrance belongs to the cards, not the placeholders.
    expect(container.querySelector('[data-slot="showcase-strip"]')).toBeNull();
  });

  it("says the showcase is unavailable when the cards fail to load", () => {
    mockTop = { data: undefined, isLoading: false, isError: true };
    const { container } = render(<VaultShowcase />);
    expect(screen.getByText("Your showcase is unavailable")).not.toBeNull();
    expect(screen.queryByText("No cards yet")).toBeNull();
    expect(container.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(0);
  });

  it("nests no block element inside a paragraph or a span", () => {
    mockPacks = { data: PACKS(2), isLoading: false, isError: false };
    const { container } = render(<VaultShowcase />);
    expect(container.querySelectorAll("p div, span div:not(.texture-overlay)")).toHaveLength(0);
  });
});
