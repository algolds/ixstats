/** @jest-environment node */
/** What a failed purchase tells the buyer, and whether the listing has gone from the market. */
import { buyFailureMessage, LISTING_GONE, listingGone } from "~/lib/cards/market/buy-failure";
import { VAULTS_BUSY_MESSAGE } from "~/lib/vault/vault-busy";

const failure = (code: string, message = "Nope.") => ({ message, data: { code } });

describe("buyFailureMessage", () => {
  it("reads a listing someone else bought, withdrew or let lapse as just sold or withdrawn", () => {
    for (const error of [
      failure("CONFLICT", "This listing's card no longer exists."),
      failure("CONFLICT", "This listing was just sold or withdrawn."),
      failure("NOT_FOUND", "This listing is no longer available."),
    ]) {
      expect(listingGone(error)).toBe(true);
      expect(buyFailureMessage(error)).toBe(LISTING_GONE);
    }
    expect(LISTING_GONE).toBe("This listing was just sold or withdrawn.");
  });

  it("keeps a lost race on the vaults, which a second try settles, and any other refusal as the server put it", () => {
    const busy = failure("CONFLICT", VAULTS_BUSY_MESSAGE);
    expect(listingGone(busy)).toBe(false);
    expect(buyFailureMessage(busy)).toBe("Someone else was buying at the same moment. Try again.");
    expect(listingGone(failure("BAD_REQUEST", "Insufficient credits."))).toBe(false);
    expect(buyFailureMessage(failure("BAD_REQUEST", "Insufficient credits."))).toBe(
      "Insufficient credits."
    );
    expect(listingGone({ message: "Network down.", data: null })).toBe(false);
    expect(buyFailureMessage({ message: "Network down." })).toBe("Network down.");
  });
});
