import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";

jest.mock("~/trpc/react", () => ({
  api: {
    trading: {
      getTradeById: { useQuery: jest.fn() },
      respondToTrade: { useMutation: jest.fn(() => ({ mutate: jest.fn(), isPending: false })) },
      cancelTrade: { useMutation: jest.fn(() => ({ mutate: jest.fn(), isPending: false })) },
    },
  },
}));
jest.mock("~/lib/vault/vault-notifications", () => ({
  vaultNotify: { tradeCompleted: jest.fn(), error: jest.fn() },
}));
jest.mock("~/hooks/useCardsRefresh", () => {
  const refreshCards = jest.fn();
  return { useCardsRefresh: () => refreshCards };
});

import { api } from "~/trpc/react";
import { useCardsRefresh } from "~/hooks/useCardsRefresh";
import { TradeNegotiation } from "~/components/cards/trading/TradeNegotiation";

const refreshCards = jest.mocked(useCardsRefresh());

const realm = { id: "default", slug: "ixnay", name: "Ixnay", crestUrl: null, isSystem: false };
const face = (cardId: string, title: string, ownershipId: string) => ({
  cardId,
  title,
  rarity: "RARE" as const,
  cardType: "LORE" as const,
  realm,
  artwork: null,
  silhouette: false,
  number: 1,
  season: null,
  isRetired: false,
  copy: { ownershipId, finish: "STANDARD" as const, serialNumber: 1, level: 1 },
});
const HOUR = 3_600_000;

/** Ann offered Caphiria and 25 IxC for Max's Urcea. */
function trade(overrides: Record<string, string | number | Date | object | null> = {}) {
  return {
    id: "t1",
    status: "PENDING",
    message: null,
    expiresAt: new Date(Date.now() + 24 * HOUR),
    initiator: { clerkUserId: "clerk_ann", passportHandle: "ann", displayName: "@ann" },
    recipient: { clerkUserId: "clerk_max", passportHandle: "max", displayName: "@max" },
    initiatorFaces: [face("c1", "Caphiria", "o1")],
    recipientFaces: [face("c2", "Urcea", "o2")],
    initiatorCredits: 25,
    recipientCredits: 0,
    initiatorValue: 125,
    recipientValue: 90,
    ...overrides,
  };
}

function show(data: ReturnType<typeof trade>, isRecipient: boolean) {
  jest
    .mocked(api.trading.getTradeById.useQuery)
    .mockReturnValue({ data, isLoading: false } as never);
  const onOpenCard = jest.fn();
  render(<TradeNegotiation tradeId="t1" isRecipient={isRecipient} onOpenCard={onOpenCard} />);
  return onOpenCard;
}

const side = (name: string) => within(screen.getByRole("region", { name }));
const cardButton = (title: string) =>
  screen.getByRole("button", { name: `${title}, Rare, Standard, Ixnay` });

describe("TradeNegotiation", () => {
  it("shows an offer to the player as what they give and what they get, from its sender", () => {
    const onOpenCard = show(trade(), true);
    expect(screen.getByRole("heading", { name: "Trade with @ann" })).toBeInTheDocument();
    expect(side("You give").getByRole("button", { name: /Urcea/ })).toBeInTheDocument();
    expect(side("You give").getByText("90 IxC")).toBeInTheDocument();
    expect(side("You get").getByRole("button", { name: /Caphiria/ })).toBeInTheDocument();
    expect(side("You get").getByText("+25 IxC")).toBeInTheDocument();
    expect(side("You get").getByText("125 IxC")).toBeInTheDocument();
    // A live offer shows its cards to its recipient, so the sheet opens in the offer's context.
    fireEvent.click(cardButton("Caphiria"));
    expect(onOpenCard).toHaveBeenLastCalledWith("c1", { kind: "offer", id: "t1" });
    fireEvent.click(cardButton("Urcea"));
    expect(onOpenCard).toHaveBeenLastCalledWith("c2", { kind: "offer", id: "t1" });
    expect(screen.getByRole("button", { name: "Accept trade" })).toBeInTheDocument();
  });

  it("shows a sent offer from the sender's side, opening the partner's copies as theirs", () => {
    const onOpenCard = show(trade(), false);
    expect(screen.getByRole("heading", { name: "Trade with @max" })).toBeInTheDocument();
    expect(side("You give").getByRole("button", { name: /Caphiria/ })).toBeInTheDocument();
    expect(side("You get").getByRole("button", { name: /Urcea/ })).toBeInTheDocument();
    fireEvent.click(cardButton("Urcea"));
    expect(onOpenCard).toHaveBeenLastCalledWith("c2", { kind: "holder", handle: "max" });
    fireEvent.click(cardButton("Caphiria"));
    expect(onOpenCard).toHaveBeenLastCalledWith("c1", null);
    expect(screen.getByRole("button", { name: "Cancel trade" })).toBeInTheDocument();
  });

  it("names a partner with no handle by their nation, and opens their copies by their passport handle", () => {
    const onOpenCard = show(
      trade({
        status: "ACCEPTED",
        initiator: { clerkUserId: "clerk_ann", passportHandle: "clerk_ann", displayName: "Urcea" },
      }),
      true
    );
    expect(screen.getByRole("heading", { name: "Trade with Urcea" })).toBeInTheDocument();
    // The offer has ended, so its cards open as the partner's (the Clerk id resolves); the player's own need no context.
    fireEvent.click(cardButton("Caphiria"));
    expect(onOpenCard).toHaveBeenLastCalledWith("c1", { kind: "holder", handle: "clerk_ann" });
    fireEvent.click(cardButton("Urcea"));
    expect(onOpenCard).toHaveBeenLastCalledWith("c2", null);
    expect(screen.queryByRole("button", { name: "Accept trade" })).toBeNull();
  });

  it("calls a partner with neither a handle nor a nation a player", () => {
    show(
      trade({
        initiator: { clerkUserId: "clerk_ann", passportHandle: "clerk_ann", displayName: null },
      }),
      true
    );
    expect(screen.getByRole("heading", { name: "Trade with a player" })).toBeInTheDocument();
  });

  it("reads the cards, the trades and the balance again once an answer or a cancel lands", () => {
    const options: Array<{ onSuccess: (data: object, variables: { action?: string }) => void }> =
      [];
    for (const mutation of [api.trading.respondToTrade, api.trading.cancelTrade]) {
      jest.mocked(mutation.useMutation).mockImplementation(((opts: (typeof options)[number]) => {
        options.push(opts);
        return { mutate: jest.fn(), isPending: false };
      }) as never);
    }
    show(trade(), true);
    refreshCards.mockClear();
    const [respond, cancel] = options.slice(-2);
    respond!.onSuccess({}, { action: "ACCEPT" });
    expect(refreshCards).toHaveBeenCalledTimes(1);
    cancel!.onSuccess({}, {});
    expect(refreshCards).toHaveBeenCalledTimes(2);
  });

  it("says when an offer has expired and offers no actions", () => {
    const onOpenCard = show(trade({ expiresAt: new Date(Date.now() - HOUR) }), true);
    expect(screen.getByText("Trade expired")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Accept trade" })).toBeNull();
    // An expired offer no longer shows its cards, so the sender's copy opens as theirs.
    fireEvent.click(cardButton("Caphiria"));
    expect(onOpenCard).toHaveBeenLastCalledWith("c1", { kind: "holder", handle: "ann" });
  });
});
