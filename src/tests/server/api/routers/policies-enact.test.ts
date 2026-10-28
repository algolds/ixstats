/**
 * An executive policy is enacted when it is created (stress test B-03): it is in force on the nation's clock and its
 * growth effect is synced. A template's settings must be among its sliders' options (B-04): `calculate` trusts them.
 */
jest.mock("~/server/shared/projected-population", () => ({
  __esModule: true,
  loadProjectedPopulation: jest.fn(async () => 10_000_000),
}));
jest.mock("~/lib/policies", () => ({ applyPolicyEffect: jest.fn().mockResolvedValue(undefined) }));
jest.mock("~/server/db", () => ({ __esModule: true, db: {}, isDatabaseReadOnly: false }));

import { createCallerFactory } from "~/server/api/trpc";
import { policiesRouter } from "~/server/api/routers/policies";
import { applyPolicyEffect } from "~/lib/policies";
import { createMockCallerContext } from "~/tests/helpers/router-context";

const OWN = "country_own";
const MEMBER = {
  id: "db_member",
  clerkUserId: "user_member",
  countryId: OWN,
  role: { name: "member", level: 100 },
};

function caller() {
  const db = {
    user: { findUnique: jest.fn(async () => MEMBER), findMany: jest.fn().mockResolvedValue([]) },
    country: {
      findUnique: jest.fn(async () => ({
        id: OWN,
        name: "Testland",
        ownerUserId: MEMBER.id,
        realmId: "default",
        currentPopulation: 1_000_000,
      })),
    },
    policy: {
      create: jest.fn(async ({ data }: { data: object }) => ({ id: "policy_new", ...data })),
      aggregate: jest.fn().mockResolvedValue({ _sum: { execBandwidthCost: 0 } }),
    },
    governmentStructure: {
      findUnique: jest
        .fn()
        .mockResolvedValue({ governmentEffectiveness: 60, departments: [{ category: "finance" }] }),
    },
    governmentComponent: { findMany: jest.fn().mockResolvedValue([]) },
    nationalIssue: { count: jest.fn().mockResolvedValue(0) },
    intent: { aggregate: jest.fn().mockResolvedValue({ _sum: { execBandwidthCost: 0 } }) },
    budgetAllocation: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
    },
    quickActionTemplate: { findMany: jest.fn().mockResolvedValue([]) },
  };
  const ctx = createMockCallerContext({ auth: { userId: MEMBER.clerkUserId }, user: MEMBER, db });
  return { db, policies: createCallerFactory(policiesRouter)(ctx) };
}

const base = { countryId: OWN, name: "Act", description: "d" };

describe("policies.createPolicy enacts", () => {
  beforeEach(() => jest.clearAllMocks());

  it("creates the policy in force, stamped on the nation's clock, and syncs its effect", async () => {
    const { db, policies } = caller();
    await policies.createPolicy({ ...base, policyType: "economic", category: "fiscal" });
    expect(db.policy.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ status: "active", effectiveIxTime: expect.any(Number) }),
    });
    expect(applyPolicyEffect).toHaveBeenCalledWith(
      db,
      expect.objectContaining({ id: "policy_new" })
    );
  });

  it.each([
    ["an off-menu stipend", { stipend: 1000, funding: 0 }],
    ["an unknown setting", { stipend: 1, bogus: 2 }],
  ])("refuses a template with %s", async (_label, settings) => {
    const { db, policies } = caller();
    await expect(
      policies.createPolicy({
        ...base,
        policyType: "social",
        category: "social",
        decretalKey: "universal-basic-income",
        settings,
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(db.policy.create).not.toHaveBeenCalled();
  });

  it("refuses an unknown template", async () => {
    const { policies } = caller();
    await expect(
      policies.createPolicy({
        ...base,
        policyType: "social",
        category: "social",
        decretalKey: "nope",
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("computes a template's effects from a choice its sliders offer", async () => {
    const { db, policies } = caller();
    await policies.createPolicy({
      ...base,
      policyType: "social",
      category: "social",
      decretalKey: "universal-basic-income",
      settings: { stipend: 2, funding: 1 },
    });
    // stipend 2 (moderate): 2 × 0.8 − 2 × 0.2 (VAT) = 1.2% GDP; $800 × 1,000,000 people a year
    expect(db.policy.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        gdpEffect: expect.closeTo(1.2, 6),
        maintenanceCost: 800_000_000,
      }),
    });
  });
});
