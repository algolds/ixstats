import { STATUS_SQL, nationStatus } from "~/server/modules/realms/realms.map-face";

describe("nationStatus", () => {
  it("is none for a region with no country, whoever owns it", () => {
    expect(nationStatus({ hasCountry: false, ownerUserId: null, claimable: true })).toBe("none");
  });
  it("is npc for an unowned country nobody can claim", () => {
    expect(nationStatus({ hasCountry: true, ownerUserId: null, claimable: false })).toBe("npc");
  });
  it("is open for an unowned claimable country", () => {
    expect(nationStatus({ hasCountry: true, ownerUserId: null, claimable: true })).toBe("open");
  });
  it("is claimed for an owned country, claimable or not", () => {
    expect(nationStatus({ hasCountry: true, ownerUserId: "u1", claimable: false })).toBe("claimed");
    expect(nationStatus({ hasCountry: true, ownerUserId: "u1", claimable: true })).toBe("claimed");
  });
});

it("STATUS_SQL mirrors it: npc and none, and no 'other'", () => {
  expect(STATUS_SQL).toContain("'npc'");
  expect(STATUS_SQL).toContain("'none'");
  expect(STATUS_SQL).not.toContain("'other'");
});
