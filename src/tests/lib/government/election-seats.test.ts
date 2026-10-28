/**
 * Seat allocation (stress test B-09). First past the post is many single-member districts, not one national
 * winner-take-all district: a 31% plurality no longer takes all 554 seats. Seats are shared by the cube law
 * (seats in proportion to votes cubed), which keeps FPTP's winner's bonus; every seat is handed out.
 */
import { fptpAllocation } from "~/lib/government/election-simulation";

const kiravia = [
  { partyId: "fra", votes: 31190 },
  { partyId: "csu", votes: 26910 },
  { partyId: "cnc", votes: 16510 },
  { partyId: "kfa", votes: 9480 },
  { partyId: "pdf", votes: 7510 },
  { partyId: "ahc", votes: 7360 },
  { partyId: "udi", votes: 1030 },
];

const total = (m: Map<string, number>) => [...m.values()].reduce((a, b) => a + b, 0);

describe("first past the post", () => {
  it("gives a 31% plurality a winner's bonus, not every seat", () => {
    const seats = fptpAllocation(kiravia, 554);
    expect(total(seats)).toBe(554);
    expect(seats.get("fra")!).toBeLessThan(554);
    expect(seats.get("fra")!).toBeGreaterThan(Math.round(0.3119 * 554));
    expect(seats.get("csu")!).toBeGreaterThan(0);
    expect(seats.get("fra")!).toBeGreaterThan(seats.get("csu")!);
  });

  it.each([1, 2, 7, 40, 5000])("hands out exactly %i seats", (n) => {
    expect(total(fptpAllocation(kiravia, n))).toBe(n);
  });

  it("gives a single seat to the plurality", () => {
    expect(fptpAllocation(kiravia, 1).get("fra")).toBe(1);
  });

  it("returns nothing for no parties", () => {
    expect(total(fptpAllocation([], 10))).toBe(0);
  });
});
