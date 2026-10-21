/** @jest-environment node */
import { addressWith } from "~/lib/utils/address";
describe("addressWith", () => {
  it("encodes the values it sets", () => {
    expect(
      addressWith("https://ixstates.example/vault/cards/explore", (query) =>
        query.set("from", "holder.Ann Lee&co")
      )
    ).toBe("/vault/cards/explore?from=holder.Ann+Lee%26co");
  });
});
