/** @jest-environment node */
// MC-5: policies.repealPolicy — owner-guarded, only enacted policies, releases CivCap (the
// policy leaves the `active` set the CivCap sum reads) and clears its growth effect.
import { describe, it, expect } from "@jest/globals";
import { policiesRouter } from "~/server/api/routers/policies";
import {
  CALLER_COUNTRY,
  FOREIGN_COUNTRY,
  createIdorContext,
} from "~/tests/helpers/country-idor-context";

function policiesDb(policy: Record<string, unknown> | null) {
  const state = { policy: policy ? { ...policy } : null };
  return {
    state,
    policy: {
      findUnique: jest.fn(async () => (state.policy ? { ...state.policy } : null)),
      updateMany: jest.fn(
        async ({
          where,
          data,
        }: {
          where: { status: { in: string[] } };
          data: { status: string };
        }) => {
          if (!state.policy || !where.status.in.includes(state.policy.status as string)) {
            return { count: 0 };
          }
          state.policy = { ...state.policy, ...data };
          return { count: 1 };
        }
      ),
    },
    storytellerEffect: { updateMany: jest.fn(async () => ({ count: 1 })) },
    policyEffectLog: { create: jest.fn(async () => ({})) },
  };
}

const activePolicy = (countryId: string, status = "active") => ({
  id: "pol_1",
  countryId,
  name: "Universal Stipend",
  status,
  civCapCost: 15,
});

describe("policies.repealPolicy", () => {
  it("repeals an active policy, releasing its CivCap and growth effect", async () => {
    const db = policiesDb(activePolicy(CALLER_COUNTRY));
    const caller = policiesRouter.createCaller(createIdorContext(db));

    const result = await caller.repealPolicy({ policyId: "pol_1", reason: "Too costly" });

    expect(result).toEqual({ id: "pol_1", status: "repealed", civCapReleased: 15 });
    expect(db.state.policy?.status).toBe("repealed");
    expect(db.storytellerEffect.updateMany).toHaveBeenCalledWith({
      where: { createdBy: "POLICY:pol_1", isActive: true },
      data: { isActive: false },
    });
    expect(db.policyEffectLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ policyId: "pol_1", notes: "repealed: Too costly" }),
    });
  });

  it("rejects repealing another country's policy", async () => {
    const db = policiesDb(activePolicy(FOREIGN_COUNTRY));
    const caller = policiesRouter.createCaller(createIdorContext(db));

    await expect(caller.repealPolicy({ policyId: "pol_1" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(db.policy.updateMany).not.toHaveBeenCalled();
  });

  it("rejects a policy that is not enacted", async () => {
    for (const status of ["draft", "in_committee", "repealed", "expired"]) {
      const db = policiesDb(activePolicy(CALLER_COUNTRY, status));
      const caller = policiesRouter.createCaller(createIdorContext(db));
      await expect(caller.repealPolicy({ policyId: "pol_1" })).rejects.toMatchObject({
        code: "BAD_REQUEST",
      });
      expect(db.storytellerEffect.updateMany).not.toHaveBeenCalled();
    }
  });

  it("returns NOT_FOUND for an unknown policy", async () => {
    const db = policiesDb(null);
    const caller = policiesRouter.createCaller(createIdorContext(db));
    await expect(caller.repealPolicy({ policyId: "nope" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});
