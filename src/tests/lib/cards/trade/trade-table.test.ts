/** @jest-environment node */
import {
  isCrossRealmTrade,
  isGift,
  sidesFor,
  tableFrom,
  validateTradeTable,
  type TradeTable,
} from "~/lib/cards/trade/trade-table";

const table = (over: Partial<TradeTable> = {}): TradeTable => ({
  initiatorCardIds: ["a"],
  recipientCardIds: ["b"],
  initiatorCredits: 0,
  recipientCredits: 0,
  ...over,
});
const cards = (n: number, prefix: string) => Array.from({ length: n }, (_, i) => `${prefix}${i}`);

const TOO_FEW = "Add at least one card. Credits alone can't be traded.";
const TWICE = "A card can only be in the trade once.";
const TOO_MANY = "Each side holds at most 20 cards.";
const BAD_CREDITS = "Credits must be a whole number from 0 to 1,000,000.";

describe("the trade table", () => {
  it("needs at least one card in total, on either side", () => {
    expect(validateTradeTable(table())).toBeNull();
    expect(validateTradeTable(table({ initiatorCardIds: [], initiatorCredits: 500 }))).toBeNull();
    expect(validateTradeTable(table({ recipientCardIds: [] }))).toBeNull();
    expect(
      validateTradeTable(
        table({ initiatorCardIds: [], recipientCardIds: [], initiatorCredits: 500 })
      )
    ).toBe(TOO_FEW);
  });

  it("refuses a card on both sides or twice on one", () => {
    expect(validateTradeTable(table({ recipientCardIds: ["a"] }))).toBe(TWICE);
    expect(validateTradeTable(table({ initiatorCardIds: ["a", "a"] }))).toBe(TWICE);
  });

  it("holds 20 cards a side and refuses a 21st on either side", () => {
    expect(validateTradeTable(table({ initiatorCardIds: cards(20, "i") }))).toBeNull();
    expect(validateTradeTable(table({ recipientCardIds: cards(20, "r") }))).toBeNull();
    expect(validateTradeTable(table({ initiatorCardIds: cards(21, "i") }))).toBe(TOO_MANY);
    expect(validateTradeTable(table({ recipientCardIds: cards(21, "r") }))).toBe(TOO_MANY);
  });

  it("takes whole credits from 0 to 1,000,000 on each side", () => {
    expect(validateTradeTable(table({ initiatorCredits: 1_000_000 }))).toBeNull();
    expect(validateTradeTable(table({ recipientCredits: 1_000_000 }))).toBeNull();
    for (const bad of [2.5, -1, 1_000_001, Number.NaN]) {
      expect(validateTradeTable(table({ initiatorCredits: bad }))).toBe(BAD_CREDITS);
      expect(validateTradeTable(table({ recipientCredits: bad }))).toBe(BAD_CREDITS);
    }
  });

  it("calls a table a gift when one side gives nothing at all", () => {
    expect(isGift(table({ recipientCardIds: [] }))).toBe(true);
    expect(isGift(table({ initiatorCardIds: [] }))).toBe(true);
    expect(isGift(table({ recipientCardIds: [], recipientCredits: 10 }))).toBe(false);
    expect(isGift(table({ initiatorCardIds: [], initiatorCredits: 10 }))).toBe(false);
    expect(isGift(table())).toBe(false);
  });

  it("maps the table to the viewer's You give / You get and back", () => {
    const t = table({ initiatorCredits: 50, recipientCredits: 7 });
    expect(sidesFor(t, "recipient")).toEqual({
      give: { cardIds: ["b"], credits: 7 },
      get: { cardIds: ["a"], credits: 50 },
    });
    expect(sidesFor(t, "initiator")).toEqual({
      give: { cardIds: ["a"], credits: 50 },
      get: { cardIds: ["b"], credits: 7 },
    });
    expect(
      tableFrom("recipient", { cardIds: ["b"], credits: 7 }, { cardIds: ["a"], credits: 50 })
    ).toEqual(t);
    expect(
      tableFrom("initiator", { cardIds: ["a"], credits: 50 }, { cardIds: ["b"], credits: 7 })
    ).toEqual(t);
  });

  it("is cross-realm when each side gives a card and a realm on one side is missing from the other", () => {
    expect(isCrossRealmTrade(["default"], ["iiwiki"])).toBe(true);
    expect(isCrossRealmTrade(["default", "iiwiki"], ["iiwiki"])).toBe(true);
    expect(isCrossRealmTrade(["iiwiki"], ["default", "iiwiki"])).toBe(true);
    expect(isCrossRealmTrade(["default"], ["default", "default"])).toBe(false);
    expect(isCrossRealmTrade(["default"], [])).toBe(false);
    expect(isCrossRealmTrade([], ["default"])).toBe(false);
  });
});
