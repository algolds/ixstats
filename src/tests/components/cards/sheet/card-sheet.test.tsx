import React from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";

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
  useFacetReducedMotion: jest.fn(() => true),
}));
jest.mock("~/components/cards/display/CardPriceHistoryChart", () => ({
  CardPriceHistoryChart: () => <p>Value chart</p>,
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
    open ? <div role="alertdialog">Add {ownershipIds.join(",")}</div> : null,
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
jest.mock("~/components/ui/value-select", () =>
  jest.requireActual("~/tests/helpers/native-value-select")
);
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
import { useSheetEconomy } from "~/hooks/cards/useSheetEconomy";
import { useFacetReducedMotion } from "~/components/providers/FacetMotionConfig";
import { vaultNotify } from "~/lib/vault/vault-notifications";
import { CardSheet } from "~/components/cards/sheet/CardSheet";
import type { CardSheetData, SheetCopy, SheetSignIn } from "~/lib/cards/hub/sheet";
import type { CardFinish } from "~/lib/cards/face/types";

const realm = { id: "default", slug: "ixnay", name: "Ixnay", crestUrl: null, isSystem: false };
const face = {
  cardId: "c1",
  title: "Caphiria",
  rarity: "EPIC" as const,
  cardType: "LORE" as const,
  realm,
  artwork: null,
  uncollected: false,
  number: 9,
  season: null,
  isRetired: false,
  copy: { ownershipId: "o7", finish: "FOIL" as const, serialNumber: 7, level: 4 },
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
const ns = {
  nation: "Testlandia",
  season: 3,
  region: "Lazarus",
  category: "Civil Rights Lovefest",
  cardUrl: null,
  nationUrl: "https://www.nationstates.net/nation=testlandia",
};
const copy = (overrides: Partial<SheetCopy> = {}): SheetCopy => ({
  face,
  experience: 2400,
  acquiredAt: new Date("2026-10-01T12:00:00Z"),
  isLocked: false,
  inscription: null,
  trail: [],
  ...overrides,
});
/** A copy with its own serial (ownership id `o<serial>`), finish and level. */
const held = (
  serialNumber: number,
  finish: CardFinish,
  level: number,
  overrides: Partial<SheetCopy> = {}
): SheetCopy =>
  copy({
    face: { ...face, copy: { ownershipId: `o${serialNumber}`, finish, serialNumber, level } },
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
const notHeld = (cardOverrides: Partial<CardSheetData["card"]> = {}) =>
  sheet({
    card: { ...card, ...cardOverrides },
    copies: [],
    face: { ...face, copy: null, uncollected: true },
  });
/** What `cards.getSheetEconomy` says of copy o7; by default it may be listed, fused (with o8 and o9), broken down and signed. */
const economy = (
  overrides: Partial<{
    listingId: string | null;
    auctionId: string | null;
    breakdownBlocker: string | null;
    canSign: boolean;
    /** The one fusion group's copies; none when empty. */
    fusion: string[];
    wishlisted: boolean;
  }> = {}
) => {
  const { fusion = ["o7", "o8", "o9"], wishlisted = false, ...copyOverrides } = overrides;
  return {
    cardId: "c1",
    isBound: false,
    wishlisted,
    signerName: "Ann",
    copies: [
      {
        ownershipId: "o7",
        finish: "FOIL",
        value: 1500,
        dust: 45,
        breakdownBlocker: null,
        canSign: true,
        listingId: null,
        auctionId: null,
        ...copyOverrides,
      },
    ],
    fusionGroups: fusion.length > 0 ? [{ finish: "FOIL", next: "HOLO", ownershipIds: fusion }] : [],
    craft: null,
  };
};
const useSheet = () => jest.mocked(api.cards.getSheet.useQuery);
const useAuthor = () => jest.mocked(api.loreCards.getCardAuthorInfo.useQuery);
const showSheet = (data: CardSheetData | SheetSignIn | null = sheet()) =>
  useSheet().mockReturnValue({ data, isLoading: false } as never);
const showEconomy = (data: ReturnType<typeof economy> | undefined) =>
  jest.mocked(useSheetEconomy).mockReturnValue({ data } as never);
const sheetElement = () => <CardSheet cardId="c1" from={null} onClose={jest.fn()} />;
const open = () => render(sheetElement());
const copies = () => screen.getByRole("region", { name: "Your copies" });
const about = () => screen.getByRole("region", { name: "About" });
const actionGroup = (name: string) => within(copies()).getByRole("group", { name });
const actionNames = (group: HTMLElement) =>
  Array.from(group.querySelectorAll("button, a"), (el) => el.textContent);
const turnable = () =>
  screen.getByRole("group", { name: "The card. Press Space or F to turn it over." });

beforeEach(() => {
  window.history.replaceState(null, "", "/vault/cards/mine");
  jest.clearAllMocks();
  useAuthor().mockReturnValue({ data: undefined } as never);
  showEconomy(undefined);
  jest.mocked(useFacetReducedMotion).mockReturnValue(true);
});

describe("CardSheet header", () => {
  it("puts Copy link, Wishlist and Mute in the corner as icon buttons, the toggles pressed by state", () => {
    showSheet();
    showEconomy(economy({ wishlisted: true }));
    open();
    expect(screen.getByRole("button", { name: "Copy link" })).toHaveTextContent(/^$/);
    expect(screen.getByRole("button", { name: "Wishlist", pressed: true })).toHaveTextContent(/^$/);
    expect(
      screen.getByRole("button", { name: "Mute notices about this card", pressed: false })
    ).toHaveTextContent(/^$/);
    expect(screen.getByRole("heading", { name: "Caphiria" })).toBeInTheDocument();
    expect(screen.getByText("Epic · Ixnay · No. 9")).toBeInTheDocument();
  });

  it("gives a signed-out visitor only the link", () => {
    showSheet(sheet({ signedIn: false, copies: [], face: { ...face, copy: null } }));
    open();
    expect(screen.getByRole("button", { name: "Copy link" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Wishlist" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Mute/ })).toBeNull();
  });

  it("names each icon button in a tooltip too", () => {
    showSheet();
    showEconomy(economy());
    open();
    for (const [name, tip] of [
      ["Copy link", "Copy link"],
      ["Wishlist", "Add to wishlist"],
      ["Mute notices about this card", "Mute notices about this card"],
    ]) {
      fireEvent.focus(screen.getByRole("button", { name }));
      expect(screen.getByRole("tooltip")).toHaveTextContent(tip);
      fireEvent.blur(screen.getByRole("button", { name }));
    }
  });

  it("copies a link that opens this card in Explore", async () => {
    const writeText = jest.fn(() => Promise.resolve());
    Object.assign(navigator, { clipboard: { writeText } });
    showSheet();
    open();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copy link" }));
    });
    expect(writeText).toHaveBeenCalledWith("http://localhost/vault/cards/explore?card=c1");
    expect(vaultNotify.success).toHaveBeenCalledWith("Link copied", "Caphiria");
  });
});

describe("CardSheet card", () => {
  it("turns a held copy over when tapped and with F, with no button, and says which side shows", () => {
    showSheet();
    open();
    expect(screen.queryByRole("button", { name: /Show the/ })).toBeNull();
    expect(turnable().querySelector("[data-slot='turn-hint']")).not.toBeNull();
    fireEvent.click(within(turnable()).getByRole("img", { name: /Caphiria/ }));
    expect(screen.getByRole("status")).toHaveTextContent("Showing the back");
    expect(within(turnable()).getByText("Level 4 · 2,400 XP")).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "f" });
    expect(screen.getByRole("status")).toHaveTextContent("Showing the front");
  });

  it("never turns a card the viewer holds no copy of, and does not say it turns", () => {
    showSheet(notHeld());
    open();
    expect(screen.queryByRole("group", { name: /turn it over/ })).toBeNull();
    const hero = screen.getByRole("group", { name: "The card" });
    expect(hero.querySelector("[data-slot='turn-hint']")).toBeNull();
    expect(hero.querySelector(".cursor-pointer")).toBeNull();
    fireEvent.click(within(hero).getByRole("img", { name: /Caphiria/ }));
    // Unclaimed, so Space still scrolls the sheet.
    expect(fireEvent.keyDown(window, { key: "f" })).toBe(true);
    expect(fireEvent.keyDown(document.body, { key: " " })).toBe(true);
    expect(screen.getByRole("status")).toHaveTextContent(/^$/);
  });

  it("turns only a held copy under full motion too, its back inert until it shows", () => {
    jest.mocked(useFacetReducedMotion).mockReturnValue(false);
    showSheet();
    const view = open();
    const back = () => within(turnable()).getByText("Level 4 · 2,400 XP").closest("[inert]");
    expect(turnable().querySelector("[data-slot='turn-hint']")).not.toBeNull();
    expect(back()).not.toBeNull();
    fireEvent.click(within(turnable()).getByRole("img", { name: /Caphiria/ }));
    expect(back()).toBeNull();
    showSheet(notHeld());
    view.rerender(sheetElement());
    const hero = screen.getByRole("group", { name: "The card" });
    expect(hero.querySelector("[data-slot='turn-hint']")).toBeNull();
    expect(within(hero).queryByText(/XP/)).toBeNull();
  });

  it("tells this copy's story on the back, and none of the NationStates notice or art credit", () => {
    const signed = held(12, "HOLO", 6, {
      experience: 5100,
      inscription: { text: "For Ann", signerName: "Bea", signedAt: new Date(2026, 9, 3) },
      trail: [
        {
          id: "t1",
          action: "TRADE",
          from: { name: "Cal" },
          to: { name: "Bea" },
          price: null,
          at: new Date("2026-10-04T12:00:00Z"),
        },
      ],
    });
    showSheet(
      sheet({
        card: {
          ...card,
          cardType: "NS",
          wikiArticleTitle: null,
          wikiSource: null,
          ns,
          artCredit: { line: "Photo by Ann", licence: "CC BY 4.0", sourceUrl: null },
        },
        copies: [signed],
      })
    );
    open();
    fireEvent.keyDown(window, { key: "f" });
    const back = turnable();
    expect(within(back).getByText("#12 · Holo")).toBeInTheDocument();
    expect(within(back).getByText("For Ann")).toBeInTheDocument();
    expect(within(back).getByText("Signed by Bea on October 3, 2026")).toBeInTheDocument();
    expect(within(back).getByText("Level 6 · 5,100 XP")).toBeInTheDocument();
    expect(within(back).getAllByRole("listitem")).toHaveLength(1);
    expect(within(back).queryByText(/Testlandia/)).toBeNull();
    expect(within(back).queryByRole("link")).toBeNull();
    expect(within(back).queryByText(/NationStates API/)).toBeNull();
    expect(within(back).queryByText(/Photo by Ann/)).toBeNull();
  });
});

describe("CardSheet your copies", () => {
  const five = [
    held(9, "FOIL", 4),
    held(5, "FOIL", 2),
    held(3, "FOIL", 4),
    held(20, "HOLO", 1),
    held(40, "SERIALISED", 1),
  ];

  it("picks from up to five copies in a radio group, best first, the best picked", () => {
    showSheet(sheet({ copies: five }));
    open();
    const picker = within(copies()).getByRole("radiogroup", { name: "Pick a copy" });
    expect(
      within(picker)
        .getAllByRole("radio")
        .map((r) => r.textContent)
    ).toEqual([
      "#40 · Serialised · Level 1",
      "#20 · Holo · Level 1",
      "#3 · Foil · Level 4",
      "#9 · Foil · Level 4",
      "#5 · Foil · Level 2",
    ]);
    expect(within(picker).getByRole("radio", { checked: true })).toHaveTextContent("#40");
    expect(within(copies()).queryByRole("combobox")).toBeNull();
    expect(actionGroup("#40 · Serialised · Level 1")).toBeInTheDocument();
  });

  it("moves the action bar and the card to the copy picked", () => {
    showSheet(sheet({ copies: five }));
    open();
    fireEvent.click(within(copies()).getByRole("radio", { name: "#3 · Foil · Level 4" }));
    const bar = actionGroup("#3 · Foil · Level 4");
    fireEvent.click(within(bar).getByRole("button", { name: "Add to showcase" }));
    expect(screen.getByRole("alertdialog")).toHaveTextContent("Add o3");
    expect(within(turnable()).getByText("Level 4 · #3")).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "f" });
    expect(within(turnable()).getByText("#3 · Foil")).toBeInTheDocument();
  });

  it("asks nothing of a single copy", () => {
    showSheet();
    open();
    expect(within(copies()).queryByRole("radiogroup")).toBeNull();
    expect(within(copies()).queryByRole("combobox")).toBeNull();
    expect(actionGroup("#7 · Foil · Level 4")).toBeInTheDocument();
  });

  it("gives six or more copies one dropdown of them all, best first, with the count", () => {
    showSheet(sheet({ copies: [...five, held(1, "STANDARD", 9)] }));
    open();
    expect(within(copies()).queryByRole("radiogroup")).toBeNull();
    const menu = within(copies()).getByRole("combobox", { name: "Pick a copy" });
    expect(
      within(menu)
        .getAllByRole("option")
        .map((o) => o.textContent)
    ).toEqual([
      "#40 · Serialised · Level 1",
      "#20 · Holo · Level 1",
      "#3 · Foil · Level 4",
      "#9 · Foil · Level 4",
      "#5 · Foil · Level 2",
      "#1 · Standard · Level 9",
    ]);
    expect(menu).toHaveValue("o40");
    expect(within(copies()).getByText("6 copies")).toBeInTheDocument();
    fireEvent.change(menu, { target: { value: "o1" } });
    expect(actionGroup("#1 · Standard · Level 9")).toBeInTheDocument();
  });

  it("heads the bar with the copy's value and its facts as labelled chips, the tooltip saying more", () => {
    showSheet(sheet({ copies: [copy({ isLocked: true })] }));
    showEconomy(economy({ listingId: "l1" }));
    open();
    const bar = actionGroup("#7 · Foil · Level 4");
    expect(bar).toHaveTextContent("1,500");
    // Shown, not left to a tooltip or a screen reader: keyboard users read them too.
    const since = within(bar).getByText("Since Oct 1, 2026");
    const locked = within(bar).getByText("Locked");
    for (const chip of [since, locked]) {
      expect(chip).not.toHaveClass("sr-only");
      expect(chip).not.toHaveAttribute("aria-hidden");
      expect(chip).not.toHaveAttribute("role");
    }
    fireEvent.focus(since);
    expect(screen.getByRole("tooltip")).toHaveTextContent(
      "In your collection since October 1, 2026"
    );
    fireEvent.blur(since);
    fireEvent.focus(locked);
    expect(screen.getByRole("tooltip")).toHaveTextContent("In a listing or trade");
  });

  it("chips no lock on a copy that is free", () => {
    showSheet();
    open();
    expect(within(copies()).queryByText("Locked")).toBeNull();
  });

  it("groups a free copy's actions into Sell, Workshop and Keep", () => {
    showSheet();
    showEconomy(economy());
    open();
    expect(actionNames(actionGroup("Sell"))).toEqual(["List", "Auction", "Trade"]);
    expect(actionNames(actionGroup("Workshop"))).toEqual(["Fuse", "Break down"]);
    expect(actionNames(actionGroup("Keep"))).toEqual(["Add to showcase", "Sign"]);
    expect(within(actionGroup("Sell")).getByRole("link", { name: "Auction" })).toHaveAttribute(
      "href",
      "/vault/cards/market?tab=selling&sell=o7"
    );
    expect(within(actionGroup("Sell")).getByRole("link", { name: "Trade" })).toHaveAttribute(
      "href",
      "/vault/cards/market?tab=trades&trade=new&give=o7"
    );
  });

  it("fills every action in the bar, none left as bare text", () => {
    showSheet();
    showEconomy(economy());
    open();
    const actions = ["Sell", "Workshop", "Keep"].flatMap((name) =>
      Array.from(actionGroup(name).querySelectorAll("button, a"))
    );
    expect(actions).toHaveLength(7);
    for (const action of actions) expect(action).toHaveClass("bg-fill-3");
  });

  it("keeps each workshop action to its own rule, and leaves the group out when neither is open", () => {
    showSheet();
    showEconomy(economy({ fusion: ["o8", "o9", "o10"] }));
    const view = open();
    expect(actionNames(actionGroup("Workshop"))).toEqual(["Break down"]);
    showEconomy(economy({ breakdownBlocker: "Signed copies can't be broken down" }));
    view.rerender(sheetElement());
    expect(actionNames(actionGroup("Workshop"))).toEqual(["Fuse"]);
    showEconomy(economy({ fusion: [], breakdownBlocker: "Locked", canSign: false }));
    view.rerender(sheetElement());
    expect(within(copies()).queryByRole("group", { name: "Workshop" })).toBeNull();
    expect(actionNames(actionGroup("Keep"))).toEqual(["Add to showcase"]);
  });

  it("offers the auction and the trade before the economy loads, but not the listing or the workshop", () => {
    showSheet();
    open();
    expect(actionNames(actionGroup("Sell"))).toEqual(["Auction", "Trade"]);
    expect(within(copies()).queryByRole("group", { name: "Workshop" })).toBeNull();
    expect(actionNames(actionGroup("Keep"))).toEqual(["Add to showcase"]);
  });

  it.each([
    ["listed", { listingId: "l1" }],
    ["at auction", { auctionId: "a1" }],
  ])("points a copy %s to Selling in place of the Sell actions", (_how, where) => {
    showSheet(sheet({ copies: [copy({ isLocked: true })] }));
    showEconomy(economy(where));
    open();
    expect(actionNames(actionGroup("Sell"))).toEqual(["See it in Selling"]);
    expect(within(actionGroup("Sell")).getByRole("link")).toHaveAttribute(
      "href",
      "/vault/cards/market?tab=selling"
    );
    expect(within(actionGroup("Sell")).getByRole("link")).toHaveClass("bg-fill-3");
  });

  it("points a copy offered in a trade to Trades, once the economy says it is not on sale", () => {
    showSheet(sheet({ copies: [copy({ isLocked: true })] }));
    const view = open();
    expect(within(copies()).queryByRole("group", { name: "Sell" })).toBeNull();
    showEconomy(economy());
    view.rerender(sheetElement());
    expect(actionNames(actionGroup("Sell"))).toEqual(["See it in Trades"]);
    expect(within(actionGroup("Sell")).getByRole("link")).toHaveAttribute(
      "href",
      "/vault/cards/market?tab=trades"
    );
  });

  it("never offers a bound card for sale, nor points it to Selling", () => {
    showSheet(sheet({ card: { ...card, isBound: true }, copies: [copy({ isLocked: true })] }));
    showEconomy(economy({ listingId: "l1" }));
    open();
    expect(within(copies()).getByText("Bound to your account")).toBeInTheDocument();
    expect(within(copies()).queryByRole("group", { name: "Sell" })).toBeNull();
    expect(within(copies()).queryByRole("link")).toBeNull();
    expect(actionGroup("Keep")).toBeInTheDocument();
  });

  it("links a card the viewer lacks to packs, the market and trades", () => {
    showSheet(notHeld());
    open();
    const links = within(copies()).getAllByRole("link");
    expect(links.map((l) => [l.textContent, l.getAttribute("href")])).toEqual([
      ["Packs", "/vault/store?view=packs"],
      ["Market", "/vault/cards/market?for=c1"],
      ["Trades", "/vault/cards/market?tab=trades"],
    ]);
    expect(within(copies()).queryByText(/You do not have this card yet/)).toBeNull();
  });

  it("never links a Special card to packs, which never give one", () => {
    showSheet(notHeld({ cardType: "SPECIAL" }));
    open();
    expect(
      within(copies())
        .getAllByRole("link")
        .map((l) => l.textContent)
    ).toEqual(["Market", "Trades"]);
  });

  it.each([
    [
      "bound",
      { isBound: true },
      "You do not have this card yet. It is earned as a reward, and never traded or sold.",
    ],
    ["retired", { isRetired: true }, "You do not have this card yet."],
  ])("gives a %s card the viewer lacks one short line and no links", (_kind, over, line) => {
    showSheet(notHeld(over));
    open();
    expect(within(copies()).getByText(line)).toBeInTheDocument();
    expect(within(copies()).queryAllByRole("link")).toHaveLength(0);
  });
});

describe("CardSheet layout", () => {
  const sold = {
    listings: [],
    recentSales: [{ price: 120, finish: null, at: new Date(2026, 9, 1) }],
    wantedBy: 12,
  };
  const regionNames = () =>
    screen
      .getAllByRole("region")
      .map((region) => within(region).getAllByRole("heading")[0]?.textContent);

  it("puts About under the market's value, and the price history last", () => {
    showSheet(sheet({ market: sold }));
    open();
    expect(regionNames()).toEqual(["Your copies", "Market", "About", "Price history"]);
  });

  it("keeps the value chart and the recent sales folded until asked for", () => {
    showSheet(sheet({ market: sold }));
    open();
    const toggle = screen.getByRole("button", { name: "Price history" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Value chart")).toBeNull();
    expect(screen.queryByRole("list", { name: "Recent sales" })).toBeNull();
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Value chart")).toBeInTheDocument();
    expect(
      within(screen.getByRole("list", { name: "Recent sales" })).getByText("120")
    ).toBeInTheDocument();
  });

  it("gives a visitor the price history only when something has sold, and never the chart", () => {
    showSheet(sheet({ signedIn: false, copies: [] }));
    const view = open();
    expect(screen.queryByRole("button", { name: "Price history" })).toBeNull();
    showSheet(sheet({ signedIn: false, copies: [], market: sold }));
    view.rerender(sheetElement());
    fireEvent.click(screen.getByRole("button", { name: "Price history" }));
    expect(screen.getByRole("list", { name: "Recent sales" })).toBeInTheDocument();
    expect(screen.queryByText("Value chart")).toBeNull();
  });

  it("gives a player the price history before anything has sold, for the chart", () => {
    showSheet();
    open();
    fireEvent.click(screen.getByRole("button", { name: "Price history" }));
    expect(screen.getByText("Value chart")).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Recent sales" })).toBeNull();
  });
});

describe("CardSheet about", () => {
  it("joins the author, the art credit and its licence in one caption", () => {
    showSheet(
      notHeld({
        author: "Ann",
        artCredit: { line: "Photo by Ann", licence: "CC BY 4.0", sourceUrl: null },
      })
    );
    open();
    const caption = within(about()).getByText("Art: Photo by Ann · CC BY 4.0").closest("p");
    expect(caption).toHaveTextContent(/^Article by Ann · Art: Photo by Ann · CC BY 4\.0$/);
    expect(caption).toHaveClass("text-footnote", "text-label-secondary");
  });

  it("gives an NS card its facts line, and puts the NationStates notice and takedown behind (i)", () => {
    showSheet(
      sheet({ card: { ...card, cardType: "NS", wikiArticleTitle: null, wikiSource: null, ns } })
    );
    open();
    const facts = within(about()).getByRole("link", { name: "View on NationStates" });
    expect(facts).toHaveAttribute("href", ns.nationUrl);
    expect(facts.parentElement).toHaveTextContent(
      "Testlandia · season 3 · Lazarus · Civil Rights Lovefest · View on NationStates"
    );
    expect(screen.queryByText(/Not affiliated with or endorsed by NationStates/)).toBeNull();
    expect(within(about()).queryByRole("button", { name: /takedown/ })).toBeNull();
    expect(within(about()).queryByRole("link", { name: "How to ask for a takedown" })).toBeNull();

    const infoButton = within(about()).getByRole("button", { name: "About NationStates data" });
    expect(infoButton.closest("p")).toHaveTextContent(/^Data from NationStates$/);
    fireEvent.click(infoButton);
    const info = screen.getByRole("dialog", { name: "About NationStates data" });
    expect(info).toHaveTextContent(/Not affiliated with or endorsed by NationStates/);
    fireEvent.click(within(info).getByRole("button", { name: "Verify & request takedown" }));
    expect(screen.getByRole("alertdialog")).toHaveTextContent("Takedown for season 3");
  });

  it("ends a wiki card's About with a quiet takedown request, or the help for a visitor", () => {
    showSheet();
    const view = open();
    expect(within(about()).getByRole("button", { name: "Request a takedown" })).toBeInTheDocument();
    showSheet(sheet({ signedIn: false, copies: [] }));
    view.rerender(sheetElement());
    expect(
      within(about()).getByRole("link", { name: "How to ask for a takedown" })
    ).toHaveAttribute("href", "/help/vault/lore-cards#takedowns");
  });
});
