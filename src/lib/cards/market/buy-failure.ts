import { VAULTS_BUSY_MESSAGE } from "~/lib/vault/vault-busy";

/** A purchase another buyer, a cancel or the expiry got to first. */
export const LISTING_GONE = "This listing was just sold or withdrawn.";

/** A failed `cardMarket.buyListing`, as the client receives it. */
export interface BuyFailure {
  message: string;
  data?: { code: string } | null;
}

/** The listing is no longer there to buy: not found, or claimed first (a lost race on the vaults is not that). */
export function listingGone(error: BuyFailure): boolean {
  const code = error.data?.code;
  return code === "NOT_FOUND" || (code === "CONFLICT" && error.message !== VAULTS_BUSY_MESSAGE);
}

/**
 * What a failed purchase tells the buyer: a listing that has gone reads one clear way, while a lost race on the vaults
 * (try again) and any other refusal, such as too few credits, read as the server put them.
 */
export function buyFailureMessage(error: BuyFailure): string {
  return listingGone(error) ? LISTING_GONE : error.message;
}
