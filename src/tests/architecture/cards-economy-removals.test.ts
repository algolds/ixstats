/** @jest-environment node */
/**
 * Cards refresh Phase 4 (the economy): the paths it replaced stay gone. One value cron, one royalty rule, one trade
 * table edited in place, real-time auctions of 24 hours to 7 days, and no rarity fallback in a pack's pool.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const ROOT = resolve(__dirname, "../../..");
const SRC = join(ROOT, "src");

/**
 * Every source outside `src/tests`: the tests that pin these absences (card-market-router.test.ts asserts that
 * getActiveAuctions and getCardTransferHistory are gone, the SQL tests that the columns and enums are dropped) name
 * them on purpose, as the Phase 3 ratchet leaves its tests out too.
 */
function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return path === join(SRC, "tests") ? [] : walk(path);
    return /\.(ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

const sources = walk(SRC).map((file) => ({
  file: relative(ROOT, file),
  text: readFileSync(file, "utf8"),
}));

describe("cards economy removals", () => {
  it("Card.marketValue is written in bulk only by the market-values module", () => {
    const writers = sources.filter(({ text }) => /UPDATE cards c SET "marketValue"/.test(text));
    expect(writers.map(({ file }) => file)).toEqual(["src/server/modules/cards/market-values.ts"]);
  });
});
