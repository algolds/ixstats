/** @jest-environment node */
import { addressWith } from "~/lib/utils/address";

const HREF =
  "https://ixstates.example/projects/ixstates/vault/cards/market?tab=selling&for=c9#bids";

describe("addressWith", () => {
  it("changes the query, keeping the path, the rest of the query and the hash", () => {
    expect(addressWith(HREF, (query) => query.set("sell", "o7"))).toBe(
      "/projects/ixstates/vault/cards/market?tab=selling&for=c9&sell=o7#bids"
    );
    expect(addressWith(HREF, (query) => query.set("tab", "trades"))).toBe(
      "/projects/ixstates/vault/cards/market?tab=trades&for=c9#bids"
    );
  });

  it("leaves out the question mark once the query is empty, and still keeps the hash", () => {
    expect(
      addressWith(HREF, (query) => {
        query.delete("tab");
        query.delete("for");
      })
    ).toBe("/projects/ixstates/vault/cards/market#bids");
  });

  it("is the address as a path when nothing changes", () => {
    expect(addressWith(HREF, () => undefined)).toBe(
      "/projects/ixstates/vault/cards/market?tab=selling&for=c9#bids"
    );
    expect(addressWith("https://ixstates.example/vault", () => undefined)).toBe("/vault");
  });

  it("encodes the values it sets", () => {
    expect(
      addressWith("https://ixstates.example/vault/cards/explore", (query) =>
        query.set("from", "holder.Ann Lee&co")
      )
    ).toBe("/vault/cards/explore?from=holder.Ann+Lee%26co");
  });
});
