import { policiesRouter } from "~/server/api/routers/policies";
import {
  CALLER_CLERK_ID,
  CALLER_COUNTRY,
  FOREIGN_COUNTRY,
  createIdorContext,
} from "~/tests/helpers/country-idor-context";

/** A decretal-free custom policy needs an active department matching its category. */
function policiesDb() {
  return {
    policy: {
      create: jest.fn(async ({ data }: { data: object }) => ({ id: "policy_new", ...data })),
      aggregate: jest.fn().mockResolvedValue({ _sum: { civCapCost: 0 } }),
    },
    governmentStructure: {
      findUnique: jest.fn().mockResolvedValue({
        governmentEffectiveness: 60,
        departments: [{ category: "finance" }],
      }),
    },
    governmentComponent: { findMany: jest.fn().mockResolvedValue([]) },
    nationalIssue: { count: jest.fn().mockResolvedValue(0) },
    intent: { aggregate: jest.fn().mockResolvedValue({ _sum: { civCapCost: 0 } }) },
    budgetAllocation: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
    },
  };
}

const policyInput = {
  userId: "someone_else",
  name: "Fiscal Discipline Act",
  description: "Balance the books",
  policyType: "economic" as const,
  category: "fiscal",
};

describe("Plan 332: policies.createPolicy requires country ownership", () => {
  it("rejects a member creating a policy for another country", async () => {
    const db = policiesDb();
    const caller = policiesRouter.createCaller(createIdorContext(db));

    await expect(
      caller.createPolicy({ ...policyInput, countryId: FOREIGN_COUNTRY })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.policy.create).not.toHaveBeenCalled();
  });

  it("records the caller as author, ignoring the client-sent userId", async () => {
    const db = policiesDb();
    const caller = policiesRouter.createCaller(createIdorContext(db));

    await caller.createPolicy({ ...policyInput, countryId: CALLER_COUNTRY });

    expect(db.policy.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ countryId: CALLER_COUNTRY, userId: CALLER_CLERK_ID }),
    });
  });

  it("lets an admin create a policy for a foreign country", async () => {
    const db = policiesDb();
    const caller = policiesRouter.createCaller(createIdorContext(db, "admin"));

    await caller.createPolicy({ ...policyInput, countryId: FOREIGN_COUNTRY });

    expect(db.policy.create).toHaveBeenCalledTimes(1);
  });
});
