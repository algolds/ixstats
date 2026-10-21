/** Auction durations and how urgent the time left is (client-safe). Auctions run in real time. */

export const AUCTION_DURATIONS = ["24h", "3d", "7d"] as const;
export type AuctionDuration = (typeof AUCTION_DURATIONS)[number];

const HOUR_MS = 60 * 60 * 1000;

export const AUCTION_DURATION_MS: Record<AuctionDuration, number> = {
  "24h": 24 * HOUR_MS,
  "3d": 72 * HOUR_MS,
  "7d": 168 * HOUR_MS,
};

export const AUCTION_DURATION_LABEL: Record<AuctionDuration, string> = {
  "24h": "24 hours",
  "3d": "3 days",
  "7d": "7 days",
};

/** Tuned for auctions of 24 hours to 7 days (the old thresholds were for 30 and 60 minutes). */
const SOON_MS = 6 * HOUR_MS;
const FINAL_MS = HOUR_MS;

export type AuctionUrgency = "normal" | "soon" | "final";

export function auctionUrgency(msLeft: number): AuctionUrgency {
  if (msLeft < FINAL_MS) return "final";
  if (msLeft < SOON_MS) return "soon";
  return "normal";
}
