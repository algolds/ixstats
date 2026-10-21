import React from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";

jest.mock("~/trpc/react", () => ({
  api: {
    cards: {
      getSheet: { useQuery: jest.fn() },
      requestTakedown: { useMutation: jest.fn(() => ({ mutate: jest.fn(), isPending: false })) },
    },
    loreCards: { getCardAuthorInfo: { useQuery: jest.fn(() => ({ data: undefined })) } },
  },
}));
jest.mock("~/components/providers/FacetMotionConfig", () => ({
  useFacetReducedMotion: () => true,
}));
jest.mock("~/components/cards/display/CardPriceHistoryChart", () => ({
  CardPriceHistoryChart: () => <p>Price history</p>,
}));
jest.mock("~/components/cards/display/LoreWikiExcerpt", () => ({
  LoreWikiExcerpt: ({ wikiUrl, artHidden }: { wikiUrl: string | null; artHidden?: boolean }) => (
    <p>
      Excerpt {wikiUrl}
      {artHidden ? " without art" : ""}
    </p>
  ),
}));
jest.mock("next/navigation", () => ({
  usePathname: jest.fn(() => "/vault/cards/mine"),
  useSearchParams: jest.fn(() => new URLSearchParams()),
}));
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
jest.mock("~/hooks/cards/useSheetEconomy", () => ({
  useSheetEconomy: jest.fn(() => ({ data: undefined })),
}));
jest.mock("~/hooks/cards/useMarketActions", () => {
  const mutation = () => ({ mutate: jest.fn(), isPending: false });
  const actions = { wish: mutation(), unwish: mutation(), setMute: mutation(), buy: mutation() };
  return {
    useMarketActions: jest.fn(() => actions),
    useCardMute: jest.fn(() => ({ data: false })),
  };
});
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

import { usePathname, useSearchParams } from "next/navigation";
import { api } from "~/trpc/react";
import { vaultNotify } from "~/lib/vault/vault-notifications";
import { CardSheet } from "~/components/cards/sheet/CardSheet";
import { useCardMute } from "~/hooks/cards/useMarketActions";
import { useSheetEconomy } from "~/hooks/cards/useSheetEconomy";
import type { CardSheetData, SheetCopy, SheetListing, SheetSignIn } from "~/lib/cards/hub/sheet";

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
  signedIn: true,
  card,
  copies: [copy()],
  market: { listings: [], recentSales: [], wantedBy: 12 },
  ...overrides,
});
const listing = (overrides: Partial<SheetListing> = {}): SheetListing => ({
  kind: "auction",
  id: "a1",
  ownershipId: "o5",
  price: 900,
  buyoutPrice: null,
  endsAt: new Date(Date.now() + 3 * 3_600_000 + 12 * 60_000 + 30_000),
  bidCount: 2,
  sellerName: "@ann",
  isMine: false,
  finish: "STANDARD",
  serialNumber: 3,
  inscription: null,
  ...overrides,
});

const useSheet = () => jest.mocked(api.cards.getSheet.useQuery);
const useAuthor = () => jest.mocked(api.loreCards.getCardAuthorInfo.useQuery);
const showSheet = (data: CardSheetData | SheetSignIn | null = sheet()) =>
  useSheet().mockReturnValue({ data, isLoading: false } as never);

beforeEach(() => {
  // A page with no sheet open, so open() in the focus tests always pushes.
  window.history.replaceState(null, "", "/vault/cards/mine");
  jest.clearAllMocks();
  useAuthor().mockReturnValue({ data: undefined } as never);
});

describe("CardSheet", () => {
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
  it("asks a signed-out visitor to sign in, and brings them back to this card", () => {
    jest.mocked(usePathname).mockReturnValueOnce("/@takatta");
    jest
      .mocked(useSearchParams)
      .mockReturnValueOnce(
        new URLSearchParams("tab=collection&card=c1&from=holder.takatta") as never
      );
    showSheet({ signIn: true });
    render(<CardSheet cardId="c1" from={null} onClose={jest.fn()} />);
    expect(screen.getByText("Sign in to see this card")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      `/sign-in?redirect_url=${encodeURIComponent("/@takatta?tab=collection&card=c1&from=holder.takatta")}`
    );
    expect(screen.queryByText("This card is not available")).toBeNull();
    expect(screen.queryByText("Could not load this card")).toBeNull();
    expect(screen.getByRole("dialog", { name: "Card" })).toBeInTheDocument();
  });

  it("shows a signed-out visitor the card and its market, with no copies or price history to ask for", () => {
    showSheet(sheet({ signedIn: false, copies: [], face: { ...face, copy: null } }));
    render(<CardSheet cardId="c1" from={null} onClose={jest.fn()} />);
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("heading", { level: 2, name: "Caphiria" })).toBeInTheDocument();
    expect(
      within(dialog)
        .getAllByRole("heading", { level: 3 })
        .map((h) => h.textContent)
    ).toEqual(["Market", "About"]);
    expect(screen.queryByText(/You do not have this card yet/)).toBeNull();
    expect(screen.queryByText("Price history")).toBeNull();
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

  // jsdom has no layout: these are the classes that keep the card inside a 320 px phone's column and below the
  // bottom sheet's close button (at top-4 right-4, over the column's top-right corner on a narrow phone).
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
});

describe("CardSheet header", () => {
  afterEach(() =>
    jest.mocked(useSheetEconomy).mockImplementation(() => ({ data: undefined }) as never)
  );

  it("gives a signed-in player the wishlist and the mute beside the link", () => {
    jest.mocked(useSheetEconomy).mockReturnValue({
      data: { isBound: false, wishlisted: false, craft: null, copies: [], fusionGroups: [] },
    } as never);
    showSheet();
    render(<CardSheet cardId="c1" from={null} onClose={jest.fn()} />);
    const header = screen.getByRole("heading", { level: 2, name: "Caphiria" }).closest("header")!;
    expect(within(header).getByRole("button", { name: "Copy link" })).toBeInTheDocument();
    expect(within(header).getByRole("button", { name: "Add to wishlist" })).toBeInTheDocument();
    expect(
      within(header).getByRole("button", { name: "Mute notices about this card" })
    ).toBeInTheDocument();
    expect(useCardMute).toHaveBeenCalledWith("c1");
  });

  it("gives a visitor neither, and asks nothing about them", () => {
    showSheet(sheet({ signedIn: false, copies: [], face: { ...face, copy: null } }));
    render(<CardSheet cardId="c1" from={null} onClose={jest.fn()} />);
    expect(screen.getByRole("button", { name: "Copy link" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /wishlist/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /notices about this card/ })).toBeNull();
    expect(useCardMute).not.toHaveBeenCalled();
    expect(useSheetEconomy).not.toHaveBeenCalledWith("c1");
    expect(useSheetEconomy).toHaveBeenCalledWith("c1", false);
  });
});

describe("CardSheet market", () => {
  it("lists live listings by seller, time left and bid, and links to bid", () => {
    showSheet(
      sheet({
        market: {
          listings: [
            listing(),
            listing({ id: "a2", sellerName: null, isMine: true, price: 1500 }),
            // The server names a seller with no handle by their nation, and the sheet adds nothing.
            listing({ id: "a3", sellerName: "Caphiria" }),
          ],
          recentSales: [{ price: 800, finish: "STANDARD", at: new Date("2026-10-10T00:00:00Z") }],
          wantedBy: 0,
        },
      })
    );
    render(<CardSheet cardId="c1" from={null} onClose={jest.fn()} />);
    const listings = within(screen.getByRole("list", { name: "Live listings" })).getAllByRole(
      "listitem"
    );
    expect(listings[0]).toHaveTextContent("@ann · Standard #3 · 3h 12m left");
    expect(listings[0]).toHaveTextContent("900");
    expect(listings[1]).toHaveTextContent("Your listing");
    expect(listings[1]).toHaveTextContent("1,500");
    expect(listings[2]).toHaveTextContent(/^Caphiria · /);
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
  it("offers a signed-in player a takedown request for a wiki card, and points a visitor to the help", () => {
    showSheet();
    const { unmount } = render(<CardSheet cardId="c1" from={null} onClose={jest.fn()} />);
    const about = screen.getByRole("region", { name: "About" });
    expect(within(about).getByRole("button", { name: "Request a takedown" })).toBeInTheDocument();
    expect(within(about).queryByRole("link", { name: "How to ask for a takedown" })).toBeNull();
    unmount();

    showSheet(sheet({ signedIn: false, copies: [] }));
    render(<CardSheet cardId="c1" from={null} onClose={jest.fn()} />);
    expect(screen.getByRole("link", { name: "How to ask for a takedown" })).toHaveAttribute(
      "href",
      "/help/vault/lore-cards#takedowns"
    );
    expect(screen.queryByRole("button", { name: "Request a takedown" })).toBeNull();
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
