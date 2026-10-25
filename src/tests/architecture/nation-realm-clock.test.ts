/** @jest-environment node */
import fs from "fs";
import path from "path";
/**
 * Realm time design §2: a nation's simulation reads its realm's clock (`clockForCountry`, or `realmClocks` +
 * `pickClock` in crons), never Ixnay's IxTime as a global "now". In the nation simulation's code no file reads IxTime's
 * present, speed or real-time mapping, nor the no-argument budget year (Ixnay's year); only the Ixnay clock source and
 * the client-safe budget-year helper that defines that default may.
 */
const ROOT = path.resolve(__dirname, "../../..");
const NATION_ROOTS = [
  "src/lib/economy",
  "src/lib/government",
  "src/lib/national-issues",
  "src/lib/policies",
  "src/lib/intent",
  "src/lib/statecraft",
  "src/lib/diplomacy",
  "src/lib/activity",
  "src/server/cron",
  "src/server/shared",
  "src/server/modules/government",
  "src/server/api/routers/countries",
  "src/server/api/routers/government",
  "src/server/api/routers/governmentComponents",
  "src/server/api/routers/atomicGovernment.ts",
  "src/server/api/routers/economics",
  "src/server/api/routers/economicComponents",
  "src/server/api/routers/taxSystem",
  "src/server/api/routers/national-issues",
  "src/server/api/routers/policies",
  "src/server/api/routers/legislation.ts",
  "src/server/api/routers/intent.ts",
  "src/server/api/routers/elections",
  "src/server/api/routers/quickactions",
  "src/server/api/routers/meetings",
  "src/server/api/routers/diplomacy",
  "src/server/api/routers/diplomaticScenarios",
  "src/server/api/routers/mycountry",
  "src/server/api/routers/activities",
  "src/server/api/routers/transport",
  "src/server/api/routers/intelligence",
];
/** Ixnay's clock source, and the helper whose no-argument budget year is Ixnay's (for client displays). */
const IXNAY_CLOCK_SOURCES = [
  "src/server/shared/realm-time.ts",
  "src/lib/government/budget-year.ts",
];
const GLOBAL_CLOCK_READ =
  /IxTime\.(?:getCurrentIxTime|getTimeMultiplier|convertToIxTime|convertFromIxTime)\(|IxTime\.getCurrentGameYear\(\)|\bcurrentBudgetYear\(\)/;

function walk(target: string): string[] {
  if (!fs.existsSync(target)) return [];
  if (fs.statSync(target).isFile()) return [target];
  return fs.readdirSync(target, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(target, entry.name);
    if (entry.isDirectory()) return walk(full);
    return /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });
}

describe("a nation's simulation runs on its realm's clock", () => {
  it("no nation simulation file reads Ixnay's clock as the present", () => {
    const offenders = NATION_ROOTS.flatMap((root) => walk(path.join(ROOT, root)))
      .map((file) => path.relative(ROOT, file))
      .filter((file) => !IXNAY_CLOCK_SOURCES.includes(file))
      .filter((file) => GLOBAL_CLOCK_READ.test(fs.readFileSync(path.join(ROOT, file), "utf8")));
    expect(offenders).toEqual([]);
  });

  it("every root it guards exists", () => {
    expect(NATION_ROOTS.filter((root) => !fs.existsSync(path.join(ROOT, root)))).toEqual([]);
  });

  it("the guard recognises the reads it forbids, and lets timeline maths through", () => {
    for (const line of [
      "const now = IxTime.getCurrentIxTime();",
      "const speed = IxTime.getTimeMultiplier();",
      "IxTime.convertToIxTime(date.getTime())",
      "new Date(IxTime.convertFromIxTime(ms))",
      "const year = IxTime.getCurrentGameYear();",
      "const budgetYear = currentBudgetYear();",
    ]) {
      expect(GLOBAL_CLOCK_READ.test(line)).toBe(true);
    }
    for (const line of [
      "currentBudgetYear(clock.now())",
      "IxTime.getCurrentGameYear(ixTime)",
      "IxTime.addYears(start, 4)",
      "const now = (await clockForCountry(db, id)).now();",
    ]) {
      expect(GLOBAL_CLOCK_READ.test(line)).toBe(false);
    }
  });
});
