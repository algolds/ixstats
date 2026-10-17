import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";

jest.mock("~/components/vault/IxCreditsSymbol", () => ({ IxCreditsSymbol: () => <i /> }));
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({
    href,
    children,
    ...rest
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
jest.mock("~/components/cards/pack-opening/PackHolographicCover", () => ({
  PackHolographicCover: ({ packName }: { packName?: string }) => (
    <div data-testid="pack-art">{packName}</div>
  ),
}));
jest.mock("~/hooks/useCardSheet", () => ({ useCardSheet: jest.fn(() => ({ open: jest.fn() })) }));

interface Query<T> {
  data?: T;
  isLoading: boolean;
  isError: boolean;
}
interface Display {
  showcase: { id: string; name: string } | null;
  faces: CardFaceData[];
}
interface WaitingPacks {
  success: boolean;
  packs: Array<{
    id: string;
    pack: { id: string; name: string; packType: string; artwork: string | null };
  }>;
}

let mockDisplayQuery: Query<Display>;
let mockPacks: Query<WaitingPacks>;
jest.mock("~/trpc/react", () => ({
  api: {
    cards: { getMyDisplay: { useQuery: () => mockDisplayQuery } },
    cardPacks: { getMyPacks: { useQuery: () => mockPacks } },
  },
}));

import { useCardSheet } from "~/hooks/useCardSheet";
import type { CardFaceData } from "~/lib/cards/face/types";
import { VaultShowcase } from "~/components/vault/sections/dashboard/VaultShowcase";

const face = (cardId: string, title: string): CardFaceData => ({
  cardId,
  title,
  rarity: "EPIC",
  cardType: "LORE",
  realm: { id: "default", slug: "ixnay", name: "Ixnay", crestUrl: null, isSystem: false },
  artwork: `/art/${cardId}.png`,
  silhouette: false,
  number: 1,
  season: null,
  isRetired: false,
  copy: { ownershipId: `own-${cardId}`, finish: "STANDARD", serialNumber: 1, level: 1 },
});

const TOP = [face("c1", "Caphiria"), face("c2", "Velarc Throne"), face("c3", "Kirav Lighthouse")];
const PACKS = (count: number): WaitingPacks => ({
  success: true,
  packs: Array.from({ length: count }, (_, i) => ({
    id: `up${i}`,
    pack: { id: "p1", name: "Season III Veteran Pack", packType: "PREMIUM", artwork: null },
  })),
});

function mockDisplay(data: Display) {
  mockDisplayQuery = { data, isLoading: false, isError: false };
}

const open = jest.fn();
const faces = () => screen.queryAllByRole("button", { name: /, Epic, Standard, Ixnay$/ });
const showcaseRoot = (container: HTMLElement) =>
  container.querySelector('[data-slot="vault-showcase"]') as HTMLElement;
const strip = (container: HTMLElement) =>
  container.querySelector('[data-slot="showcase-strip"]') as HTMLElement;

describe("VaultShowcase", () => {
  beforeEach(() => {
    open.mockClear();
    jest.mocked(useCardSheet).mockReturnValue({ open, cardId: null, from: null, close: jest.fn() });
    mockDisplay({ showcase: null, faces: TOP });
    mockPacks = { data: PACKS(0), isLoading: false, isError: false };
  });

  it("is a full Card titled Showcase with an All cards link to Mine", () => {
    const { container } = render(<VaultShowcase />);
    const root = showcaseRoot(container);
    expect(root.getAttribute("data-content")).toBe("collectible");
    const title = within(root).getByText("Showcase");
    expect(title.getAttribute("data-slot")).toBe("card-title");
    expect(title.className).not.toMatch(/uppercase|eyebrow/);
    expect(within(root).getByRole("link", { name: "All cards" }).getAttribute("href")).toBe(
      "/vault/cards/mine"
    );
  });

  it("sits on a paper grain texture, with the strip above it", () => {
    const { container } = render(<VaultShowcase />);
    const root = showcaseRoot(container);
    expect(root.className).toContain("overflow-hidden");
    expect(root.querySelector(":scope > .facet-texture-paper-grain")).not.toBeNull();
    expect(strip(container).closest(".relative")).not.toBeNull();
    expect(strip(container).querySelector(".facet-texture-paper-grain")).toBeNull();
  });

  it("shows the pinned showcase by name, and opens a card's sheet", () => {
    mockDisplay({ showcase: { id: "s1", name: "Best of Ixnay" }, faces: [face("c1", "Caphiria")] });
    render(<VaultShowcase />);
    // Marked with a pin, as the Passport marks pinned ribbons.
    expect(screen.getByText("Best of Ixnay").parentElement!.querySelector("svg")).not.toBeNull();
    expect(screen.queryByText("Your most valuable cards")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Caphiria, Epic, Standard, Ixnay" }));
    expect(open).toHaveBeenCalledWith("c1");
  });

  it("falls back to the most valuable cards when nothing is pinned", () => {
    mockDisplay({ showcase: null, faces: [face("c1", "Caphiria")] });
    render(<VaultShowcase />);
    const subtitle = screen.getByText("Your most valuable cards");
    expect(subtitle.parentElement!.querySelector("svg")).toBeNull();
  });

  it("renders each card as its face at size M, in the display's order", () => {
    const { container } = render(<VaultShowcase />);
    const shown = faces();
    expect(shown.map((f) => f.getAttribute("aria-label"))).toEqual([
      "Caphiria, Epic, Standard, Ixnay",
      "Velarc Throne, Epic, Standard, Ixnay",
      "Kirav Lighthouse, Epic, Standard, Ixnay",
    ]);
    for (const f of shown) {
      expect(f).toHaveAttribute("data-card-face");
      expect(f.className).toContain("w-48");
      expect(f.className).toContain("snap-start");
    }
    expect(strip(container).contains(shown[0]!)).toBe(true);
  });

  it("lays the faces in a horizontal scrolling strip that snaps on phones", () => {
    const { container } = render(<VaultShowcase />);
    const row = strip(container);
    expect(row.className).toMatch(/\bflex\b/);
    expect(row.className).toContain("overflow-x-auto");
    expect(row.className).toContain("gap-3");
    expect(row.className).toContain("snap-x");
    expect(row.getAttribute("style")).toMatch(/opacity/);
    expect(within(row).getAllByRole("button")).toHaveLength(3);
  });

  it("opens the sheet of the card chosen, once per click", () => {
    render(<VaultShowcase />);
    fireEvent.click(faces()[1]!);
    expect(open).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledWith("c2");
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
    expect(link.getAttribute("href")).toBe("/vault/store?view=my-packs");
    expect(within(link).getByTestId("pack-art").textContent).toBe("Season III Veteran Pack");
    expect(link.className).toContain("w-48");
    expect(link.className).toContain("aspect-[5/7]");
    const tiles = Array.from(strip(container).children);
    // Cards, then the pack tile, then the Explore tile (this player shows fewer than six cards).
    expect(tiles.indexOf(link)).toBe(3);
    expect(tiles.at(-1)).toBe(screen.getByRole("link", { name: /Find more cards/ }));
  });

  it("ends a strip of fewer than six cards with a Find more cards tile linking to Explore", () => {
    const { container } = render(<VaultShowcase />);
    const link = screen.getByRole("link", { name: /Find more cards/ });
    expect(link.getAttribute("href")).toBe("/vault/cards/explore");
    expect(link.textContent).toContain("Every realm's cards in Explore");
    expect(link.className).toContain("w-48");
    expect(link.className).toContain("aspect-[5/7]");
    expect(link.querySelector("svg")).not.toBeNull();
    // A tinted grid texture, and the icon in a tinted tile.
    expect(link.querySelector(".facet-texture-grid")).not.toBeNull();
    expect(link.querySelector("svg")!.closest("span.bg-tint-fill")).not.toBeNull();
    expect(strip(container).lastElementChild).toBe(link);
    expect(link.querySelector('[data-slot="card"]')?.getAttribute("data-variant")).toBe("well");
  });

  it("leaves the Find more cards tile off once the display is full", () => {
    const five = [...TOP, face("c4", "Fourth"), face("c5", "Fifth")];
    mockDisplay({ showcase: null, faces: five });
    const { unmount } = render(<VaultShowcase />);
    expect(screen.getByRole("link", { name: /Find more cards/ })).toBeInTheDocument();
    unmount();
    mockDisplay({ showcase: null, faces: [...five, face("c6", "Sixth")] });
    render(<VaultShowcase />);
    expect(faces()).toHaveLength(6);
    expect(screen.queryByRole("link", { name: /Find more cards/ })).toBeNull();
  });

  it("uses the singular for one waiting pack", () => {
    mockPacks = { data: PACKS(1), isLoading: false, isError: false };
    render(<VaultShowcase />);
    expect(screen.getByRole("link", { name: /1 pack waiting/ })).not.toBeNull();
  });

  it("says what is missing, with one action to Explore, for an empty collection", () => {
    mockDisplay({ showcase: null, faces: [] });
    const { container } = render(<VaultShowcase />);
    expect(screen.getByText("No cards yet")).not.toBeNull();
    expect(
      screen.getByText("Explore every realm's cards, or open a pack from the Store.")
    ).not.toBeNull();
    expect(screen.queryByText("Your most valuable cards")).toBeNull();
    const hrefs = within(showcaseRoot(container))
      .getAllByRole("link")
      .map((link) => link.getAttribute("href"));
    expect(hrefs).toEqual(["/vault/cards/mine", "/vault/cards/explore"]);
    expect(screen.getByRole("link", { name: "Explore cards" })).toBeInTheDocument();
    expect(faces()).toHaveLength(0);
  });

  it("does not call the collection empty while the packs load", () => {
    mockDisplay({ showcase: null, faces: [] });
    mockPacks = { data: undefined, isLoading: true, isError: false };
    const { container } = render(<VaultShowcase />);
    expect(screen.queryByText("No cards yet")).toBeNull();
    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
  });

  it("does not call the collection empty when the packs could not be read", () => {
    mockDisplay({ showcase: null, faces: [] });
    mockPacks = { data: undefined, isLoading: false, isError: true };
    render(<VaultShowcase />);
    expect(screen.queryByText("No cards yet")).toBeNull();
    expect(screen.getByText("Your showcase is unavailable")).not.toBeNull();
  });

  it("shows the cards at once while the packs load, and when the packs fail", () => {
    mockPacks = { data: undefined, isLoading: true, isError: false };
    const { unmount } = render(<VaultShowcase />);
    expect(faces()).toHaveLength(3);
    unmount();
    mockPacks = { data: undefined, isLoading: false, isError: true };
    render(<VaultShowcase />);
    expect(faces()).toHaveLength(3);
  });

  it("shows only the pack tile, not the empty state, for a player with packs but no cards", () => {
    mockDisplay({ showcase: null, faces: [] });
    mockPacks = { data: PACKS(3), isLoading: false, isError: false };
    render(<VaultShowcase />);
    expect(screen.queryByText("No cards yet")).toBeNull();
    expect(screen.queryByText("Your most valuable cards")).toBeNull();
    expect(screen.getByRole("link", { name: /3 packs waiting/ })).not.toBeNull();
  });

  it("shows skeletons, not an empty state, while the cards load", () => {
    mockDisplayQuery = { data: undefined, isLoading: true, isError: false };
    const { container } = render(<VaultShowcase />);
    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
    expect(screen.queryByText("No cards yet")).toBeNull();
    expect(screen.queryByText("Your most valuable cards")).toBeNull();
    expect(faces()).toHaveLength(0);
    // The entrance belongs to the cards, not the placeholders.
    expect(strip(container)).toBeNull();
  });

  it("says the showcase is unavailable when the cards fail to load", () => {
    mockDisplayQuery = { data: undefined, isLoading: false, isError: true };
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
