/** @jest-environment node */
/**
 * npcPersonalities router: personalities are readable by anyone; creating, editing, retiring and
 * assigning them is admin only, stores the JSON fields as strings and writes an admin audit row.
 */
import { describe, it, expect, beforeEach } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { npcPersonalitiesRouter } from "~/server/api/routers/npcPersonalities";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createMockPrisma, type MockPrismaProxy } from "~/tests/helpers/mock-db";

const createCaller = createCallerFactory(npcPersonalitiesRouter);

function callerAs(db: MockPrismaProxy, who: "admin" | "player" | null) {
  return createCaller(
    createMockRouterContext({
      db,
      auth: who ? { userId: `clerk_${who}` } : null,
      user: who
        ? {
            id: who,
            clerkUserId: `clerk_${who}`,
            role: who === "admin" ? { name: "admin", level: 10 } : { name: "user", level: 100 },
          }
        : null,
      rateLimitIdentifier: `${who}_${Math.random()}`,
    }) as never
  );
}

const traits = {
  assertiveness: 50,
  cooperativeness: 50,
  economicFocus: 50,
  culturalOpenness: 50,
  riskTolerance: 50,
  ideologicalRigidity: 50,
  militarism: 50,
  isolationism: 50,
};

const newPersonality = {
  name: "The Merchant Prince",
  archetype: "peaceful_merchant" as const,
  traits,
  traitDescriptions: { economicFocus: "Trade first" },
  culturalProfile: {
    formality: 1,
    directness: 1,
    emotionality: 1,
    flexibility: 1,
    negotiationStyle: "patient",
  },
  toneMatrix: { friendly: { greeting: "Welcome" } },
  responsePatterns: ["Offer a deal"],
  scenarioResponses: {},
  eventModifiers: {},
};

let db: MockPrismaProxy;

beforeEach(() => {
  db = createMockPrisma();
  db.nPCPersonality.create.mockImplementation(async ({ data }: any) => ({ id: "p1", ...data }));
  db.nPCPersonality.update.mockImplementation(async ({ where, data }: any) => ({
    id: where.id,
    name: "Updated",
    ...data,
  }));
  db.nPCPersonalityAssignment.create.mockResolvedValue({ id: "as1" });
  db.nPCPersonalityAssignment.update.mockResolvedValue({ id: "as1" });
});

describe("admin gate", () => {
  it("refuses players on every admin procedure", async () => {
    const player = callerAs(db, "player");
    await expect(player.createPersonality(newPersonality)).rejects.toThrow(
      /Admin privileges required/
    );
    await expect(player.updatePersonality({ id: "p1", name: "X" })).rejects.toThrow(
      /Admin privileges required/
    );
    await expect(player.deletePersonality({ id: "p1" })).rejects.toThrow(
      /Admin privileges required/
    );
    await expect(
      player.assignPersonalityToCountry({ personalityId: "p1", countryId: "c1" })
    ).rejects.toThrow(/Admin privileges required/);

    expect(db.nPCPersonality.create).not.toHaveBeenCalled();
    expect(db.nPCPersonality.update).not.toHaveBeenCalled();
    expect(db.nPCPersonalityAssignment.create).not.toHaveBeenCalled();
  });

  it("refuses signed-out callers", async () => {
    await expect(callerAs(db, null).deletePersonality({ id: "p1" })).rejects.toThrow(
      /Authentication required/
    );
  });
});

describe("admin writes", () => {
  it("creates a personality with flattened traits and stringified JSON, and audits it", async () => {
    const { personality } = await callerAs(db, "admin").createPersonality(newPersonality);

    const { data } = db.nPCPersonality.create.mock.calls[0]![0];
    expect(data).toMatchObject({
      name: "The Merchant Prince",
      assertiveness: 50,
      toneMatrix: JSON.stringify(newPersonality.toneMatrix),
      responsePatterns: '["Offer a deal"]',
    });
    expect(personality.responsePatterns).toEqual(["Offer a deal"]);
    expect(db.adminAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "NPC_PERSONALITY_CREATED", adminId: "admin" }),
    });
  });

  it("rejects traits outside 0 to 100", async () => {
    await expect(
      callerAs(db, "admin").createPersonality({
        ...newPersonality,
        traits: { ...traits, militarism: 101 },
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("soft-deletes by deactivating", async () => {
    await callerAs(db, "admin").deletePersonality({ id: "p1" });
    expect(db.nPCPersonality.update).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: { isActive: false },
    });
  });

  it("merges partial trait edits into the update", async () => {
    await callerAs(db, "admin").updatePersonality({ id: "p1", traits: { militarism: 80 } });
    expect(db.nPCPersonality.update).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: expect.objectContaining({ militarism: 80, updatedAt: expect.any(Date) }),
    });
  });

  it("assigns a new personality and counts its use", async () => {
    db.nPCPersonalityAssignment.findUnique.mockResolvedValue(null);

    await callerAs(db, "admin").assignPersonalityToCountry({
      personalityId: "p1",
      countryId: "c1",
    });

    expect(db.nPCPersonalityAssignment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ personalityId: "p1", countryId: "c1", assignedBy: "admin" }),
    });
    expect(db.nPCPersonality.update).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: { usageCount: { increment: 1 } },
    });
  });

  it("reassigns an existing country without counting a new use", async () => {
    db.nPCPersonalityAssignment.findUnique.mockResolvedValue({ id: "as1", countryId: "c1" });

    await callerAs(db, "admin").assignPersonalityToCountry({
      personalityId: "p2",
      countryId: "c1",
    });

    expect(db.nPCPersonalityAssignment.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { countryId: "c1" } })
    );
    expect(db.nPCPersonality.update).not.toHaveBeenCalled();
  });
});

describe("getAllPersonalities", () => {
  it("is public, filters and parses stored JSON", async () => {
    db.nPCPersonality.findMany.mockResolvedValue([
      { id: "p1", toneMatrix: '{"a":{"b":"c"}}', responsePatterns: null },
    ]);

    const result = await callerAs(db, null).getAllPersonalities({
      archetype: "peaceful_merchant",
      isActive: true,
      orderBy: "name",
    });

    expect(db.nPCPersonality.findMany).toHaveBeenCalledWith({
      where: { archetype: "peaceful_merchant", isActive: true },
      orderBy: { name: "asc" },
    });
    expect(result[0]).toMatchObject({ toneMatrix: { a: { b: "c" } }, responsePatterns: [] });
  });

  it("rejects an unknown archetype", async () => {
    await expect(
      callerAs(db, null).getAllPersonalities({ archetype: "warlord" as never })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
