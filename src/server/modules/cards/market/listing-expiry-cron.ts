import { expireListings } from "./listings";

/** The listing-expiry job (every 10 minutes): due listings end, their copies unlock and a share of the fee comes back. */
export async function processExpiredListings(): Promise<{ expired: number; failed: number }> {
  const { db } = await import("~/server/db");
  return expireListings(db, new Date());
}
