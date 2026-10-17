/** The player cards sheet: a player's copies, packs, auctions and trades, and the admin tools on them. */
import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";

jest.mock("~/trpc/react", () => ({
  api: {
    useUtils: jest.fn(),
    cards: {
      admin: {
        overview: { findCards: { useQuery: jest.fn() } },
        packs: { list: { useQuery: jest.fn() } },
        tools: {
          playerCards: { useQuery: jest.fn() },
          grant: { useMutation: jest.fn() },
          revoke: { useMutation: jest.fn() },
          awardPack: { useMutation: jest.fn() },
          cancelAuction: { useMutation: jest.fn() },
          voidTrade: { useMutation: jest.fn() },
        },
      },
    },
  },
}));
jest.mock("~/hooks/useNotify", () => ({
  useNotify: () => ({ success: jest.fn(), error: jest.fn() }),
}));
jest.mock("~/components/ui/value-select", () =>
  jest.requireActual("~/tests/helpers/native-value-select")
);

import { api, type RouterOutputs } from "~/trpc/react";
import { PlayerCardsSheet } from "~/app/admin/vault/PlayerCardsSheet";

type Inventory = RouterOutputs["cards"]["admin"]["tools"]["playerCards"];
type Copy = Inventory["copies"][number];
type Auction = Inventory["auctions"][number];

const tools = api.cards.admin.tools;
const mutations = {
  grant: jest.fn(),
  revoke: jest.fn(),
  awardPack: jest.fn(),
  cancelAuction: jest.fn(),
  voidTrade: jest.fn(),
};

const copy = (over: Partial<Copy> = {}): Copy => ({
  id: "own_1",
  serialNumber: 3,
  finish: "STANDARD",
  isLocked: false,
  auctioned: false,
  acquiredAt: new Date(0),
  cards: { id: "card_1", title: "Elm", rarity: "RARE", cardType: "LORE", isBound: false },
  ...over,
});

const auction = (over: Partial<Auction> = {}): Auction => ({
  id: "auc_1",
  title: "Elm #3",
  selling: true,
  hasBid: true,
  currentBid: 120,
  bidCount: 2,
  endTime: new Date(0),
  ...over,
});

function setup(inventory: Partial<Inventory> = {}) {
  jest.mocked(api.useUtils).mockReturnValue({
    cards: { admin: { tools: { playerCards: { invalidate: jest.fn() } } } },
  } as never);
  jest.mocked(api.cards.admin.overview.findCards.useQuery).mockReturnValue({
    data: [{ id: "card_2", title: "Elmwood", cardType: "LORE", rarity: "COMMON" }],
  } as never);
  jest.mocked(api.cards.admin.packs.list.useQuery).mockReturnValue({
    data: [
      { id: "pack_1", name: "Founders", cardCount: 5, isActive: true },
      { id: "pack_2", name: "Jubilee", cardCount: 3, isActive: false },
    ],
  } as never);
  jest.mocked(tools.playerCards.useQuery).mockReturnValue({
    data: {
      copyCount: 1,
      room: 99,
      copies: [copy()],
      packs: [],
      auctions: [],
      trades: [],
      ...inventory,
    },
  } as never);
  // Each mutation succeeds at once, as the server would, so its dialog closes
  for (const [name, mutate] of Object.entries(mutations)) {
    jest.mocked(tools[name as keyof typeof mutations].useMutation).mockImplementation(((options: {
      onSuccess: (data: { serialNumber: number }) => void;
    }) => ({
      mutate: (input: object) => {
        mutate(input);
        options.onSuccess({ serialNumber: 7 });
      },
      isPending: false,
    })) as never);
  }
  render(
    <PlayerCardsSheet player={{ id: "user_1", displayName: "Elmland" }} onOpenChange={jest.fn()} />
  );
}

const openTab = (name: RegExp) =>
  fireEvent.mouseDown(screen.getByRole("tab", { name }), { button: 0, ctrlKey: false });

function confirmWithReason(title: string, reason: string, confirm: string) {
  const dialog = screen.getByRole("dialog", { name: title });
  fireEvent.change(within(dialog).getByLabelText("Reason"), { target: { value: reason } });
  fireEvent.click(within(dialog).getByRole("button", { name: confirm }));
}

beforeEach(() => jest.clearAllMocks());

it("lists a player's copies and revokes one with a reason", () => {
  setup();
  expect(screen.getByText("Elmland's cards")).toBeInTheDocument();
  expect(screen.getByText("1 copy · room for 99 more")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Revoke Elm #3" }));
  confirmWithReason("Revoke Elm #3", "Granted twice", "Revoke");
  expect(mutations.revoke).toHaveBeenCalledWith({ ownershipId: "own_1", reason: "Granted twice" });
});

it("offers no revoke for a locked, an auctioned or a trophy copy", () => {
  setup({
    copyCount: 3,
    room: null,
    copies: [
      copy({ isLocked: true }),
      copy({ id: "own_2", serialNumber: 4, auctioned: true }),
      copy({
        id: "own_3",
        serialNumber: 1,
        cards: { ...copy().cards, title: "Cup", cardType: "TROPHY" },
      }),
    ],
  });
  expect(screen.getByText("3 copies · no limit")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Revoke Elm #3" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Revoke Elm #4" })).toBeDisabled();
  expect(screen.queryByRole("button", { name: "Revoke Cup #1" })).not.toBeInTheDocument();
});

it("grants a card found among the grantable cards by title", () => {
  setup();
  fireEvent.change(screen.getByLabelText("Grant a card"), { target: { value: "Elm" } });
  // The server keeps only approved, unretired, non-trophy cards for this picker
  expect(api.cards.admin.overview.findCards.useQuery).toHaveBeenLastCalledWith(
    { query: "Elm", grantable: true },
    { enabled: true }
  );
  fireEvent.click(screen.getByRole("button", { name: "Elmwood · Lore" }));
  confirmWithReason("Grant Elmwood", "Event prize", "Grant");
  expect(mutations.grant).toHaveBeenCalledWith({
    userId: "user_1",
    cardId: "card_2",
    finish: "STANDARD",
    reason: "Event prize",
  });
});

it("awards any pack, marking the ones not on sale", () => {
  setup({
    packs: [
      { id: "up_1", name: "Founders", acquiredMethod: "PURCHASE", acquiredDate: new Date(0) },
    ],
  });
  openTab(/Packs/);
  expect(screen.getByText("Founders")).toBeInTheDocument();
  expect(
    screen.getByRole("option", { name: "Jubilee · 3 cards · not on sale" })
  ).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Award a pack"), { target: { value: "pack_2" } });
  fireEvent.click(screen.getByRole("button", { name: "Award pack" }));
  expect(mutations.awardPack).toHaveBeenCalledWith({ userId: "user_1", packId: "pack_2" });
});

it("cancels a live auction and voids a pending trade, each with a reason", () => {
  setup({
    auctions: [auction()],
    trades: [
      {
        id: "tr_1",
        initiating: true,
        copiesOffered: 1,
        copiesAsked: 2,
        creditsOffered: 0,
        creditsAsked: 0,
        expiresAt: new Date(0),
      },
    ],
  });
  openTab(/Auctions and trades/);
  expect(screen.getByText(/^Selling · 2 bids · 120 IxC · ends/)).toBeInTheDocument();
  expect(screen.getByText(/^1 card and 0 IxC for 2 cards and 0 IxC · expires/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Cancel auction of Elm #3" }));
  expect(
    screen.getByText(/the highest bid is refunded.*Both players are told why\./)
  ).toBeInTheDocument();
  confirmWithReason("Cancel the auction of Elm #3", "Seller asked", "Cancel auction");
  expect(mutations.cancelAuction).toHaveBeenCalledWith({
    auctionId: "auc_1",
    reason: "Seller asked",
  });

  fireEvent.click(screen.getByRole("button", { name: "Void trade offered by this player" }));
  confirmWithReason("Void this trade", "Scam report", "Void trade");
  expect(mutations.voidTrade).toHaveBeenCalledWith({ tradeId: "tr_1", reason: "Scam report" });
});

it("tells the admin only the seller hears of a cancel when no bid is held", () => {
  setup({ auctions: [auction({ hasBid: false, bidCount: 0, currentBid: 50 })] });
  openTab(/Auctions and trades/);
  fireEvent.click(screen.getByRole("button", { name: "Cancel auction of Elm #3" }));
  expect(
    screen.getByText(
      "The card goes back to the seller with half the listing fee. The seller is told why."
    )
  ).toBeInTheDocument();
  expect(screen.queryByText(/Both players/)).not.toBeInTheDocument();
});
