/** Cards refresh §2.3 Deleted: the Settings NS card list is trimmed to an import link, the last import and takedown. */
import React from "react";
import { render, screen } from "@testing-library/react";

jest.mock("~/trpc/react", () => ({
  api: {
    nsImport: { getMyNSCards: { useQuery: jest.fn() } },
    users: { getProfile: { useQuery: jest.fn(() => ({ data: null })) } },
  },
}));
jest.mock("~/app/settings/_components/modals/NSTakedownModal", () => ({
  NSTakedownModal: () => null,
}));
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

import { api, type RouterOutputs } from "~/trpc/react";
import { NationStatesCardsPanel } from "~/app/settings/_components/panels/NationStatesCardsPanel";

type MyNSCards = RouterOutputs["nsImport"]["getMyNSCards"];

/** One card as getMyNSCards lists it. */
function nsCard(cardId: string, title: string, acquiredAt: string): MyNSCards["cards"][number] {
  return {
    id: cardId,
    cardId,
    title,
    description: null,
    rarity: "COMMON",
    season: 3,
    cardType: "NS",
    category: null,
    subcategory: null,
    artwork: "https://www.nationstates.net/images/flags/uploads/flag.png",
    artworkSource: null,
    artworkCredit: null,
    slug: null,
    marketValue: 0.5,
    totalSupply: null,
    nsCardId: 42,
    nsSeason: 3,
    isRetired: false,
    retiredAt: null,
    metadata: null,
    acquiredAt: new Date(acquiredAt),
    nation: title,
    imageUrl: null,
    isHidden: false,
    hiddenAt: null,
    reason: null,
  };
}

function withCards(cards: MyNSCards["cards"]) {
  const data: MyNSCards = { verifiedNations: [], cards };
  jest.mocked(api.nsImport.getMyNSCards.useQuery).mockReturnValue({
    data,
    isLoading: false,
  } as never);
}

describe("NationStatesCardsPanel", () => {
  it("keeps the import link, the last import and the takedown, and no card list", () => {
    withCards([
      nsCard("a", "Aland", "2026-10-01T00:00:00Z"),
      nsCard("b", "Bigtopia", "2026-10-03T00:00:00Z"),
    ]);
    render(<NationStatesCardsPanel />);
    expect(screen.getByRole("link", { name: /Import cards/ })).toHaveAttribute(
      "href",
      "/vault/import"
    );
    expect(
      screen.getByText(
        `2 cards imported, the last on ${new Date("2026-10-03T00:00:00Z").toLocaleDateString()}`
      )
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Takedown and opt-out/ })).toBeInTheDocument();
    expect(screen.queryByRole("searchbox")).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("button", { name: "View" })).toBeNull();
    expect(screen.queryByText("Aland")).toBeNull();
  });

  it("opens the last import in its card sheet, not a modal", () => {
    withCards([
      nsCard("a", "Aland", "2026-10-01T00:00:00Z"),
      nsCard("b", "Bigtopia", "2026-10-03T00:00:00Z"),
    ]);
    render(<NationStatesCardsPanel />);
    expect(screen.getByRole("link", { name: "Open Bigtopia" })).toHaveAttribute(
      "href",
      "/vault/cards/mine?card=b"
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("counts one card in the singular", () => {
    withCards([nsCard("a", "Aland", "2026-10-01T00:00:00Z")]);
    render(<NationStatesCardsPanel />);
    expect(screen.getByText(/^1 card imported, the last on/)).toBeInTheDocument();
  });

  it("says when nothing is imported yet, with no card link", () => {
    withCards([]);
    render(<NationStatesCardsPanel />);
    expect(screen.getByText("No cards imported yet")).toBeInTheDocument();
    const hrefs = screen.getAllByRole("link").map((link) => link.getAttribute("href"));
    expect(hrefs.some((href) => href?.includes("?card="))).toBe(false);
    expect(screen.getByRole("link", { name: /Import cards/ })).toBeInTheDocument();
  });

  it("has no refresh button and no sync toast", () => {
    withCards([]);
    render(<NationStatesCardsPanel />);
    expect(screen.queryByRole("button", { name: /sync|refresh/i })).toBeNull();
    expect(screen.queryByTitle(/sync/i)).toBeNull();
  });
});
