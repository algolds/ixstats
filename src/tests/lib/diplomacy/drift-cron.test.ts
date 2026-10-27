/** @jest-environment node */
/**
 * The diplomatic-drift job runs every sweep (proposal expiry, hostile actions past their window, the cultural exchange
 * lifecycle, due embassy missions) and then drifts each relation, writing lower-case bands; one failing sweep never
 * stops the rest.
 */
const mockDb = {
  foreignPolicyAction: {
    updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    findMany: jest.fn().mockRejectedValue(new Error("sweep down")),
  },
  allianceMember: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
  culturalExchange: { findMany: jest.fn().mockResolvedValue([]), updateMany: jest.fn() },
  embassyMission: {
    updateMany: jest.fn().mockResolvedValue({ count: 2 }),
    findMany: jest.fn().mockResolvedValue([]),
  },
  diplomaticRelation: {
    findMany: jest.fn(),
    update: jest.fn().mockResolvedValue({}),
  },
};
jest.mock("~/server/db", () => ({
  get db() {
    return mockDb;
  },
}));

import { describe, it, expect } from "@jest/globals";
import { runDiplomaticDrift } from "~/lib/diplomacy/drift-cron";

describe("runDiplomaticDrift", () => {
  it("runs each sweep, survives a failing one, and drifts relations into lower-case bands", async () => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    jest.spyOn(Math, "random").mockReturnValue(0);
    mockDb.diplomaticRelation.findMany
      .mockResolvedValueOnce([
        {
          id: "r1",
          strength: 61,
          relationship: "FRIENDLY",
          recentActivity: null,
          goalCountry1: null,
          goalCountry2: null,
          status: "active",
        },
      ])
      .mockResolvedValue([]);
    const result = await runDiplomaticDrift();
    expect(result).toMatchObject({
      relationsProcessed: 1,
      relationsUpdated: 1,
      hostileActionsExpired: 0,
      missionsCancelled: 2,
    });
    expect(mockDb.culturalExchange.findMany).toHaveBeenCalled();
    expect(mockDb.diplomaticRelation.update).toHaveBeenCalledWith({
      where: { id: "r1" },
      data: expect.objectContaining({ strength: 60, relationship: "friendly" }),
    });
  });
});
