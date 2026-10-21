/** @jest-environment node */
/** Cards refresh §2.1: NS cards keep only facts, in metadata.nsData. */
import { nsNationKey } from "~/lib/cards/ns-facts";

describe("NS facts", () => {
  it("keys a nation as the once-per-nation bonus does", () => {
    expect(nsNationKey("  New   Heku ")).toBe("new_heku");
  });
});
