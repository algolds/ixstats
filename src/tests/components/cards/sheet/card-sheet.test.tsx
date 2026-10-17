import React from "react";
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
  within,
} from "@testing-library/react";

jest.mock("~/trpc/react", () => ({
  api: {
    cards: { getSheet: { useQuery: jest.fn() } },
    loreCards: { getCardAuthorInfo: { useQuery: jest.fn(() => ({ data: undefined })) } },
  },
}));
jest.mock("~/components/providers/FacetMotionConfig", () => ({
  useFacetReducedMotion: () => true,
}));
jest.mock("~/components/cards/display/CardPriceHistoryChart", () => ({
  CardPriceHistoryChart: () => null,
}));
jest.mock("~/components/cards/display/LoreWikiExcerpt", () => ({
  LoreWikiExcerpt: ({ wikiUrl, artHidden }: { wikiUrl: string | null; artHidden?: boolean }) => (
    <p>
      Excerpt {wikiUrl}
      {artHidden ? " without art" : ""}
    </p>
  ),
}));
jest.mock("next/navigation", () => ({ useSearchParams: jest.fn(() => new URLSearchParams()) }));
jest.mock("~/components/cards/display/CardTakedownVerificationModal", () => ({
  CardTakedownVerificationModal: ({
    isOpen,
    season,
  }: {
    isOpen: boolean;
    season: number | null;
  }) => (isOpen ? <div role="alertdialog">Takedown for season {season}</div> : null),
}));
jest.mock("~/components/cards/showcase/AddToShowcaseDialog", () => ({
  AddToShowcaseDialog: ({ open, ownershipIds }: { open: boolean; ownershipIds: string[] }) =>
    open ? <div role="dialog">Add {ownershipIds.join(",")}</div> : null,
}));
jest.mock("~/lib/vault/vault-notifications", () => ({
  vaultNotify: { success: jest.fn(), error: jest.fn() },
}));
jest.mock("~/components/cards/reveal/reveal-feedback", () => ({ playRevealFeedback: jest.fn() }));
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

import { api } from "~/trpc/react";
import { vaultNotify } from "~/lib/vault/vault-notifications";
import { playRevealFeedback } from "~/components/cards/reveal/reveal-feedback";
import { CardSheet } from "~/components/cards/sheet/CardSheet";
import { useCardSheet } from "~/hooks/useCardSheet";
import type { CardSheetData, SheetCopy, SheetListing } from "~/lib/cards/hub/sheet";

const realm = { id: "default", slug: "ixnay", name: "Ixnay", crestUrl: null, isSystem: false };
const face = {
  cardId: "c1",
  title: "Caphiria",
  rarity: "EPIC" as const,
  cardType: "LORE" as const,
  realm,
  artwork: null,
  silhouette: false,
  number: 9,
  season: null,
  isRetired: false,
  copy: { ownershipId: "o1", finish: "FOIL" as const, serialNumber: 7, level: 4 },
};
const card: CardSheetData["card"] = {
  id: "c1",
  title: "Caphiria",
  cardType: "LORE",
  rarity: "EPIC",
  isBound: false,
  isRetired: false,
  category: "HISTORY",
  description: null,
  wikiSource: "ixwiki",
  wikiArticleTitle: "Caphiria",
  excerpt: null,
  author: null,
  descriptionUrl: null,
  artCredit: null,
  ns: null,
  value: 1200,
};
const copy = (overrides: Partial<SheetCopy> = {}): SheetCopy => ({
  face,
  experience: 2400,
  acquiredAt: new Date("2026-10-01T00:00:00Z"),
  isLocked: false,
  inscription: null,
  trail: [],
  ...overrides,
});
const sheet = (overrides: Partial<CardSheetData> = {}): CardSheetData => ({
  face,
  card,
  copies: [copy()],
  market: { listings: [], recentSales: [], wantedBy: 12 },
  ...overrides,
});
const listing = (overrides: Partial<SheetListing> = {}): SheetListing => ({
  auctionId: "a1",
  currentBid: 900,
  buyoutPrice: null,
  endTime: new Date(Date.now() + 3 * 3_600_000 + 12 * 60_000 + 30_000),
  bidCount: 2,
  sellerHandle: "ann",
  isMine: false,
  ...overrides,
});

const useSheet = () => jest.mocked(api.cards.getSheet.useQuery);
const useAuthor = () => jest.mocked(api.loreCards.getCardAuthorInfo.useQuery);
const showSheet = (data: CardSheetData | null = sheet()) =>
  useSheet().mockReturnValue({ data, isLoading: false } as never);

beforeEach(() => {
  // A page with no sheet open, so open() in the focus tests always pushes.
  window.history.replaceState(null, "", "/vault/cards/mine");
  jest.clearAllMocks();
  useAuthor().mockReturnValue({ data: undefined } as never);
});

describe("CardSheet", () => {
  it("lays out one sheet: the card, then your copies, the market and about", () => {
    showSheet();
    render(<CardSheet cardId="c1" from={null} onClose={jest.fn()} />);
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("heading", { level: 2, name: "Caphiria" })).toBeInTheDocument();
    expect(within(dialog).getByText("Epic · Ixnay · No. 9")).toBeInTheDocument();
    expect(within(dialog).queryByRole("tablist")).toBeNull();
    const headings = within(dialog)
      .getAllByRole("heading", { level: 3 })
      .map((h) => h.textContent);
    expect(headings).toEqual(["Your copies", "Market", "About"]);
    expect(within(dialog).getByText("Wanted by 12")).toBeInTheDocument();
  });

  it("flips with its button and with F", () => {
    showSheet();
    render(<CardSheet cardId="c1" from={null} onClose={jest.fn()} />);
    const toggle = screen.getByRole("button", { name: "Show the back" });
    expect(toggle).not.toHaveAttribute("aria-pressed");
    fireEvent.click(toggle);
    expect(screen.getByRole("button", { name: "Show the front" })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "f" });
    expect(screen.getByRole("button", { name: "Show the back" })).toBeInTheDocument();
  });

  it("gives the reveal's feedback when the card turns to its back, and none when it turns back", () => {
    showSheet();
    render(<CardSheet cardId="c1" from={null} onClose={jest.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Show the back" }));
    // Reduce Motion is on in these tests, so the buzz stays off.
    expect(playRevealFeedback).toHaveBeenCalledTimes(1);
    expect(playRevealFeedback).toHaveBeenCalledWith("EPIC", true);
    fireEvent.keyDown(window, { key: "f" });
    expect(playRevealFeedback).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(window, { key: "f" });
    expect(playRevealFeedback).toHaveBeenCalledTimes(2);
  });

  it("starts the next card on its front", () => {
    showSheet();
    const { rerender } = render(<CardSheet cardId="c1" from={null} onClose={jest.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Show the back" }));
    showSheet(
      sheet({ card: { ...card, id: "c2", title: "Urcea" }, face: { ...face, cardId: "c2" } })
    );
    rerender(<CardSheet cardId="c2" from={null} onClose={jest.fn()} />);
    expect(screen.getByRole("heading", { level: 2, name: "Urcea" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show the back" })).toBeInTheDocument();
  });

  it("puts focus on the card, a named group, and says which side shows after a turn", () => {
    showSheet();
    render(<CardSheet cardId="c1" from={null} onClose={jest.fn()} />);
    const hero = screen.getByRole("group", { name: "The card. Press Space or F to turn it over." });
    expect(document.activeElement).toBe(hero);
    const status = within(hero).getByRole("status");
    expect(status).toBeEmptyDOMElement();
    fireEvent.keyDown(window, { key: "f" });
    expect(status).toHaveTextContent("Showing the back");
    fireEvent.keyDown(window, { key: "f" });
    expect(status).toHaveTextContent("Showing the front");
  });

  it("offers a held copy to a showcase and to the auction form, but never a bound one to sale", () => {
    showSheet();
    const { unmount } = render(<CardSheet cardId="c1" from={null} onClose={jest.fn()} />);
    expect(screen.getByText("#7 · Foil · Level 4")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sell at auction" })).toHaveAttribute(
      "href",
      "/vault/cards/market?tab=selling&sell=o1"
    );
    fireEvent.click(screen.getByRole("button", { name: "Add to showcase" }));
    expect(screen.getByText("Add o1")).toBeInTheDocument();
    unmount();
    showSheet(sheet({ card: { ...card, isBound: true } }));
    render(<CardSheet cardId="c1" from={null} onClose={jest.fn()} />);
    expect(screen.queryByRole("link", { name: "Sell at auction" })).toBeNull();
    expect(screen.getByText("Bound to your account")).toBeInTheDocument();
  });

  it("does not offer a copy that is in a listing or trade for sale again", () => {
    showSheet(sheet({ copies: [copy({ isLocked: true })] }));
    render(<CardSheet cardId="c1" from={null} onClose={jest.fn()} />);
    expect(screen.getByText("In a listing or trade")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Sell at auction" })).toBeNull();
    expect(screen.getByRole("button", { name: "Add to showcase" })).toBeInTheDocument();
  });

  it("says how to get a card the viewer does not hold", () => {
    showSheet(sheet({ copies: [], face: { ...face, copy: null, silhouette: true } }));
    render(<CardSheet cardId="c1" from={null} onClose={jest.fn()} />);
    expect(
      screen.getByText(/You do not have this card yet\. It comes in Ixnay packs/)
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "See it in the market" })).toHaveAttribute(
      "href",
      "/vault/cards/market?for=c1"
    );
    expect(screen.queryByRole("button", { name: "Add to showcase" })).toBeNull();
  });

  it("says a bound card the viewer does not hold is earned, never bought", () => {
    showSheet(
      sheet({ copies: [], card: { ...card, isBound: true }, face: { ...face, copy: null } })
    );
    render(<CardSheet cardId="c1" from={null} onClose={jest.fn()} />);
    expect(
      screen.getByText(
        "You do not have this card yet. It is earned as a reward, and never traded or sold."
      )
    ).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "See it in the market" })).toBeNull();
    expect(screen.queryByText("Bound to your account")).toBeNull();
  });

  it("says nothing of where a retired card comes from", () => {
    showSheet(
      sheet({
        copies: [],
        card: { ...card, isRetired: true, value: 0 },
        face: { ...face, copy: null, isRetired: true },
      })
    );
    render(<CardSheet cardId="c1" from={null} onClose={jest.fn()} />);
    expect(screen.getByText("You do not have this card yet.")).toBeInTheDocument();
    expect(screen.queryByText(/packs/)).toBeNull();
    expect(screen.queryByRole("link", { name: "See it in the market" })).toBeNull();
  });

  it("gives focus back to the face that opened it when it closes", async () => {
    showSheet();
    const opener = document.createElement("button");
    document.body.append(opener);
    opener.focus();
    const { result } = renderHook(() => useCardSheet());
    act(() => result.current.open("c1"));
    const { unmount } = render(<CardSheet cardId="c1" from={null} onClose={jest.fn()} />);
    expect(document.activeElement).not.toBe(opener);
    unmount();
    await waitFor(() => expect(document.activeElement).toBe(opener));
    opener.remove();
  });

  it("gives focus back once, so a later sheet from a link does not send it to an old opener", async () => {
    showSheet();
    const first = document.createElement("button");
    const later = document.createElement("button");
    document.body.append(first, later);
    first.focus();
    const { result } = renderHook(() => useCardSheet());
    act(() => result.current.open("c1"));
    const sheet1 = render(<CardSheet cardId="c1" from={null} onClose={jest.fn()} />);
    sheet1.unmount();
    await waitFor(() => expect(document.activeElement).toBe(first));
    later.focus();
    const sheet2 = render(<CardSheet cardId="c1" from={null} onClose={jest.fn()} />);
    later.focus();
    sheet2.unmount();
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(document.activeElement).not.toBe(first);
    first.remove();
    later.remove();
  });

  it("leaves focus alone when the opener is gone", async () => {
    showSheet();
    const opener = document.createElement("button");
    document.body.append(opener);
    opener.focus();
    const { result } = renderHook(() => useCardSheet());
    act(() => result.current.open("c1"));
    const { unmount } = render(<CardSheet cardId="c1" from={null} onClose={jest.fn()} />);
    opener.remove();
    const focus = jest.spyOn(opener, "focus");
    unmount();
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(focus).not.toHaveBeenCalled();
  });

  it("says when a card is not available", () => {
    showSheet(null);
    render(<CardSheet cardId="nope" from={null} onClose={jest.fn()} />);
    expect(screen.getByText("This card is not available")).toBeInTheDocument();
    expect(screen.queryByRole("group")).toBeNull();
  });

  it("tells a failed load apart from a missing card, and retries", () => {
    const refetch = jest.fn();
    useSheet().mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch,
    } as never);
    render(<CardSheet cardId="c1" from={null} onClose={jest.fn()} />);
    expect(screen.getByText("Could not load this card")).toBeInTheDocument();
    expect(screen.queryByText("This card is not available")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("asks for the card with where it was opened from, and shows a placeholder meanwhile", () => {
    useSheet().mockReturnValue({ data: undefined, isLoading: true } as never);
    render(<CardSheet cardId="c1" from={{ kind: "showcase", id: "s1" }} onClose={jest.fn()} />);
    expect(useSheet()).toHaveBeenCalledWith({ cardId: "c1", from: "showcase.s1" });
    expect(screen.getByRole("dialog", { name: "Card" })).toBeInTheDocument();
    render(<CardSheet cardId="c1" from={null} onClose={jest.fn()} />);
    expect(useSheet()).toHaveBeenLastCalledWith({ cardId: "c1", from: null });
  });

  it("closes through onClose", () => {
    showSheet();
    const onClose = jest.fn();
    render(<CardSheet cardId="c1" from={null} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("copies a link that opens this card in Explore", async () => {
    showSheet();
    const writeText = jest.fn(() => Promise.resolve());
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    render(<CardSheet cardId="c1" from={null} onClose={jest.fn()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copy link" }));
    });
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/vault/cards/explore?card=c1`);
    expect(vaultNotify.success).toHaveBeenCalledWith("Link copied", "Caphiria");
  });

  it("says so when the link cannot be copied", async () => {
    showSheet();
    const writeText = jest.fn(() => Promise.reject(new Error("denied")));
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    render(<CardSheet cardId="c1" from={null} onClose={jest.fn()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copy link" }));
    });
    expect(vaultNotify.error).toHaveBeenCalledWith("Could not copy the link");
  });
});

describe("CardSheet market", () => {
  it("lists live listings by seller, time left and bid, and links to bid", () => {
    showSheet(
      sheet({
        market: {
          listings: [
            listing(),
            listing({ auctionId: "a2", sellerHandle: null, isMine: true, currentBid: 1500 }),
          ],
          recentSales: [{ price: 800, at: new Date("2026-10-10T00:00:00Z") }],
          wantedBy: 0,
        },
      })
    );
    render(<CardSheet cardId="c1" from={null} onClose={jest.fn()} />);
    const listings = within(screen.getByRole("list", { name: "Live listings" })).getAllByRole(
      "listitem"
    );
    expect(listings[0]).toHaveTextContent("@ann · 3h 12m left");
    expect(listings[0]).toHaveTextContent("900");
    expect(listings[1]).toHaveTextContent("Your listing");
    expect(listings[1]).toHaveTextContent("1,500");
    expect(screen.getByRole("link", { name: "Bid in the market" })).toHaveAttribute(
      "href",
      "/vault/cards/market?for=c1"
    );
    expect(
      within(screen.getByRole("list", { name: "Recent sales" })).getByText("800")
    ).toBeInTheDocument();
    // The value is announced with its currency, "IxCredits 1,200".
    expect(within(screen.getByText("1,200")).getByRole("img", { name: "IxCredits" })).toBeVisible();
    expect(screen.getByText("On no wishlists yet")).toBeInTheDocument();
  });

  it("names a seller with no handle plainly, and points to the market when nothing is listed", () => {
    showSheet(
      sheet({
        market: { listings: [listing({ sellerHandle: null })], recentSales: [], wantedBy: 1 },
      })
    );
    const { unmount } = render(<CardSheet cardId="c1" from={null} onClose={jest.fn()} />);
    expect(screen.getByRole("list", { name: "Live listings" })).toHaveTextContent("A collector");
    unmount();
    showSheet();
    render(<CardSheet cardId="c1" from={null} onClose={jest.fn()} />);
    expect(screen.queryByRole("list", { name: "Live listings" })).toBeNull();
    expect(screen.getByRole("link", { name: "Look for it in the market" })).toBeInTheDocument();
  });

  it("says a listing whose time has run out has ended", () => {
    showSheet(
      sheet({
        market: {
          listings: [listing({ endTime: new Date(Date.now() - 60_000) })],
          recentSales: [],
          wantedBy: 0,
        },
      })
    );
    render(<CardSheet cardId="c1" from={null} onClose={jest.fn()} />);
    const list = screen.getByRole("list", { name: "Live listings" });
    expect(list).toHaveTextContent("@ann · Ended");
    expect(list).not.toHaveTextContent("left");
  });
});

describe("CardSheet about", () => {
  it("credits the stored author and skips asking the wiki", () => {
    showSheet(sheet({ card: { ...card, author: "imported>User:Kirav" } }));
    render(<CardSheet cardId="c1" from={null} onClose={jest.fn()} />);
    expect(screen.getByText("Article by Kirav")).toBeInTheDocument();
    expect(useAuthor()).toHaveBeenCalledWith(
      { articleTitle: "Caphiria", source: "ixwiki" },
      expect.objectContaining({ enabled: false })
    );
    expect(screen.getByText("Excerpt /wiki/Caphiria")).toBeInTheDocument();
  });

  it("asks the article's wiki for its author when none is stored, and hides a placeholder name", () => {
    useAuthor().mockReturnValue({ data: { authorInfo: { displayAuthor: "Velarc" } } } as never);
    showSheet(sheet({ card: { ...card, wikiSource: "iiwiki" } }));
    const { unmount } = render(<CardSheet cardId="c1" from={null} onClose={jest.fn()} />);
    expect(useAuthor()).toHaveBeenCalledWith(
      { articleTitle: "Caphiria", source: "iiwiki" },
      expect.objectContaining({ enabled: true })
    );
    expect(screen.getByText("Article by Velarc")).toBeInTheDocument();
    unmount();
    for (const placeholder of ["Unknown", "IxWiki community"]) {
      useAuthor().mockReturnValue({
        data: { authorInfo: { displayAuthor: placeholder } },
      } as never);
      const view = render(<CardSheet cardId="c1" from={null} onClose={jest.fn()} />);
      expect(screen.queryByText(/Article by/)).toBeNull();
      view.unmount();
    }
  });

  it("links a legacy Commons card, stored with no title, to its file page", () => {
    const upload = "https://upload.wikimedia.org/wikipedia/commons/4/45/Flag_of_Ireland.svg";
    showSheet(
      sheet({
        card: { ...card, wikiSource: "commons", wikiArticleTitle: null, descriptionUrl: upload },
      })
    );
    render(<CardSheet cardId="c1" from={null} onClose={jest.fn()} />);
    expect(
      screen.getByText("Excerpt https://commons.wikimedia.org/wiki/File:Flag_of_Ireland.svg")
    ).toBeInTheDocument();
    expect(useAuthor()).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ enabled: false })
    );
  });

  it("never asks Commons for an article author, even for a titled file", () => {
    showSheet(
      sheet({
        card: { ...card, wikiSource: "commons", wikiArticleTitle: "File:Flag of Ireland.svg" },
      })
    );
    render(<CardSheet cardId="c1" from={null} onClose={jest.fn()} />);
    expect(useAuthor()).toHaveBeenCalledWith(
      { articleTitle: "File:Flag of Ireland.svg", source: "ixwiki" },
      expect.objectContaining({ enabled: false })
    );
  });

  it("gives a card that is not lore its description and art credit", () => {
    showSheet(
      sheet({
        card: {
          ...card,
          cardType: "SPECIAL",
          description: "Given at the 2026 games.",
          artCredit: {
            line: "Photo by Ann, CC BY 4.0",
            licence: "CC BY 4.0",
            sourceUrl: "https://example.com/a",
          },
        },
      })
    );
    render(<CardSheet cardId="c1" from={null} onClose={jest.fn()} />);
    expect(screen.queryByText(/^Excerpt/)).toBeNull();
    expect(useAuthor()).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ enabled: false })
    );
    const about = screen.getByRole("region", { name: "About" });
    expect(within(about).getByText("Given at the 2026 games.")).toBeInTheDocument();
    expect(within(about).getByRole("link", { name: "Photo by Ann, CC BY 4.0" })).toHaveAttribute(
      "href",
      "https://example.com/a"
    );
  });

  it("tells the excerpt to hide the art for a silhouette or a retired card, but not for a held one", () => {
    const commons = {
      ...card,
      wikiSource: "commons",
      wikiArticleTitle: "File:Flag of Ireland.svg",
    };
    const page = "https://commons.wikimedia.org/wiki/File:Flag_of_Ireland.svg";
    showSheet(
      sheet({ card: commons, copies: [], face: { ...face, copy: null, silhouette: true } })
    );
    const view = render(<CardSheet cardId="c1" from={null} onClose={jest.fn()} />);
    expect(screen.getByText(`Excerpt ${page} without art`)).toBeInTheDocument();
    view.unmount();
    showSheet(sheet({ card: { ...card, isRetired: true }, face: { ...face, isRetired: true } }));
    const retired = render(<CardSheet cardId="c1" from={null} onClose={jest.fn()} />);
    expect(screen.getByText("Excerpt /wiki/Caphiria without art")).toBeInTheDocument();
    retired.unmount();
    showSheet(sheet({ card: commons }));
    render(<CardSheet cardId="c1" from={null} onClose={jest.fn()} />);
    expect(screen.getByText(`Excerpt ${page}`)).toBeInTheDocument();
  });

  it("adds the licence to the art credit when the line does not name it", () => {
    showSheet(
      sheet({
        card: {
          ...card,
          cardType: "SPECIAL",
          artCredit: { line: "Photo by Ann", licence: "CC BY 4.0", sourceUrl: null },
        },
      })
    );
    render(<CardSheet cardId="c1" from={null} onClose={jest.fn()} />);
    const about = screen.getByRole("region", { name: "About" });
    expect(within(about).getByText("Art: Photo by Ann · CC BY 4.0")).toBeInTheDocument();
  });

  it("points a wiki card to the takedown help", () => {
    showSheet();
    render(<CardSheet cardId="c1" from={null} onClose={jest.fn()} />);
    expect(screen.getByRole("link", { name: "How to ask for a takedown" })).toHaveAttribute(
      "href",
      "/help/vault/lore-cards#takedowns"
    );
  });

  it("keeps the NationStates credit and self-service takedown on an NS card", () => {
    const ns = {
      nation: "Testlandia",
      season: 3,
      region: "Lazarus",
      category: "Civil Rights Lovefest",
      cardUrl: null,
      nationUrl: "https://www.nationstates.net/nation=testlandia",
    };
    showSheet(
      sheet({ card: { ...card, cardType: "NS", wikiArticleTitle: null, wikiSource: null, ns } })
    );
    render(<CardSheet cardId="c1" from={null} onClose={jest.fn()} />);
    const about = screen.getByRole("region", { name: "About" });
    expect(within(about).queryByRole("link", { name: "How to ask for a takedown" })).toBeNull();
    fireEvent.click(within(about).getByRole("button", { name: /request takedown/ }));
    expect(screen.getByRole("alertdialog")).toHaveTextContent("Takedown for season 3");
  });
});
