/**
 * The two-column trade builder: a partner and their trade privacy up front, You give and You get with wishlist marks,
 * the fee and gift notes, and answering, countering or withdrawing an open trade on the same table.
 */
import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";

jest.mock("~/hooks/cards/useTradeBuilder", () => ({
  usePartnerSearch: jest.fn(),
  useFindPartner: jest.fn(),
  useTradeables: jest.fn(),
  usePartnerWishlist: jest.fn(),
  useTradeDetails: jest.fn(),
  useSeedCopy: jest.fn(),
  useTradeMutations: jest.fn(),
}));
jest.mock("~/hooks/cards/useSheetEconomy", () => ({ useEconomyNumbers: jest.fn() }));
jest.mock("~/hooks/useCardSheet", () => {
  const open = jest.fn();
  return { useCardSheet: () => ({ open }) };
});
jest.mock("~/components/providers/FacetMotionConfig", () => ({
  useFacetReducedMotion: () => true,
}));
jest.mock("~/components/cards/face/CardFace", () => ({
  CardFace: ({
    face,
    onOpen,
  }: {
    face: { title: string };
    onOpen?: (face: { title: string }) => void;
  }) =>
    onOpen ? (
      <button onClick={() => onOpen(face)}>Open {face.title}</button>
    ) : (
      <span>{face.title}</span>
    ),
}));
jest.mock("~/components/cards/inscription/ReportInscriptionButton", () => ({
  ReportInscriptionButton: ({ ownershipId }: { ownershipId: string }) => (
    <button>Report inscription on {ownershipId}</button>
  ),
}));

import {
  useFindPartner,
  usePartnerSearch,
  usePartnerWishlist,
  useSeedCopy,
  useTradeables,
  useTradeDetails,
  useTradeMutations,
} from "~/hooks/cards/useTradeBuilder";
import { useEconomyNumbers } from "~/hooks/cards/useSheetEconomy";
import { useCardSheet } from "~/hooks/useCardSheet";
import { CARD_ECONOMY_DEFAULTS } from "~/lib/cards/economy-config";
import { TradeBuilderSheet } from "~/components/cards/trade/TradeBuilderSheet";

interface Failure {
  message: string;
  data?: { code: string } | null;
}
interface CallOptions {
  onSuccess?: () => void;
  onError?: (error: Failure) => void;
}

const face = (id: string) => ({
  cardId: `card_${id}`,
  title: `Card ${id}`,
  copy: { ownershipId: id, finish: "STANDARD", serialNumber: 1, level: 1 },
});
const tradeable = (id: string, over: object = {}) => ({
  ownershipId: id,
  face: face(id),
  inscription: null,
  value: 100,
  highlighted: false,
  ...over,
});
const privacy = (over: object = {}) => ({
  audience: "everyone",
  allowed: true,
  cardsShown: true,
  ...over,
});
const partner = (over: object = {}) => ({
  id: "bob",
  handle: "bob",
  displayName: "@bob",
  countryName: "Aurelia",
  privacy: privacy(),
  ...over,
});

const mutation = () => ({ mutate: jest.fn(), isPending: false });
let mutations: Record<"create" | "counter" | "respond" | "cancel", ReturnType<typeof mutation>>;

const findsPartner = (data: object | null) =>
  jest.mocked(useFindPartner).mockReturnValue({ data, isFetched: true } as never);
const lastOptions = (m: ReturnType<typeof mutation>) =>
  m.mutate.mock.calls.at(-1)?.[1] as CallOptions;
const sheetOpen = () => jest.mocked(useCardSheet().open);

beforeEach(() => {
  jest.clearAllMocks();
  mutations = { create: mutation(), counter: mutation(), respond: mutation(), cancel: mutation() };
  jest.mocked(useTradeMutations).mockReturnValue(mutations as never);
  jest.mocked(useEconomyNumbers).mockReturnValue({
    data: { economy: CARD_ECONOMY_DEFAULTS, feeRatePct: 10 },
  } as never);
  jest.mocked(usePartnerSearch).mockReturnValue({ data: [] } as never);
  findsPartner(partner());
  jest
    .mocked(useTradeables)
    .mockImplementation(
      (_partner, side) =>
        ({
          data: {
            items:
              side === "mine"
                ? [tradeable("m1", { highlighted: true }), tradeable("m2")]
                : [tradeable("t1", { highlighted: true }), tradeable("t2", { value: 0 })],
            nextCursor: null,
          },
        }) as never
    );
  jest.mocked(usePartnerWishlist).mockReturnValue({
    data: [
      { cardId: "card_m1", title: "Card m1", rarity: "RARE", realmId: "default", youOwn: 1 },
      { cardId: "card_z", title: "Card z", rarity: "EPIC", realmId: "default", youOwn: 0 },
    ],
  } as never);
  jest.mocked(useTradeDetails).mockReturnValue({ data: undefined } as never);
  jest.mocked(useSeedCopy).mockReturnValue(undefined);
});

const renderNew = (seed: object = { partnerHandle: "bob" }) =>
  render(<TradeBuilderSheet open onOpenChange={jest.fn()} seed={seed} />);
const column = (name: "You give" | "You get") => within(screen.getByRole("region", { name }));
const sendButton = () => screen.queryByRole("button", { name: "Send offer" });

describe("TradeBuilderSheet: a new trade", () => {
  it("builds You give / You get with wishlist marks and sends the table", () => {
    renderNew();
    expect(screen.getByRole("dialog", { name: "New trade" })).toBeTruthy();
    expect(useFindPartner).toHaveBeenCalledWith("bob");
    expect(screen.getByText("@bob takes offers from everyone.")).toBeTruthy();
    expect(column("You give").getByText("No cards yet")).toBeTruthy();
    expect(column("You get").getByText("No cards yet")).toBeTruthy();
    expect(screen.getByText("They want this")).toBeTruthy();
    expect(screen.getByText("On your wishlist")).toBeTruthy();
    const wants = within(screen.getByRole("region", { name: "@bob wants" }));
    expect(wants.getByText("Card m1 · you have 1")).toBeTruthy();
    expect(wants.getByText("Card z")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Add Card t1 to You get" }));
    expect(column("You get").getByText("Card t1")).toBeTruthy();
    expect(column("You get").getByText("Standard #1 · 100 IxC")).toBeTruthy();
    expect(screen.getByText("Added Card t1 to You get.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Remove Card t1 from You get" })).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Credits you give"), { target: { value: "500" } });
    expect(
      screen.getByText("The market fee on your 500 IxC is 50 IxC, so they receive 450 IxC.")
    ).toBeTruthy();
    fireEvent.change(screen.getByLabelText("A note for @bob"), { target: { value: "  hi  " } });
    fireEvent.click(sendButton()!);
    expect(mutations.create.mutate).toHaveBeenCalledWith(
      {
        partnerId: "bob",
        initiatorCardIds: [],
        recipientCardIds: ["t1"],
        initiatorCredits: 500,
        recipientCredits: 0,
        message: "hi",
      },
      expect.anything()
    );
  });

  it("says what the credits you get cost in fees, and when the table is a gift", () => {
    renderNew();
    fireEvent.click(screen.getByRole("button", { name: "Add Card m2 to You give" }));
    expect(screen.getByText("This is a gift: one side gives nothing back.")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Credits you get"), { target: { value: "300" } });
    expect(screen.queryByText(/gift/)).toBeNull();
    expect(
      screen.getByText("The market fee on the 300 IxC you get is 30 IxC, so you receive 270 IxC.")
    ).toBeTruthy();
  });

  it("will not send credits alone", () => {
    renderNew();
    // An empty table has nothing to explain yet; Send waits for a card.
    expect(screen.queryByText(/Add at least one card/)).toBeNull();
    expect(sendButton()!.hasAttribute("disabled")).toBe(true);
    fireEvent.change(screen.getByLabelText("Credits you give"), { target: { value: "500" } });
    expect(screen.getByText("Add at least one card. Credits alone can't be traded.")).toBeTruthy();
    expect(sendButton()!.hasAttribute("disabled")).toBe(true);
    fireEvent.click(sendButton()!);
    expect(mutations.create.mutate).not.toHaveBeenCalled();
  });

  it("shows the partner's trade privacy and blocks sending when they don't take your offers", () => {
    findsPartner(partner({ privacy: privacy({ audience: "followers", allowed: false }) }));
    renderNew();
    expect(screen.getByRole("status")).toHaveTextContent(
      "@bob only takes offers from players who follow them"
    );
    expect(sendButton()).toBeNull();
    expect(screen.queryByRole("region", { name: "You give" })).toBeNull();
    expect(useTradeables).not.toHaveBeenCalled();
    expect(usePartnerWishlist).not.toHaveBeenCalled();
  });

  it("reads a block as a player not taking offers, as the server reports it", () => {
    findsPartner(partner({ privacy: privacy({ audience: "nobody", allowed: false }) }));
    renderNew();
    expect(screen.getByRole("status")).toHaveTextContent("@bob isn't taking trade offers");
    expect(sendButton()).toBeNull();
  });

  it("lets you give to a player who hides their cards, without reading their cards or wishlist", () => {
    findsPartner(partner({ privacy: privacy({ cardsShown: false }) }));
    renderNew();
    expect(
      screen.getByText("@bob keeps their cards private, so you can only ask for credits.")
    ).toBeTruthy();
    expect(useTradeables).toHaveBeenCalled();
    expect(jest.mocked(useTradeables).mock.calls.every(([, side]) => side === "mine")).toBe(true);
    expect(usePartnerWishlist).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Add Card m1 to You give" }));
    fireEvent.click(sendButton()!);
    expect(mutations.create.mutate).toHaveBeenCalledWith(
      expect.objectContaining({ initiatorCardIds: ["m1"], recipientCardIds: [] }),
      expect.anything()
    );
  });

  it("starts from your copy in the card sheet, and drops one that can't be traded", () => {
    jest.mocked(useSeedCopy).mockReturnValue({
      ownershipId: "m9",
      face: face("m9"),
      inscription: null,
      value: 75,
    } as never);
    const { unmount } = renderNew({ partnerHandle: "bob", give: "m9" });
    expect(useSeedCopy).toHaveBeenCalledWith("m9");
    expect(column("You give").getByText("Card m9")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Add Card t1 to You get" }));
    fireEvent.click(sendButton()!);
    expect(mutations.create.mutate).toHaveBeenCalledWith(
      expect.objectContaining({ initiatorCardIds: ["m9"], recipientCardIds: ["t1"] }),
      expect.anything()
    );
    unmount();

    // Locked, bound or not yours: the seed leaves the table rather than travelling unseen.
    jest.mocked(useSeedCopy).mockReturnValue(null);
    renderNew({ partnerHandle: "bob", give: "m9" });
    fireEvent.change(screen.getByLabelText("Credits you get"), { target: { value: "5" } });
    expect(screen.getByText("Add at least one card. Credits alone can't be traded.")).toBeTruthy();
  });

  it("finds a partner by handle when none was named, and lets you change partner", () => {
    jest.mocked(usePartnerSearch).mockReturnValue({
      data: [
        partner({ id: "kir", handle: "kir", displayName: null, countryName: null }),
        partner({ id: "zed", handle: "zed", displayName: "@zed", privacy: privacy({ allowed: false }) }),
        partner(),
      ],
    } as never);
    renderNew({});
    expect(useFindPartner).toHaveBeenCalledWith(null);
    fireEvent.change(screen.getByRole("searchbox", { name: "Find a player by handle" }), {
      target: { value: "@b" },
    });
    expect(usePartnerSearch).toHaveBeenLastCalledWith("@b");
    const players = within(screen.getByRole("list", { name: "Players" }));
    expect(players.getByRole("button", { name: /a player/ })).toBeTruthy();
    const refusing = players.getByRole("button", { name: /@zed/ });
    expect(refusing).toHaveTextContent("Not taking offers from you");
    expect(refusing.hasAttribute("disabled")).toBe(true);
    fireEvent.click(players.getByRole("button", { name: /@bob/ }));
    expect(screen.getByText("@bob takes offers from everyone.")).toBeTruthy();
    expect(screen.getByRole("region", { name: "You get" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Add Card t1 to You get" }));
    fireEvent.click(screen.getByRole("button", { name: "Change partner" }));
    expect(screen.getByRole("searchbox", { name: "Find a player by handle" })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "You get" })).toBeNull();
  });

  it("says when the handle in the link names nobody, and offers the search", () => {
    findsPartner(null);
    renderNew({ partnerHandle: "ghost" });
    expect(screen.getByText("No player goes by @ghost.")).toBeTruthy();
    expect(screen.getByRole("searchbox", { name: "Find a player by handle" })).toBeTruthy();
  });

  it("moves focus to the next card when one is removed, and to the column when it was the last", () => {
    renderNew();
    fireEvent.click(screen.getByRole("button", { name: "Add Card t1 to You get" }));
    fireEvent.click(screen.getByRole("button", { name: "Add Card t2 to You get" }));
    fireEvent.click(column("You get").getByRole("button", { name: "Remove Card t1" }));
    expect(column("You get").getByRole("button", { name: "Remove Card t2" })).toHaveFocus();
    expect(screen.getByText("Removed Card t1 from You get.")).toBeTruthy();
    fireEvent.click(column("You get").getByRole("button", { name: "Remove Card t2" }));
    expect(column("You get").getByRole("heading", { name: "You get" })).toHaveFocus();
  });

  it("opens a card of a new trade in the sheet without an offer to show it", () => {
    renderNew();
    fireEvent.click(screen.getByRole("button", { name: "Add Card t1 to You get" }));
    fireEvent.click(column("You get").getByRole("button", { name: "Open Card t1" }));
    expect(sheetOpen()).toHaveBeenCalledWith("card_t1", null);
  });
});

const openTrade = (over: object = {}) => ({
  id: "t9",
  status: "PENDING",
  revision: 2,
  proposerId: "bob",
  viewerRole: "recipient",
  myTurn: true,
  expiresAt: new Date(Date.now() + 3_600_000),
  initiatorId: "bob",
  recipientId: "me",
  initiatorCardIdList: ["t1"],
  recipientCardIdList: ["m1"],
  initiatorCredits: 0,
  recipientCredits: 0,
  message: "Fair swap?",
  initiator: { id: "bob", clerkUserId: "clerk_bob", passportHandle: "bob", displayName: "@bob" },
  recipient: { id: "me", clerkUserId: "clerk_me", passportHandle: "me", displayName: "@me" },
  initiatorCopies: [tradeable("t1", { inscription: "gg" })],
  recipientCopies: [tradeable("m1")],
  initiatorValue: 100,
  recipientValue: 100,
  feePreview: { initiator: 0, recipient: 0 },
  ...over,
});
const showsTrade = (over: object = {}) =>
  jest.mocked(useTradeDetails).mockReturnValue({ data: openTrade(over) } as never);
const renderTrade = () =>
  render(<TradeBuilderSheet open onOpenChange={jest.fn()} tradeId="t9" />);

describe("TradeBuilderSheet: an open trade", () => {
  it("on your turn offers accept, decline and counter, and counters the same table", () => {
    showsTrade();
    renderTrade();
    expect(useTradeDetails).toHaveBeenCalledWith("t9");
    expect(useFindPartner).toHaveBeenCalledWith("bob");
    expect(screen.getByRole("dialog", { name: "Trade with @bob" })).toBeTruthy();
    expect(screen.getByText("“Fair swap?”")).toBeTruthy();
    // Their signed copy: the text travels with it, the signer is never named here, and it can be reported.
    expect(column("You get").getByText("“gg”")).toBeTruthy();
    expect(column("You get").getByRole("button", { name: "Report inscription on t1" })).toBeTruthy();
    expect(column("You give").queryByRole("button", { name: /Report/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Remove/ })).toBeNull();
    expect(screen.getByLabelText("Credits you get")).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Accept" }));
    expect(mutations.respond.mutate).toHaveBeenCalledWith(
      { tradeId: "t9", action: "ACCEPT", revision: 2 },
      expect.anything()
    );
    fireEvent.click(screen.getByRole("button", { name: "Decline" }));
    expect(mutations.respond.mutate).toHaveBeenLastCalledWith(
      { tradeId: "t9", action: "REJECT", revision: 2 },
      expect.anything()
    );

    fireEvent.click(screen.getByRole("button", { name: "Counter" }));
    expect(screen.queryByRole("button", { name: "Accept" })).toBeNull();
    fireEvent.change(screen.getByLabelText("Credits you get"), { target: { value: "50" } });
    fireEvent.click(screen.getByRole("button", { name: "Send counter-offer" }));
    expect(mutations.counter.mutate).toHaveBeenCalledWith(
      {
        tradeId: "t9",
        revision: 2,
        initiatorCardIds: ["t1"],
        recipientCardIds: ["m1"],
        initiatorCredits: 50,
        recipientCredits: 0,
        message: undefined,
      },
      expect.anything()
    );
  });

  it("puts the table back when you step out of a counter-offer", () => {
    showsTrade();
    renderTrade();
    fireEvent.click(screen.getByRole("button", { name: "Counter" }));
    fireEvent.click(column("You give").getByRole("button", { name: "Remove Card m1" }));
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(column("You give").getByText("Card m1")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Accept" })).toBeTruthy();
  });

  it("shows the server's message when an accept conflicts, and keeps the trade open", () => {
    showsTrade();
    const onOpenChange = jest.fn();
    render(<TradeBuilderSheet open onOpenChange={onOpenChange} tradeId="t9" />);
    fireEvent.click(screen.getByRole("button", { name: "Accept" }));
    const message =
      "A card you would give was signed after this offer was made. Send a counter-offer so the other player sees it.";
    React.act(() => lastOptions(mutations.respond).onError?.({ message, data: { code: "CONFLICT" } }));
    expect(screen.getByRole("alert")).toHaveTextContent(message);
    expect(onOpenChange).not.toHaveBeenCalled();
    // The next answer starts clean.
    fireEvent.click(screen.getByRole("button", { name: "Decline" }));
    expect(screen.queryByRole("alert")).toBeNull();
    React.act(() => lastOptions(mutations.respond).onSuccess?.());
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("opens a card of an offer waiting on you with the offer, so the sheet shows its art", () => {
    showsTrade();
    renderTrade();
    fireEvent.click(column("You get").getByRole("button", { name: "Open Card t1" }));
    expect(sheetOpen()).toHaveBeenCalledWith("card_t1", { kind: "offer", id: "t9" });
  });

  it("offers your own pending offer only a withdraw", () => {
    showsTrade({ proposerId: "me", myTurn: false });
    renderTrade();
    expect(screen.queryByRole("button", { name: "Accept" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Counter" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Withdraw offer" }));
    expect(mutations.cancel.mutate).toHaveBeenCalledWith({ tradeId: "t9" }, expect.anything());
    fireEvent.click(column("You get").getByRole("button", { name: "Open Card t1" }));
    expect(sheetOpen()).toHaveBeenCalledWith("card_t1", null);
  });

  it("still lets you answer a partner who no longer takes your offers, but not counter", () => {
    showsTrade();
    findsPartner(partner({ privacy: privacy({ audience: "nobody", allowed: false }) }));
    renderTrade();
    expect(screen.getByRole("status")).toHaveTextContent("@bob isn't taking trade offers");
    expect(screen.getByRole("button", { name: "Accept" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Decline" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Counter" })).toBeNull();
  });

  it("says how a finished or expired trade ended, with nothing to answer", () => {
    showsTrade({ status: "ACCEPTED", myTurn: false });
    const { unmount } = renderTrade();
    expect(screen.getByText("This trade went through.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Accept|Withdraw|Counter/ })).toBeNull();
    unmount();
    showsTrade({ myTurn: false, expiresAt: new Date(Date.now() - 1000) });
    renderTrade();
    expect(screen.getByText("This offer expired.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Accept|Withdraw|Counter/ })).toBeNull();
  });
});
