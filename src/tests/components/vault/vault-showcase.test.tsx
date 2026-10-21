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
  uncollected: false,
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
const strip = (container: HTMLElement) =>
  container.querySelector('[data-slot="showcase-strip"]') as HTMLElement;

describe("VaultShowcase", () => {
  beforeEach(() => {
    open.mockClear();
    jest.mocked(useCardSheet).mockReturnValue({ open, cardId: null, from: null, close: jest.fn() });
    mockDisplay({ showcase: null, faces: TOP });
    mockPacks = { data: PACKS(0), isLoading: false, isError: false };
  });
  it("shows the pinned showcase by name, and opens a card's sheet", () => {
    mockDisplay({ showcase: { id: "s1", name: "Best of Ixnay" }, faces: [face("c1", "Caphiria")] });
    render(<VaultShowcase />);
    // Marked with a pin, as the Passport marks pinned ribbons, and said in words to a screen reader.
    const subtitle = screen.getByText("Best of Ixnay").parentElement!;
    expect(subtitle.querySelector("svg")).toHaveAttribute("aria-hidden");
    expect(subtitle.textContent).toBe("Pinned: Best of Ixnay");
    expect(screen.getByText("Pinned:")).toHaveClass("sr-only");
    expect(screen.queryByText("Your most valuable cards")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Caphiria, Epic, Standard, Ixnay" }));
    expect(open).toHaveBeenCalledWith("c1");
  });

  it("falls back to the most valuable cards when nothing is pinned", () => {
    mockDisplay({ showcase: null, faces: [face("c1", "Caphiria")] });
    render(<VaultShowcase />);
    const subtitle = screen.getByText("Your most valuable cards").parentElement!;
    expect(subtitle.querySelector("svg")).toBeNull();
    expect(subtitle.textContent).toBe("Your most valuable cards");
  });
  it("opens the sheet of the card chosen, once per click", () => {
    render(<VaultShowcase />);
    fireEvent.click(faces()[1]!);
    expect(open).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledWith("c2");
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
  it("shows only the pack tile, not the empty state, for a player with packs but no cards", () => {
    mockDisplay({ showcase: null, faces: [] });
    mockPacks = { data: PACKS(3), isLoading: false, isError: false };
    render(<VaultShowcase />);
    expect(screen.queryByText("No cards yet")).toBeNull();
    expect(screen.queryByText("Your most valuable cards")).toBeNull();
    expect(screen.getByRole("link", { name: /3 packs waiting/ })).not.toBeNull();
  });
});
