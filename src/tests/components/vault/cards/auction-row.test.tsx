/** An auction row colours its time left by how close the end is. */
import React from "react";
import { render, screen } from "@testing-library/react";
import { AuctionRow } from "~/components/vault/cards/market/AuctionRow";

const NOW = new Date("2026-11-02T12:00:00Z").getTime();

beforeEach(() => jest.useFakeTimers({ now: NOW }));
afterEach(() => jest.useRealTimers());

it.each([
  [52 * 3_600_000, "normal", ""],
  [5 * 3_600_000, "soon", "text-warning-ink"],
  [20 * 60_000, "final", "text-destructive-ink"],
  [-60_000, "final", "text-destructive-ink"],
])("an auction ending in %d ms reads as %s", (ms, urgency, tone) => {
  const auction = {
    id: "a1",
    currentBid: 0,
    startingPrice: 50,
    buyoutPrice: null,
    endTime: new Date(NOW + ms),
    bidCount: 0,
    face: null,
    isMine: false,
    isFeatured: false,
  };
  render(
    <ul>
      <AuctionRow
        auction={auction}
        onOpenCard={jest.fn()}
        onShowSelling={jest.fn()}
        onBid={jest.fn()}
        onBuyout={jest.fn()}
        busy={false}
      />
    </ul>
  );
  const left = screen.getByText(/left$|Ended/);
  expect(left.getAttribute("data-urgency")).toBe(urgency);
  expect(left.className).toBe(tone);
});
