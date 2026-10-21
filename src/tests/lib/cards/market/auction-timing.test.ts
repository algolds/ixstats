/** @jest-environment node */
import {
  AUCTION_DURATION_MS,
  auctionUrgency,
} from "~/lib/cards/market/auction-timing";

const MIN = 60_000;
const HOUR = 60 * MIN;

describe("auction timing", () => {
  it("lasts 24 hours, 3 days or 7 days", () => {
    expect(AUCTION_DURATION_MS).toEqual({ "24h": 24 * HOUR, "3d": 72 * HOUR, "7d": 168 * HOUR });
  });
  it.each([
    [8 * HOUR, "normal"],
    [6 * HOUR, "normal"],
    [6 * HOUR - 1, "soon"],
    [HOUR, "soon"],
    [HOUR - 1, "final"],
    [0, "final"],
  ] as const)("%d ms left is %s", (ms, urgency) => {
    expect(auctionUrgency(ms)).toBe(urgency);
  });
});
