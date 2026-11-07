/** @jest-environment node */
/**
 * P2-03: branches stay public, but another nation's operation personnel and costs, conflict
 * casualties and damage (outside its parties), and crime and stability metrics are owner-only.
 */
jest.mock("~/env", () => ({ env: { DATABASE_URL: "file:./test.db", NODE_ENV: "test" } }));
jest.mock("~/server/db", () => ({
  db: {
    systemLog: { create: jest.fn() },
    user: { findUnique: jest.fn() },
    auditLog: { create: jest.fn() },
  },
  isDatabaseReadOnly: false,
}));
jest.mock("~/lib/statecraft/stability-store", () => ({
  computeInternalStability: jest.fn(async () => ({ stabilityScore: 60, crimeRate: 4 })),
}));

import { createCallerFactory } from "~/server/api/trpc";
import { securityConflictsRouter } from "~/server/api/routers/security/conflicts";
import { securityOperationsRouter } from "~/server/api/routers/security/operations";
import { securityStabilityRouter } from "~/server/api/routers/security/stability";
import { createMockPrisma, type MockPrismaProxy } from "~/tests/helpers/mock-db";
import { createMockCallerContext } from "~/tests/helpers/router-context";

const OWN = "country_1";
let db: MockPrismaProxy;
let calls = 0;

/** The owner of country_1, a player of country_9, or a signed-out visitor. */
function ctxFor(who: "owner" | "stranger" | "visitor") {
  if (who === "visitor") return createMockCallerContext({ db, user: null, auth: null });
  const countryId = who === "owner" ? OWN : "country_9";
  const user = { id: `u_${who}`, clerkUserId: `clerk_${who}`, countryId, role: null };
  return createMockCallerContext({
    db,
    user,
    auth: { userId: user.clerkUserId },
    rateLimitIdentifier: `owner-reads-${++calls}`,
  });
}

beforeEach(() => {
  db = createMockPrisma();
  db.user.findUnique.mockResolvedValue(null);
  db.country.findUnique.mockResolvedValue({ id: OWN, ownerUserId: "u_owner" });
  db.country.findMany.mockResolvedValue([]);
  db.militaryOperation.findMany.mockResolvedValue([
    {
      id: "op_1",
      name: "Northwind",
      personnelDeployed: 5000,
      dailyCost: 1e6,
      totalCostSoFar: 2e6,
      gdpDrain: 0.001,
      targetCountry: null,
      deployments: [],
    },
  ]);
  db.militaryConflict.findMany.mockResolvedValue([
    {
      id: "c_1",
      type: "pvnpc",
      status: "resolved",
      winner: OWN,
      initiatorId: OWN,
      defenderId: "country_npc",
      initiatorCasualties: 120,
      defenderCasualties: 900,
      economicDamage: 0.02,
      createdAt: new Date(),
      initiator: null,
      defender: null,
    },
  ]);
});

describe("security.getOperations", () => {
  it.each(["stranger", "visitor"] as const)("hides personnel and costs from a %s", async (who) => {
    const [op] = await createCallerFactory(securityOperationsRouter)(ctxFor(who)).getOperations({
      countryId: OWN,
    });
    expect(op).toMatchObject({ id: "op_1", name: "Northwind" });
    for (const field of ["personnelDeployed", "dailyCost", "totalCostSoFar", "gdpDrain"]) {
      expect(op).not.toHaveProperty(field);
    }
  });

  it("shows them to the owner", async () => {
    const [op] = await createCallerFactory(securityOperationsRouter)(
      ctxFor("owner")
    ).getOperations({ countryId: OWN });
    expect(op).toMatchObject({ personnelDeployed: 5000, dailyCost: 1e6, gdpDrain: 0.001 });
  });
});

describe("security.getConflicts", () => {
  it("hides casualties and damage from a nation outside the conflict", async () => {
    const [c] = await createCallerFactory(securityConflictsRouter)(
      ctxFor("stranger")
    ).getConflicts({ countryId: OWN });
    expect(c).toMatchObject({ id: "c_1", winner: OWN });
    expect(c).not.toHaveProperty("initiatorCasualties");
    expect(c).not.toHaveProperty("economicDamage");
  });

  it("shows them to a party", async () => {
    const [c] = await createCallerFactory(securityConflictsRouter)(ctxFor("owner")).getConflicts({
      countryId: OWN,
    });
    expect(c).toMatchObject({ initiatorCasualties: 120, economicDamage: 0.02 });
  });
});

describe("security.getInternalStability", () => {
  it("gives anyone but the owner no metrics", async () => {
    const res = await createCallerFactory(securityStabilityRouter)(
      ctxFor("stranger")
    ).getInternalStability({ countryId: OWN });
    expect(res).toEqual({ metrics: null });
  });

  it("gives the owner the metrics, with no security events list", async () => {
    const res = await createCallerFactory(securityStabilityRouter)(
      ctxFor("owner")
    ).getInternalStability({ countryId: OWN });
    expect(res).toEqual({ metrics: { stabilityScore: 60, crimeRate: 4 } });
  });
});
