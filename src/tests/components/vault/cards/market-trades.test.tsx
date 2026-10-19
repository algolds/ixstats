/** The Market's Trades tab: open offers split by whose turn it is, each opening the trade builder, and New trade. */
import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";

jest.mock("@clerk/nextjs", () => ({ useAuth: jest.fn(() => ({ userId: "user_me" })) }));
jest.mock("~/trpc/react", () => ({
  api: { trading: { getActiveTrades: { useQuery: jest.fn() } } },
}));
jest.mock("~/components/cards/trade/TradeBuilderHost", () => ({
  TradeBuilderHost: jest.fn(() => null),
}));
jest.mock("~/components/vault/cards/market/MarketHistory", () => ({
  MarketHistory: () => <p>Past trades</p>,
}));
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

import { api } from "~/trpc/react";
import { TradeBuilderHost } from "~/components/cards/trade/TradeBuilderHost";
import { MarketTrades } from "~/components/vault/cards/market/MarketTrades";

const me = { clerkUserId: "user_me", displayName: "@me" };
const bob = { clerkUserId: "user_bob", displayName: "@bob" };
const kir = { clerkUserId: "user_kir", displayName: null };
const trade = (over: object) => ({
  id: "t1",
  myTurn: true,
  initiator: bob,
  recipient: me,
  ...over,
});
const showsTrades = (data: object[]) =>
  jest.mocked(api.trading.getActiveTrades.useQuery).mockReturnValue({ data } as never);
const renderTrades = (props: Partial<React.ComponentProps<typeof MarketTrades>> = {}) =>
  render(<MarketTrades onOpenCard={jest.fn()} trade={null} onCloseTrade={jest.fn()} {...props} />);

beforeEach(() => jest.clearAllMocks());

describe("MarketTrades", () => {
  it("lists the offers waiting on you by whose turn it is, each opening the builder", () => {
    // t2 is the viewer's own offer; t3 was countered back to them, so it waits on them though they started it.
    showsTrades([
      trade({}),
      trade({ id: "t2", myTurn: false, initiator: me, recipient: kir }),
      trade({ id: "t3", myTurn: true, initiator: me, recipient: kir }),
    ]);
    renderTrades();
    expect(screen.getByRole("link", { name: "New trade" }).getAttribute("href")).toBe(
      "/vault/cards/market?tab=trades&trade=new"
    );
    const incoming = within(screen.getByRole("tabpanel", { name: "Incoming" }));
    const rows = incoming.getAllByRole("listitem");
    expect(rows.map((row) => row.textContent)).toEqual([
      "Trade with @bobYour turnOpen",
      "Trade with a playerYour turnOpen",
    ]);
    expect(within(rows[0]!).getByRole("link", { name: "Open" }).getAttribute("href")).toBe(
      "/vault/cards/market?tab=trades&trade=t1"
    );
    expect(screen.getByRole("tab", { name: /^Incoming\s*, 2 offers$/ })).toBeTruthy();

    fireEvent.mouseDown(screen.getByRole("tab", { name: /^Sent\s*, 1 offer$/ }));
    const sent = within(screen.getByRole("tabpanel", { name: "Sent" }));
    expect(sent.getByText("Trade with a player")).toBeTruthy();
    expect(sent.getByText("Waiting on them")).toBeTruthy();
    expect(sent.getByRole("link", { name: "Open" }).getAttribute("href")).toBe(
      "/vault/cards/market?tab=trades&trade=t2"
    );

    fireEvent.mouseDown(screen.getByRole("tab", { name: "History" }));
    expect(screen.getByText("Past trades")).toBeTruthy();
  });

  it("says when nothing waits, and how to start", () => {
    showsTrades([]);
    renderTrades();
    expect(screen.getByText("No offers waiting for you")).toBeTruthy();
    expect(screen.getByText("Start one with New trade.")).toBeTruthy();
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Sent" }));
    expect(screen.getByText("You have no offers out")).toBeTruthy();
  });

  it("opens the builder the hub's address names, and closes it through the hub", () => {
    showsTrades([]);
    const onCloseTrade = jest.fn();
    const address = { trade: "new", partner: "bob", give: "o1", get: null };
    renderTrades({ trade: address, onCloseTrade });
    expect(jest.mocked(TradeBuilderHost).mock.calls.at(-1)?.[0]).toEqual({
      address,
      onClose: onCloseTrade,
    });
  });
});
