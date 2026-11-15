/**
 * Unit tests for the wealth-fund insider pairing rule (spec §11a).
 */
import { fundUserIdOf } from "~/lib/exchange/fund-ids";
import { assertNotFundInsiderPair, isFundInsiderPair } from "~/lib/exchange/fund-insiders";
import { createFakeExchangeDb } from "~/tests/helpers/fake-exchange-db";

describe("isFundInsiderPair and assertNotFundInsiderPair", () => {
  function makeDb() {
    return createFakeExchangeDb({
      user: [
        { id: "alice", clerkUserId: "c_alice", countryId: null },
        { id: "carol", clerkUserId: "c_carol", countryId: "na" },
        { id: "bob", clerkUserId: "c_bob", countryId: "nb" },
      ],
      country: [
        { id: "na", name: "Caphiria", realmId: "default", ownerUserId: "alice" },
        { id: "nb", name: "Urcea", realmId: "default", ownerUserId: "bob" },
      ],
    }).client;
  }

  it("returns false when neither side is a fund user or either side is null", async () => {
    const db = makeDb();
    expect(await isFundInsiderPair(db, "alice", "bob")).toBe(false);
    expect(await isFundInsiderPair(db, "alice", "carol")).toBe(false);
    expect(await isFundInsiderPair(db, fundUserIdOf("na"), null)).toBe(false);
    expect(await isFundInsiderPair(db, null, fundUserIdOf("na"))).toBe(false);
  });

  it("matches the nation's ownerUserId and users with countryId equal to the nation in either order", async () => {
    const db = makeDb();
    const fundNa = fundUserIdOf("na");
    expect(await isFundInsiderPair(db, fundNa, "alice")).toBe(true);
    expect(await isFundInsiderPair(db, "alice", fundNa)).toBe(true);
    expect(await isFundInsiderPair(db, fundNa, "carol")).toBe(true);
    expect(await isFundInsiderPair(db, "carol", fundNa)).toBe(true);
  });

  it("returns false for another nation's owner or fund, and true for the same nation's fund twice", async () => {
    const db = makeDb();
    const fundNa = fundUserIdOf("na");
    const fundNb = fundUserIdOf("nb");
    expect(await isFundInsiderPair(db, fundNa, "bob")).toBe(false);
    expect(await isFundInsiderPair(db, "bob", fundNa)).toBe(false);
    expect(await isFundInsiderPair(db, fundNa, fundNb)).toBe(false);
    expect(await isFundInsiderPair(db, fundNa, fundNa)).toBe(true);
  });

  it("assertNotFundInsiderPair throws FORBIDDEN on an insider pair and resolves otherwise", async () => {
    const db = makeDb();
    const fundNa = fundUserIdOf("na");
    await expect(assertNotFundInsiderPair(db, fundNa, "alice")).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "A wealth fund can't trade with its own nation's owner",
    });
    await expect(assertNotFundInsiderPair(db, "carol", fundNa)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(assertNotFundInsiderPair(db, fundNa, "bob")).resolves.toBeUndefined();
  });
});
