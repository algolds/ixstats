import {
  countMoves,
  planTransportRealmBackfill,
} from "../../../scripts/realms/transport-realm-plan";

const countryRealm = new Map([
  ["c_ix", "default"],
  ["c_eurth", "realm_eurth"],
]);

describe("planTransportRealmBackfill (AT-1)", () => {
  it("moves rows to their owning country's realm and reports rows with no country", () => {
    const plan = planTransportRealmBackfill(
      [
        { id: "r1", countryId: "c_eurth", realmId: "default" },
        { id: "r2", countryId: "c_eurth", realmId: "default" },
        { id: "r3", countryId: "c_ix", realmId: "default" },
        { id: "r4", countryId: null, realmId: "default" },
        { id: "r5", countryId: "c_gone", realmId: "default" },
      ],
      countryRealm
    );
    expect([...plan.moves]).toEqual([["realm_eurth", ["r1", "r2"]]]);
    expect(plan.orphans).toEqual(["r4", "r5"]);
    expect(countMoves(plan)).toBe(2);
  });

  it("is idempotent: rows already in their country's realm yield no moves", () => {
    const plan = planTransportRealmBackfill(
      [
        { id: "r1", countryId: "c_eurth", realmId: "realm_eurth" },
        { id: "r3", countryId: "c_ix", realmId: "default" },
      ],
      countryRealm
    );
    expect(countMoves(plan)).toBe(0);
    expect(plan.orphans).toEqual([]);
  });
});
