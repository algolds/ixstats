import { describe, it, expect } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { securityAssessmentRouter } from "~/server/api/routers/security/assessment";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createMockPrisma } from "~/tests/helpers/mock-db";

const createCaller = createCallerFactory(securityAssessmentRouter);

describe("security.getSecurityAssessment (MC-13)", () => {
  it("returns defaults for a country with no assessment and writes nothing", async () => {
    const db = createMockPrisma();
    db.securityAssessment.findUnique.mockResolvedValue(null);
    db.internalStabilityMetrics.findUnique.mockResolvedValue(null);
    db.borderSecurity.findUnique.mockResolvedValue(null);
    db.securityThreat.findMany.mockResolvedValue([]);
    db.militaryBranch.findMany.mockResolvedValue([]);
    const caller = createCaller(createMockRouterContext({ auth: null, user: null, db }) as never);

    const result = await caller.getSecurityAssessment({ countryId: "c_1" });

    expect(result).toMatchObject({
      countryId: "c_1",
      overallSecurityScore: 60,
      securityLevel: "moderate",
    });
    expect(db.securityAssessment.create).not.toHaveBeenCalled();
  });
});
