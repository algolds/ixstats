import { describe, it, expect, jest } from "@jest/globals";

// Mock env
jest.mock("~/env", () => ({ env: { DATABASE_URL: "file:./test.db", NODE_ENV: "test" } }));

jest.mock("~/lib/ixtime", () => ({
  IxTime: { getCurrentIxTime: () => 1000000 },
}));

jest.mock("~/lib/gameplay-flags", () => ({
  GAMEPLAY_FLAGS: {},
}));

jest.mock("~/lib/national-issues-engine", () => ({
  NationalIssuesEngine: { forceGenerate: jest.fn() },
}));

jest.mock("~/lib/country-event-spine", () => ({
  CountryEventSpine: { recordCountryEvent: jest.fn() },
}));

import { NationalIssuesConsequences } from "~/lib/national-issues-consequences";

function makeDb(overrides: Record<string, unknown> = {}) {
  return {
    nationalIssue: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    intent: {
      update: jest.fn(),
    },
    ...overrides,
  };
}

describe("NationalIssuesConsequences.recomputeIntentProgress", () => {
  it("sets 100 when all linked issues are resolved", async () => {
    const db = makeDb();
    (db.nationalIssue.findMany as jest.Mock).mockResolvedValue([
      { status: "responded" },
      { status: "auto_resolved" },
      { status: "dismissed" },
    ]);

    const progress = await NationalIssuesConsequences.recomputeIntentProgress("intent-1", db as any);

    expect(progress).toBe(100);
    expect(db.intent.update).toHaveBeenCalledWith({
      where: { id: "intent-1" },
      data: { progress: 100 },
    });
  });

  it("counts only resolved statuses, excluding pending/viewed", async () => {
    const db = makeDb();
    (db.nationalIssue.findMany as jest.Mock).mockResolvedValue([
      { status: "responded" },
      { status: "pending" },
      { status: "viewed" },
      { status: "dismissed" },
    ]);

    const progress = await NationalIssuesConsequences.recomputeIntentProgress("intent-1", db as any);

    expect(progress).toBe(50);
    expect(db.intent.update).toHaveBeenCalledWith({
      where: { id: "intent-1" },
      data: { progress: 50 },
    });
  });

  it("resets to 0 when no linked issues exist", async () => {
    const db = makeDb();
    (db.nationalIssue.findMany as jest.Mock).mockResolvedValue([]);

    const progress = await NationalIssuesConsequences.recomputeIntentProgress("intent-1", db as any);

    expect(progress).toBe(0);
    expect(db.intent.update).toHaveBeenCalledWith({
      where: { id: "intent-1" },
      data: { progress: 0 },
    });
  });

  it("returns 0 and does not update when there are no linked issues", async () => {
    const db = makeDb();
    (db.nationalIssue.findMany as jest.Mock).mockResolvedValue([]);

    const progress = await NationalIssuesConsequences.recomputeIntentProgress("intent-1", db as any);

    expect(progress).toBe(0);
  });
});
