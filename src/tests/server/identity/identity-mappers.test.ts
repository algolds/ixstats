/** @jest-environment node */
/**
 * Plan 188: pure mappers behind getRealms / getHistory and the authored-work feed.
 */
import { describe, expect, it } from "@jest/globals";
import {
  primaryNationOf,
  toRealmMemberships,
} from "~/server/modules/identity/identity.mappers";
import type { IdentityCountry } from "~/server/modules/identity/identity.selects";

function country(overrides: Partial<IdentityCountry>): IdentityCountry {
  return {
    id: "c1",
    name: "Caphiria",
    slug: "caphiria",
    flag: null,
    coatOfArms: null,
    continent: "Sarpedon",
    region: null,
    governmentType: null,
    currentPopulation: 1,
    currentTotalGdp: 2,
    currentGdpPerCapita: 3,
    publicApproval: 61,
    realmId: "default",
    realm: { id: "default", name: "Ixnay", slug: "ixnay" },
    ...overrides,
  };
}

describe("toRealmMemberships / filterByRealm", () => {
  it("places default-realm countries in Ixnay, marks the primary nation and the realm role", () => {
    const custom = country({
      id: "c2",
      name: "New Arathia",
      slug: null,
      realmId: "r9",
      realm: { id: "r9", name: "Arathia", slug: "arathia" },
    });
    const roles = new Map([["r9", "founder" as const]]);
    const [earth, arathia] = toRealmMemberships([country({}), custom], "c2", roles);

    expect(earth).toMatchObject({
      id: "default",
      name: "Ixnay",
      slug: "ixnay",
      role: "member",
    });
    expect(earth?.isPrimary).toBe(false);
    expect(earth?.country.currentPublicApproval).toBe(61);
    expect(arathia).toMatchObject({ id: "r9", name: "Arathia", slug: "arathia", role: "founder" });
    expect(arathia?.isPrimary).toBe(true);
    expect(arathia?.country.slug).toBe("new_arathia");
  });
});

describe("primaryNationOf", () => {
  const small = country({ id: "c_small", currentTotalGdp: 10 });
  const big = country({ id: "c_big", currentTotalGdp: 500 });

  it("is the linked User.countryId when the user holds it", () => {
    expect(primaryNationOf([big, small], "c_small")?.id).toBe("c_small");
  });

  it("is the highest-GDP held nation when the linked country is not held", () => {
    expect(primaryNationOf([small, big], "c_elsewhere")?.id).toBe("c_big");
    expect(primaryNationOf([small, big], null)?.id).toBe("c_big");
  });

  it("is null when no nation is held", () => {
    expect(primaryNationOf([], "c_small")).toBeNull();
  });
});
