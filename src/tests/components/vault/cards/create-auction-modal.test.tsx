import "react";
import { act, fireEvent, render, screen } from "@testing-library/react";

jest.mock("~/trpc/react", () => ({
  api: {
    cards: { listMine: { useInfiniteQuery: jest.fn(), useQuery: jest.fn() } },
    cardMarket: { createAuction: { useMutation: jest.fn() } },
  },
}));
jest.mock("~/hooks/useDebounce", () => ({ useDebounce: <T,>(value: T) => value }));
jest.mock("~/hooks/useCardsRefresh", () => {
  const refreshCards = jest.fn();
  return { useCardsRefresh: () => refreshCards };
});
jest.mock("~/lib/vault/vault-notifications", () => ({
  vaultNotify: { success: jest.fn(), error: jest.fn() },
}));
jest.mock("~/hooks/cards/useSheetEconomy", () => ({ useEconomyNumbers: jest.fn() }));

import { api } from "~/trpc/react";
import { useCardsRefresh } from "~/hooks/useCardsRefresh";
import { useEconomyNumbers } from "~/hooks/cards/useSheetEconomy";
import { CARD_ECONOMY_DEFAULTS } from "~/lib/cards/economy-config";
import { vaultNotify } from "~/lib/vault/vault-notifications";
import { CreateAuctionModal } from "~/components/vault/cards/market/CreateAuctionModal";

const realm = { id: "default", slug: "ixnay", name: "Ixnay", crestUrl: null, isSystem: false };
const row = (
  ownershipId: string,
  serialNumber: number,
  isLocked = false,
  isBound = false,
  title = "Caphiria"
) => ({
  face: {
    cardId: "c1",
    title,
    rarity: "EPIC" as const,
    cardType: "LORE" as const,
    realm,
    artwork: null,
    uncollected: false,
    number: 1,
    season: null,
    isRetired: false,
    copy: { ownershipId, finish: "FOIL" as const, serialNumber, level: 1 },
  },
  value: 100,
  copies: 3,
  acquiredAt: new Date("2026-10-01T00:00:00Z"),
  isLocked,
  isBound,
});

const refreshCards = jest.mocked(useCardsRefresh());
type Listed = (result: { message: string }) => void;
let mutate: jest.Mock;
let onSuccess: Listed = () => undefined;

type Row = ReturnType<typeof row>;
const fetchNextPage = jest.fn();
/** Mine as the picker pages it: `pages` of copies, and whether a further page waits. */
const mine = (pages: Row[][], hasNextPage = false) =>
  jest.mocked(api.cards.listMine.useInfiniteQuery).mockReturnValue({
    data: { pages: pages.map((rows) => ({ rows })) },
    isLoading: false,
    hasNextPage,
    isFetchingNextPage: false,
    fetchNextPage,
  } as never);
/** The copy a `?sell=` link names, as the picker reads it on its own. */
const linked = (copy: Row | null) =>
  jest
    .mocked(api.cards.listMine.useQuery)
    .mockReturnValue({ data: copy ? { rows: [copy] } : undefined } as never);
beforeEach(() => {
  refreshCards.mockClear();
  fetchNextPage.mockClear();
  mutate = jest.fn();
  jest.mocked(useEconomyNumbers).mockReturnValue({ data: undefined } as never);
  mine([[row("o1", 4), row("o2", 9), row("o3", 12, true), row("o4", 20, false, true)]]);
  linked(null);
  jest.mocked(api.cardMarket.createAuction.useMutation).mockImplementation(((options: {
    onSuccess: typeof onSuccess;
  }) => {
    onSuccess = options.onSuccess;
    return { mutate, isPending: false };
  }) as never);
});

const field = (name: RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(name), { target: { value } });
const list = () => screen.getByRole("button", { name: "List it" });
const landed = (message: string) =>
  act(() => {
    onSuccess({ message });
    (mutate.mock.calls.at(-1)?.[1] as { onSuccess: Listed }).onSuccess({ message });
  });

describe("CreateAuctionModal", () => {
  it("says what listing costs and what comes back, from the Economy tab's numbers", () => {
    jest.mocked(useEconomyNumbers).mockReturnValue({
      data: { economy: { ...CARD_ECONOMY_DEFAULTS, listingFee: 8, listingRefundPct: 25 } },
    } as never);
    render(<CreateAuctionModal open onClose={jest.fn()} />);
    expect(
      screen.getByText("Listing costs 8 IxC, and 2 IxC comes back if the card does not sell.")
    ).toBeInTheDocument();
  });
  it("closes once the copy is listed, and reads the listed copy's places again", () => {
    const onClose = jest.fn();
    render(<CreateAuctionModal open onClose={onClose} initialOwnershipId="o1" />);
    field(/Starting price/, "25");
    fireEvent.click(list());
    expect(refreshCards).not.toHaveBeenCalled();
    landed("Auction created");
    expect(vaultNotify.success).toHaveBeenCalledWith("Auction created");
    expect(refreshCards).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
