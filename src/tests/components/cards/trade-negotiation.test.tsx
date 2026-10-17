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

import { api } from "~/trpc/react";
import { TradeNegotiation } from "~/components/cards/trading/TradeNegotiation";

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
    initiator: { clerkUserId: "clerk_ann", handle: "ann" },
    recipient: { clerkUserId: "clerk_max", handle: "max" },
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

  it("opens a partner's copies by their Clerk id, their passport handle, when they have no stored handle", () => {
    const onOpenCard = show(
      trade({ status: "ACCEPTED", initiator: { clerkUserId: "clerk_ann", handle: null } }),
      true
    );
    expect(screen.getByRole("heading", { name: "Trade with a player" })).toBeInTheDocument();
    // The offer has ended, so its cards open as the partner's; the player's own need no context.
    fireEvent.click(cardButton("Caphiria"));
    expect(onOpenCard).toHaveBeenLastCalledWith("c1", { kind: "holder", handle: "clerk_ann" });
    fireEvent.click(cardButton("Urcea"));
    expect(onOpenCard).toHaveBeenLastCalledWith("c2", null);
    expect(screen.queryByRole("button", { name: "Accept trade" })).toBeNull();
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
