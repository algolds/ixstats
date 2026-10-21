/** @jest-environment node */
/**
 * WK-8: daily Loreward scoring uses the weights admins save (Admin → Wiki → Lorewards),
 * falling back to the scorer's defaults.
 */
jest.mock("~/server/db", () => {
  const db = {
    systemConfig: { findMany: jest.fn() },
    wikiRevision: { findMany: jest.fn().mockResolvedValue([]) },
  };
  return { __esModule: true, db };
});

import { describe, it, expect, beforeEach } from "@jest/globals";
import { db } from "~/server/db";
import { DEFAULT_WEIGHTS, loadScoringWeights, lorewardWeightKey } from "~/lib/lorewards/scoring";

const findMany = (db as unknown as { systemConfig: { findMany: jest.Mock } }).systemConfig.findMany;

describe("Loreward scoring weights", () => {
  beforeEach(() => {
    findMany.mockReset();
  });
  it("overlays stored tunable weights and ignores invalid values", async () => {
    findMany.mockResolvedValue([
      { key: lorewardWeightKey("proseWeight"), value: "0.4" },
      { key: lorewardWeightKey("noveltyBonus"), value: "2" },
      { key: lorewardWeightKey("listPenalty"), value: "not-a-number" },
    ]);
    const weights = await loadScoringWeights();
    expect(weights.proseWeight).toBe(0.4);
    expect(weights.noveltyBonus).toBe(2);
    expect(weights.listPenalty).toBe(DEFAULT_WEIGHTS.listPenalty);
    expect(weights.minSingleEdit).toBe(DEFAULT_WEIGHTS.minSingleEdit);
  });
});
