import React from "react";
import { render, screen } from "@testing-library/react";

jest.mock("@clerk/nextjs", () => ({ useAuth: () => ({ userId: "clerk_me" }) }));
jest.mock("~/trpc/react", () => ({
  api: {
    users: { getActiveUsers: { useQuery: jest.fn(() => ({ data: [] })) } },
    trading: {
      searchTradingPartners: { useQuery: jest.fn(() => ({ data: [] })) },
      createtradeOffer: { useMutation: jest.fn() },
    },
    cards: {
      getMyCards: { useQuery: jest.fn() },
      getUserCards: { useQuery: jest.fn(() => ({ data: [] })) },
    },
  },
}));
jest.mock("~/hooks/useCardsRefresh", () => {
  const refreshCards = jest.fn();
  return { useCardsRefresh: () => refreshCards };
});
jest.mock("~/lib/vault/vault-notifications", () => ({
  vaultNotify: { tradeCompleted: jest.fn(), error: jest.fn() },
}));

import { api } from "~/trpc/react";
import { useCardsRefresh } from "~/hooks/useCardsRefresh";
import { TradeOfferModal } from "~/components/cards/trading/TradeOfferModal";
import type { CardInstance } from "~/types/cards-display";

const refreshCards = jest.mocked(useCardsRefresh());
let sent: { onSuccess: () => void } | undefined;

const copy = (id: string, marketValue: number, isRetired: boolean) => ({
  id,
  level: 1,
  isLocked: false,
  cards: {
    id: `c_${id}`,
    title: `Card ${id}`,
    artwork: isRetired ? null : `https://art/${id}.png`,
    marketValue,
    isRetired,
    isBound: false,
  },
});

beforeEach(() => {
  refreshCards.mockClear();
  jest.mocked(api.cards.getMyCards.useQuery).mockReturnValue({
    data: [copy("o1", 40, false), copy("o2", 50, true)],
  } as never);
  jest.mocked(api.trading.createtradeOffer.useMutation).mockImplementation(((
    options: typeof sent
  ) => {
    sent = options;
    return { mutate: jest.fn(), isPending: false };
  }) as never);
});

describe("TradeOfferModal", () => {
  it("values a hidden (retired) copy at 0 in the offer's total", () => {
    const picked = [{ id: "o1" }, { id: "o2" }] as CardInstance[];
    render(
      <TradeOfferModal open onClose={jest.fn()} recipientId="clerk_ann" initialYourCards={picked} />
    );
    expect(screen.getByText("Your cards (2)")).toBeInTheDocument();
    expect(screen.getByText("40 IxC")).toBeInTheDocument();
  });

  it("reads the cards and the trades again once the offer is sent, then closes", () => {
    const onClose = jest.fn();
    render(<TradeOfferModal open={false} onClose={onClose} />);
    sent?.onSuccess();
    expect(refreshCards).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
