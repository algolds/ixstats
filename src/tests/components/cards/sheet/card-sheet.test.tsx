import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";

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
import { api } from "~/trpc/react";
import { CardSheet } from "~/components/cards/sheet/CardSheet";
import type { CardSheetData, SheetCopy, SheetSignIn } from "~/lib/cards/hub/sheet";

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
describe("CardSheet about", () => {
  it("tells the excerpt to hide the art for a retired card only, not for one the viewer does not hold", () => {
    const commons = {
      ...card,
      wikiSource: "commons",
      wikiArticleTitle: "File:Flag of Ireland.svg",
    };
    const page = "https://commons.wikimedia.org/wiki/File:Flag_of_Ireland.svg";
    showSheet(
      sheet({ card: commons, copies: [], face: { ...face, copy: null, uncollected: true } })
    );
    const view = render(<CardSheet cardId="c1" from={null} onClose={jest.fn()} />);
    expect(screen.getByText(`Excerpt ${page}`)).toBeInTheDocument();
    view.unmount();
    showSheet(sheet({ card: { ...card, isRetired: true }, face: { ...face, isRetired: true } }));
    const retired = render(<CardSheet cardId="c1" from={null} onClose={jest.fn()} />);
    expect(screen.getByText("Excerpt /wiki/Caphiria without art")).toBeInTheDocument();
    retired.unmount();
    showSheet(sheet({ card: commons }));
    render(<CardSheet cardId="c1" from={null} onClose={jest.fn()} />);
    expect(screen.getByText(`Excerpt ${page}`)).toBeInTheDocument();
  });

  it("adds the licence to the art credit when the line does not name it, held or not, since the art shows", () => {
    showSheet(
      sheet({
        card: {
          ...card,
          cardType: "SPECIAL",
          artCredit: { line: "Photo by Ann", licence: "CC BY 4.0", sourceUrl: null },
        },
        copies: [],
        face: { ...face, copy: null, uncollected: true },
      })
    );
    render(<CardSheet cardId="c1" from={null} onClose={jest.fn()} />);
    const about = screen.getByRole("region", { name: "About" });
    expect(within(about).getByText("Art: Photo by Ann · CC BY 4.0")).toBeInTheDocument();
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
