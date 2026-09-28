import { planOwnerBackfill } from "../../../scripts/realms/backfill-plan";

const sys = (id: string) => id === "sys";

describe("planOwnerBackfill", () => {
  it("assigns the single user, prefers the single non-system-owner, reports the rest", () => {
    const plan = planOwnerBackfill(
      [
        { countryId: "c1", ownerUserId: null, users: [{ id: "u1", clerkUserId: "a" }] },
        { countryId: "c2", ownerUserId: null, users: [{ id: "u9", clerkUserId: "sys" }, { id: "u2", clerkUserId: "b" }] },
        { countryId: "c3", ownerUserId: null, users: [{ id: "u3", clerkUserId: "c" }, { id: "u4", clerkUserId: "d" }] },
        { countryId: "c4", ownerUserId: "u5", users: [{ id: "u5", clerkUserId: "e" }] },
      ],
      sys
    );
    expect(plan.assign).toEqual([
      { countryId: "c1", userId: "u1" },
      { countryId: "c2", userId: "u2" },
    ]);
    expect(plan.collisions).toEqual([{ countryId: "c3", userIds: ["u3", "u4"] }]);
  });

  it("never makes a system owner the owner, even when they are the only user", () => {
    const plan = planOwnerBackfill([{ countryId: "c9", ownerUserId: null, users: [{ id: "u9", clerkUserId: "sys" }] }], sys);
    expect(plan).toEqual({ assign: [], collisions: [] });
  });
});
