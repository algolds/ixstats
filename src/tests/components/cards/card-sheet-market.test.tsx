/**
 * The sheet's market section: the value and wanted count, live listings of both kinds (Buy on another player's
 * fixed-price listing, with a confirmation that shows its own failure), reports on others' inscriptions, the craft
 * offer, price history and recent sales. A signed-out visitor sees the market and acts on none of it.
 */
import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

jest.mock("~/hooks/cards/useSheetEconomy", () => ({ useSheetEconomy: jest.fn() }));
jest.mock("~/hooks/cards/useMarketActions", () => ({ useMarketActions: jest.fn() }));
jest.mock("~/components/cards/display/CardPriceHistoryChart", () => ({
  CardPriceHistoryChart: () => <p>Price history</p>,
}));
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

import { useSheetEconomy } from "~/hooks/cards/useSheetEconomy";
import { useMarketActions } from "~/hooks/cards/useMarketActions";
import { CardSheetMarket } from "~/components/cards/sheet/CardSheetMarket";
import type { CardSheetData, SheetListing } from "~/lib/cards/hub/sheet";
import { VAULTS_BUSY_MESSAGE } from "~/lib/vault/vault-busy";

type Done = { onSuccess?: () => void; onError?: (error: object) => void };

// Two days, three and a half hours away: "2d 3h left" however long the test takes.
const AT = new Date(Date.now() + (51 * 60 + 30) * 60_000);
const listing = (over: Partial<SheetListing> = {}): SheetListing => ({
  kind: "listing",
  id: "l1",
  ownershipId: "o1",
  price: 140,
  buyoutPrice: null,
  endsAt: AT,
  bidCount: 0,
  sellerName: "@ixnay",
  isMine: false,
  finish: "FOIL",
  serialNumber: 7,
  inscription: null,
  ...over,
});
const market = (listings: SheetListing[], wantedBy = 12): CardSheetData["market"] => ({
  listings,
  recentSales: [{ price: 130, finish: "STANDARD", at: new Date("2026-10-10T00:00:00Z") }],
  wantedBy,
});
const offer = {
  cardId: "c1",
  realmId: "default",
  verdict: { ok: true },
  quote: { dust: 40, credits: 10 },
  dust: 100,
};

let buy: { mutate: jest.Mock; isPending: boolean };

function show(listings: SheetListing[], { signedIn = true, wantedBy = 12 } = {}) {
  return render(
    <CardSheetMarket
      cardId="c1"
      cardTitle="Aurelia"
      value={120}
      market={market(listings, wantedBy)}
      signedIn={signedIn}
    />
  );
}
const buttons = (name: string) => screen.queryAllByRole("button", { name });

beforeEach(() => {
  jest.clearAllMocks();
  buy = { mutate: jest.fn(), isPending: false };
  const mutation = { mutate: jest.fn(), isPending: false };
  jest
    .mocked(useMarketActions)
    .mockReturnValue({ buy, craft: mutation, report: mutation } as never);
  jest.mocked(useSheetEconomy).mockReturnValue({ data: { craft: null } } as never);
});

describe("CardSheetMarket", () => {
  it("offers Buy on other players' live fixed-price listings only", () => {
    show([
      listing({}),
      listing({ id: "l2", isMine: true }),
      listing({ id: "a1", kind: "auction", bidCount: 2 }),
      listing({ id: "l3", endsAt: new Date(Date.now() - 60_000) }),
    ]);
    expect(buttons("Buy")).toHaveLength(1);
    const rows = within(screen.getByRole("list", { name: "Live listings" })).getAllByRole(
      "listitem"
    );
    // Each Buy is described by its listing's line, so the buttons read apart
    expect(
      within(rows[0]!).getByRole("button", { name: "Buy", description: /^@ixnay · Foil #7 · / })
    ).toBeTruthy();
    expect(rows[1]!.textContent).toMatch(/^Your listing · /);
    expect(rows[3]!.textContent).toContain("Ended");
    // An auction is bid on in the market
    expect(screen.getByRole("link", { name: "Bid in the market" })).toBeTruthy();
  });

  it("confirms a purchase with the price, buys the listing, and moves focus to the market once it has gone", async () => {
    buy.mutate.mockImplementation((_input: object, done?: Done) => done?.onSuccess?.());
    show([listing({})]);
    const opener = screen.getByRole("button", { name: "Buy" });
    opener.focus();
    fireEvent.click(opener);
    const dialog = screen.getByRole("alertdialog");
    expect(within(dialog).getByText("Buy Aurelia for 140 IxC?")).toBeTruthy();
    expect(within(dialog).getByText(/Foil #7 from @ixnay/)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Buy" }));
    expect(buy.mutate).toHaveBeenCalledWith({ listingId: "l1" }, expect.anything());
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Market" }))
    );
  });
  it("keeps the confirmation open with the failure announced: a race to try again, or a listing just gone", () => {
    show([listing({})]);
    fireEvent.click(screen.getByRole("button", { name: "Buy" }));
    const dialog = screen.getByRole("alertdialog");
    const confirm = within(dialog).getByRole("button", { name: "Buy" });

    fireEvent.click(confirm);
    const first = buy.mutate.mock.calls[0]![1] as Done;
    React.act(() => first.onError!({ message: VAULTS_BUSY_MESSAGE, data: { code: "CONFLICT" } }));
    expect(within(dialog).getByRole("alert").textContent).toContain(VAULTS_BUSY_MESSAGE);
    expect(confirm.hasAttribute("disabled")).toBe(false);

    fireEvent.click(confirm);
    // A second try clears the first failure while it runs
    expect(within(dialog).queryByRole("alert")).toBeNull();
    const second = buy.mutate.mock.calls[1]![1] as Done;
    React.act(() => second.onError!({ message: "Nope.", data: { code: "NOT_FOUND" } }));
    expect(within(dialog).getByRole("alert").textContent).toContain(
      "This listing was just sold or withdrawn."
    );
    // Nothing is left to buy
    expect(confirm.hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("alertdialog")).toBeTruthy();
  });

  it("holds Buy while the purchase is under way", () => {
    buy.isPending = true;
    show([listing({})]);
    fireEvent.click(screen.getByRole("button", { name: "Buy" }));
    const dialog = screen.getByRole("alertdialog");
    expect(within(dialog).getByRole("button", { name: "Buy" }).hasAttribute("disabled")).toBe(true);
  });

  it("shows other players' inscriptions with their signer, and lets the viewer report them", () => {
    show([
      listing({ inscription: { text: "gg", signerName: "@sig" } }),
      listing({ id: "l2", isMine: true, inscription: { text: "mine", signerName: "@me" } }),
      listing({ id: "l3", inscription: { text: "anon", signerName: null } }),
    ]);
    expect(screen.getByText("“gg” · @sig")).toBeTruthy();
    expect(screen.getByText("“anon”")).toBeTruthy();
    // The viewer's own listing carries no report
    expect(buttons("Report inscription")).toHaveLength(2);
  });

  it("offers the craft from the server's quote", () => {
    jest.mocked(useSheetEconomy).mockReturnValue({ data: { craft: offer } } as never);
    show([]);
    expect(screen.getByRole("button", { name: "Craft for 40 dust and 10 IxC" })).toBeTruthy();
  });

  it("lets a signed-out visitor see the listings and inscriptions but act on none, and asks for no economy", () => {
    jest.mocked(useSheetEconomy).mockReturnValue({ data: undefined } as never);
    show([listing({ inscription: { text: "gg", signerName: "@sig" } })], { signedIn: false });
    expect(screen.getByRole("list", { name: "Live listings" })).toBeTruthy();
    expect(screen.getByText("“gg” · @sig")).toBeTruthy();
    expect(buttons("Buy")).toHaveLength(0);
    expect(buttons("Report inscription")).toHaveLength(0);
    expect(screen.queryByText("Price history")).toBeNull();
    expect(useSheetEconomy).toHaveBeenCalledWith("c1", false);
  });

  it("offers no craft to a visitor, even from a cached offer", () => {
    jest.mocked(useSheetEconomy).mockReturnValue({ data: { craft: offer } } as never);
    show([], { signedIn: false });
    expect(screen.queryByRole("button", { name: /^Craft/ })).toBeNull();
  });
});
