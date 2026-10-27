/** @jest-environment node */
/**
 * P2-12: the stat-progression dry run names each nation whose tier would change (runbook step 7 asks the operator to
 * check each one), and only runs (and then exits) when executed directly, not on import.
 */
import fs from "fs";
import path from "path";

jest.mock("@prisma/client", () => ({ PrismaClient: jest.fn() }));
jest.mock("~/lib/ixtime", () => ({ IxTime: {} }));
jest.mock("~/lib/config-service", () => ({ getEconomicConfigFromDB: jest.fn() }));
jest.mock("~/lib/ixtime/shared-clock", () => ({ refreshSharedClock: jest.fn() }));
jest.mock("~/server/shared/country-helpers", () => ({
  getComponentsStatsDataForCountries: jest.fn(),
  projectCountryStats: jest.fn(),
  projectedStatsUpdate: jest.fn(),
}));
jest.mock("~/server/cron/stat-progression", () => ({ isProjectionUnchanged: jest.fn() }));

import { PrismaClient } from "@prisma/client";
import { tierChanges } from "../../../scripts/cron/dry-run-stat-progression";

const SCRIPT = path.resolve(__dirname, "../../../scripts/cron/dry-run-stat-progression.ts");

it("names the nation and the tier for each change", () => {
  expect(
    tierChanges(
      "Castadilla (owned)",
      { economicTier: "Developed", populationTier: "Tier 4" },
      { economicTier: "Advanced", populationTier: "Tier 5" }
    )
  ).toEqual({
    economic: "Castadilla (owned): economic Developed -> Advanced",
    population: "Castadilla (owned): population Tier 4 -> Tier 5",
  });
  const same = { economicTier: "Developed", populationTier: "Tier 4" };
  expect(tierChanges("Faneria", same, { ...same })).toEqual({ economic: null, population: null });
});

it("does not connect on import, and exits after printing when run", () => {
  expect(PrismaClient).not.toHaveBeenCalled();
  const source = fs.readFileSync(SCRIPT, "utf8");
  expect(source).toMatch(/if \(import\.meta\.main\)/);
  expect(source).toContain("await db.$disconnect();");
  expect(source).toContain("process.exit(");
});
